import { NextRequest } from "next/server";
import { streamBuilderConverse } from "@/lib/agentcore-sdk";

const BUILDER_SYSTEM_PROMPT = `You are an Agent Configuration Assistant for Amazon Bedrock AgentCore.
Your job is to help users create and configure AI agents using the AgentCore Harness.

When a user describes an agent they want to build, you should:
1. Understand their requirements (purpose, tools needed, model choice)
2. Generate a complete harness configuration
3. Explain what each part does

IMPORTANT: Generate the configuration as a JSON code block tagged with \`\`\`agent-config:

\`\`\`agent-config
{
  "agent_name": "snake_case_name",
  "model_id": "us.anthropic.claude-sonnet-4-20250514-v1:0",
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
- us.anthropic.claude-sonnet-4-20250514-v1:0 (fast, good for most tasks)
- us.anthropic.claude-opus-4-6-v1 (most capable)
- us.anthropic.claude-haiku-4-5-20251001-v1:0 (fastest, cheapest)

Available tool types: code_editor, terminal, file_search, git, web_search, browser, static_analysis, calculator

Be conversational but efficient. Generate the config as soon as you have enough information.`;

/**
 * POST /api/agentcore/builder
 * Agent builder chat - uses Bedrock Converse API directly (same as reference webapp).
 */
export async function POST(req: NextRequest) {
  const { prompt, history } = await req.json();

  if (!prompt) {
    return Response.json({ error: "prompt is required" }, { status: 400 });
  }

  try {
    const messages: Array<{ role: string; content: string }> = [];
    if (history && Array.isArray(history)) {
      for (const msg of history) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }
    messages.push({ role: "user", content: prompt });

    const stream = await streamBuilderConverse(messages, BUILDER_SYSTEM_PROMPT);

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Builder error:", error);
    return Response.json(
      { error: `Builder failed: ${error instanceof Error ? error.message : "Unknown"}` },
      { status: 500 }
    );
  }
}
