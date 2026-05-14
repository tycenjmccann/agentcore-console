import { NextRequest } from "next/server";
import { invokeHarnessAgent, streamBuilderConverse } from "@/lib/agentcore-sdk";

/**
 * POST /api/agentcore/builder
 * Agent builder chat — invokes the Builder Agent harness if deployed,
 * otherwise falls back to direct Converse API.
 *
 * The builder agent has tools to list agents, list available gateway tools,
 * list memories, and create new harness agents. It has memory so it
 * remembers what it's previously created.
 */

const BUILDER_AGENT_ID = process.env.BUILDER_AGENT_ID;

const FALLBACK_SYSTEM_PROMPT = `You are an Agent Configuration Assistant for Amazon Bedrock AgentCore.
Your job is to help users create and configure AI agents using the AgentCore Harness.

When a user describes an agent they want to build, you should:
1. Understand their requirements (purpose, tools needed, model choice)
2. Generate a complete harness configuration
3. Explain what each part does

IMPORTANT: Generate the configuration as a JSON code block tagged with \`\`\`agent-config:

\`\`\`agent-config
{
  "agent_name": "snake_case_name",
  "model_id": "global.anthropic.claude-sonnet-4-5-20250929-v1:0",
  "system_prompt": "Detailed system prompt for the agent...",
  "tools": ["code_editor", "terminal", "file_search", "git"],
  "mcp_servers": {},
  "guardrails": { "max_tokens": 4096 },
  "memory": { "type": "session", "config": { "ttl_hours": 24 } }
}
\`\`\`

AGENT NAMING RULES:
- Must match: [a-zA-Z][a-zA-Z0-9_]{0,47}
- Use snake_case (e.g. "trust_safety_agent", "backend_api_agent")

Available models:
- global.anthropic.claude-sonnet-4-5-20250929-v1:0 (fast, good for most tasks)
- global.anthropic.claude-opus-4-6-v1 (most capable)
- global.anthropic.claude-haiku-4-5-20251001-v1:0 (fastest, cheapest)

Available tool types: code_editor, terminal, file_search, git, web_search, browser, static_analysis, calculator

Be conversational but efficient. Generate the config as soon as you have enough information.`;

export async function POST(req: NextRequest) {
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { prompt, sessionId, history } = body;

  if (!prompt) {
    return Response.json({ error: "prompt is required" }, { status: 400 });
  }

  try {
    // If builder harness is deployed, use it (real agent with tools + memory)
    if (BUILDER_AGENT_ID) {
      return await invokeBuilderHarness(prompt, sessionId, history);
    }

    // Fallback: direct Converse API (no tools, no memory)
    return await invokeFallbackConverse(prompt, history);
  } catch (error) {
    console.error("Builder error:", error);
    return Response.json(
      { error: `Builder failed: ${error instanceof Error ? error.message : "Unknown"}` },
      { status: 500 }
    );
  }
}

/**
 * Invoke the Builder Agent harness — has access to list_agents, list_gateway_tools,
 * create_harness, list_memories, get_agent_detail tools via gateway.
 */
async function invokeBuilderHarness(prompt: string, sessionId?: string, history?: Array<{ role: string; content: string }>) {
  const sid = sessionId || `builder-${crypto.randomUUID()}-${Date.now()}`;

  // Build history for the harness
  const harnessHistory = history?.map((msg) => ({
    role: msg.role as "user" | "assistant",
    content: msg.content,
  }));

  // Resolve harness ARN — we need the full ARN
  const region = process.env.AWS_REGION || "us-east-1";
  const { STSClient, GetCallerIdentityCommand } = await import("@aws-sdk/client-sts");
  const sts = new STSClient({ region });
  const identity = await sts.send(new GetCallerIdentityCommand({}));
  const accountId = identity.Account;
  const harnessArn = `arn:aws:bedrock-agentcore:${region}:${accountId}:harness/${BUILDER_AGENT_ID}`;

  const stream = await invokeHarnessAgent({
    harnessArn,
    prompt,
    sessionId: sid,
    history: harnessHistory,
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

/**
 * Fallback: direct Converse API without tools/memory.
 */
async function invokeFallbackConverse(prompt: string, history?: Array<{ role: string; content: string }>) {
  const messages: Array<{ role: string; content: string }> = [];
  if (history && Array.isArray(history)) {
    for (const msg of history) {
      messages.push({ role: msg.role, content: msg.content });
    }
  }
  messages.push({ role: "user", content: prompt });

  const stream = await streamBuilderConverse(messages, FALLBACK_SYSTEM_PROMPT);

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
