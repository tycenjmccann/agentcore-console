// Server-side AgentCore SDK client
// Dynamic discovery via Control Plane + invocation via Data Plane

import {
  BedrockRuntimeClient,
  ConverseStreamCommand,
} from "@aws-sdk/client-bedrock-runtime";
import {
  BedrockAgentCoreClient,
  InvokeAgentRuntimeCommand,
} from "@aws-sdk/client-bedrock-agentcore";
import {
  BedrockAgentCoreControlClient,
  ListHarnessesCommand,
  ListAgentRuntimesCommand,
  ListMemoriesCommand,
  GetHarnessCommand,
} from "@aws-sdk/client-bedrock-agentcore-control";
import {
  CloudWatchLogsClient,
  DescribeLogGroupsCommand,
} from "@aws-sdk/client-cloudwatch-logs";

let activeRegion = process.env.AWS_REGION || "us-east-1";

// Singleton clients
let bedrockClient: BedrockRuntimeClient | null = null;
let agentCoreClient: BedrockAgentCoreClient | null = null;
let controlClient: BedrockAgentCoreControlClient | null = null;
let logsClient: CloudWatchLogsClient | null = null;

/**
 * Reset all SDK clients and caches — called when region changes.
 */
export function resetClients(newRegion: string) {
  activeRegion = newRegion;
  bedrockClient = null;
  agentCoreClient = null;
  controlClient = null;
  logsClient = null;
  agentCache = null;
  memoryCache = null;
  logGroupCache = null;
}

function getBedrockClient(): BedrockRuntimeClient {
  if (!bedrockClient) bedrockClient = new BedrockRuntimeClient({ region: activeRegion });
  return bedrockClient;
}

function getAgentCoreClient(): BedrockAgentCoreClient {
  if (!agentCoreClient) agentCoreClient = new BedrockAgentCoreClient({ region: activeRegion });
  return agentCoreClient;
}

function getControlClient(): BedrockAgentCoreControlClient {
  if (!controlClient) controlClient = new BedrockAgentCoreControlClient({ region: activeRegion });
  return controlClient;
}

function getLogsClient(): CloudWatchLogsClient {
  if (!logsClient) logsClient = new CloudWatchLogsClient({ region: activeRegion });
  return logsClient;
}

// ─── Agent Discovery ───────────────────────────────────────────────────────────

export interface DiscoveredAgent {
  id: string;
  name: string;
  arn: string;
  type: "harness" | "runtime";
  status: string;
  createdAt?: string;
  updatedAt?: string;
  // Enriched data (populated by getAgentDetail)
  memoryId?: string;
  logGroup?: string;
  model?: string;
  systemPrompt?: string;
  tools?: Array<{ type: string; name?: string }>;
}

export interface DiscoveredMemory {
  id: string;
  arn?: string;
  status: string;
}

// Cache with TTL
let agentCache: { data: DiscoveredAgent[]; ts: number } | null = null;
let memoryCache: { data: DiscoveredMemory[]; ts: number } | null = null;
let logGroupCache: { data: string[]; ts: number } | null = null;
const CACHE_TTL = 60_000; // 60 seconds

/**
 * Discover all agents (harnesses + runtimes) in the account.
 */
export async function discoverAgents(): Promise<DiscoveredAgent[]> {
  if (agentCache && Date.now() - agentCache.ts < CACHE_TTL) return agentCache.data;

  const client = getControlClient();
  const agents: DiscoveredAgent[] = [];

  // List harnesses
  try {
    const harnessRes = await client.send(new ListHarnessesCommand({ maxResults: 100 }));
    for (const h of harnessRes.harnesses || []) {
      agents.push({
        id: h.harnessId!,
        name: h.harnessName || h.harnessId!,
        arn: h.arn!,
        type: "harness",
        status: h.status || "UNKNOWN",
        createdAt: h.createdAt?.toISOString(),
        updatedAt: h.updatedAt?.toISOString(),
      });
    }
  } catch (err) {
    console.error("Failed to list harnesses:", err);
  }

  // List runtimes
  try {
    const runtimeRes = await client.send(new ListAgentRuntimesCommand({ maxResults: 100 }));
    for (const r of runtimeRes.agentRuntimes || []) {
      agents.push({
        id: r.agentRuntimeId!,
        name: r.agentRuntimeName || r.agentRuntimeId!,
        arn: r.agentRuntimeArn!,
        type: "runtime",
        status: r.status || "UNKNOWN",
        updatedAt: r.lastUpdatedAt?.toISOString(),
      });
    }
  } catch (err) {
    console.error("Failed to list runtimes:", err);
  }

  agentCache = { data: agents, ts: Date.now() };
  return agents;
}

/**
 * Get detailed info for a specific harness agent (model, tools, system prompt).
 */
export async function getHarnessDetail(harnessId: string): Promise<Partial<DiscoveredAgent>> {
  try {
    const client = getControlClient();
    const res = await client.send(new GetHarnessCommand({ harnessId }));
    const h = res.harness;
    if (!h) return {};

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const model = h.model as any;
    const modelId = model?.bedrockModelConfig?.modelId || model?.openAiModelConfig?.modelId || model?.geminiModelConfig?.modelId;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const systemPrompt = (h.systemPrompt as any[])?.map((b: any) => b.text).filter(Boolean).join("\n") || undefined;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tools = (h.tools as any[])?.map((t: any) => ({
      type: t.type || "unknown",
      name: t.remoteMcp?.url || t.inlineFunction?.name || t.type,
    })) || [];

    return { model: modelId, systemPrompt, tools };
  } catch (err) {
    console.error("Failed to get harness detail:", err);
    return {};
  }
}

/**
 * Discover all memory resources in the account.
 */
export async function discoverMemories(): Promise<DiscoveredMemory[]> {
  if (memoryCache && Date.now() - memoryCache.ts < CACHE_TTL) return memoryCache.data;

  try {
    const client = getControlClient();
    const res = await client.send(new ListMemoriesCommand({ maxResults: 100 }));
    const memories = (res.memories || []).map((m) => ({
      id: m.id || "",
      arn: m.arn,
      status: m.status || "UNKNOWN",
    }));
    memoryCache = { data: memories, ts: Date.now() };
    return memories;
  } catch (err) {
    console.error("Failed to list memories:", err);
    return [];
  }
}

/**
 * Find the memory ID associated with an agent by naming convention.
 * Convention: memory ID contains agent name or ID substring.
 */
export async function findMemoryForAgent(agentId: string): Promise<string | null> {
  const memories = await discoverMemories();
  // Try exact substring match on agent ID parts
  const agentParts = agentId.split(/[-_]/).filter((p) => p.length > 3);
  for (const mem of memories) {
    for (const part of agentParts) {
      if (mem.id.includes(part)) return mem.id;
    }
  }
  // Fallback: return first active memory if only one exists
  const active = memories.filter((m) => m.status === "ACTIVE");
  if (active.length === 1) return active[0].id;
  return null;
}

/**
 * Discover CloudWatch log groups for AgentCore runtimes.
 */
export async function discoverLogGroups(): Promise<string[]> {
  if (logGroupCache && Date.now() - logGroupCache.ts < CACHE_TTL) return logGroupCache.data;

  try {
    const client = getLogsClient();
    const res = await client.send(
      new DescribeLogGroupsCommand({
        logGroupNamePrefix: "/aws/bedrock-agentcore/runtimes/",
        limit: 50,
      })
    );
    const groups = (res.logGroups || []).map((g) => g.logGroupName!).filter(Boolean);
    logGroupCache = { data: groups, ts: Date.now() };
    return groups;
  } catch (err) {
    console.error("Failed to discover log groups:", err);
    return [];
  }
}

/**
 * Find the log group for an agent by matching its name/ID in the log group path.
 */
export async function findLogGroupForAgent(agentId: string, agentName?: string): Promise<string | null> {
  const groups = await discoverLogGroups();
  // Match by agent ID or name in the log group path
  const searchTerms = [agentId, ...(agentName ? [agentName.replace(/\s+/g, "_").toLowerCase()] : [])];
  for (const group of groups) {
    for (const term of searchTerms) {
      // Check if any significant part of the agent ID appears in the log group
      const parts = term.split(/[-_]/).filter((p) => p.length > 4);
      for (const part of parts) {
        if (group.toLowerCase().includes(part.toLowerCase())) return group;
      }
    }
  }
  return null;
}

// ─── Agent Invocation ──────────────────────────────────────────────────────────

/**
 * Stream a builder agent chat using Bedrock Converse API.
 */
export async function streamBuilderConverse(
  messages: Array<{ role: string; content: string }>,
  systemPrompt: string
): Promise<ReadableStream> {
  const client = getBedrockClient();
  const encoder = new TextEncoder();

  const converseMessages = messages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: [{ text: m.content }],
  }));

  const command = new ConverseStreamCommand({
    modelId: "us.anthropic.claude-sonnet-4-20250514-v1:0",
    system: [{ text: systemPrompt }],
    messages: converseMessages,
    inferenceConfig: { maxTokens: 4096, temperature: 0.7 },
  });

  const response = await client.send(command);

  return new ReadableStream({
    async start(controller) {
      try {
        if (response.stream) {
          for await (const event of response.stream) {
            if (event.contentBlockDelta?.delta?.text) {
              const data = JSON.stringify({ type: "text", content: event.contentBlockDelta.delta.text });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            } else if (event.messageStop) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
            }
          }
        }
        controller.close();
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Unknown error";
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", content: errMsg })}\n\n`));
        controller.close();
      }
    },
  });
}

/**
 * Invoke a deployed AgentCore Runtime agent (non-harness).
 */
export async function invokeAgentRuntime(params: {
  agentRuntimeArn: string;
  prompt: string;
  sessionId: string;
}): Promise<ReadableStream> {
  const client = getAgentCoreClient();
  const encoder = new TextEncoder();

  const payload = JSON.stringify({ prompt: params.prompt });

  const command = new InvokeAgentRuntimeCommand({
    agentRuntimeArn: params.agentRuntimeArn,
    runtimeSessionId: params.sessionId,
    payload: new TextEncoder().encode(payload),
    contentType: "application/json",
    accept: "application/json",
  });

  const response = await client.send(command);

  return new ReadableStream({
    async start(controller) {
      try {
        if (response.response) {
          const body = await response.response.transformToString();
          if (body.includes("data: ")) {
            for (const line of body.split("\n")) {
              if (line.startsWith("data: ")) {
                controller.enqueue(encoder.encode(line + "\n\n"));
              }
            }
          } else {
            let text = body;
            try {
              const parsed = JSON.parse(body);
              if (parsed.result?.content) {
                text = parsed.result.content.map((b: { text?: string }) => b.text || "").join("");
              } else if (parsed.response) {
                text = typeof parsed.response === "string" ? parsed.response : JSON.stringify(parsed.response);
              }
            } catch { /* use raw body */ }
            const data = JSON.stringify({ type: "text", content: text });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          }
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
        controller.close();
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Unknown error";
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", content: errMsg })}\n\n`));
        controller.close();
      }
    },
  });
}

/**
 * Invoke a harness-managed agent using InvokeHarness.
 */
export async function invokeHarnessAgent(params: {
  harnessArn: string;
  prompt: string;
  sessionId: string;
  systemPrompt?: string;
  history?: Array<{ role: string; content: string }>;
}): Promise<ReadableStream> {
  const client = getAgentCoreClient();
  const encoder = new TextEncoder();

  const { InvokeHarnessCommand } = await import("@aws-sdk/client-bedrock-agentcore");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messages: any[] = [];

  if (params.history && params.history.length > 0) {
    for (const msg of params.history) {
      messages.push({
        role: msg.role === "assistant" ? "assistant" : "user",
        content: [{ text: msg.content }],
      });
    }
  }

  messages.push({ role: "user", content: [{ text: params.prompt }] });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const commandInput: any = {
    harnessArn: params.harnessArn,
    runtimeSessionId: params.sessionId,
    messages,
    model: {
      bedrockModelConfig: {
        modelId: "us.anthropic.claude-sonnet-4-20250514-v1:0",
        maxTokens: 4096,
      },
    },
  };

  if (params.systemPrompt) {
    commandInput.system = [{ text: params.systemPrompt }];
  }

  const command = new InvokeHarnessCommand(commandInput);
  const response = await client.send(command);

  return new ReadableStream({
    async start(controller) {
      try {
        if (response.stream) {
          for await (const event of response.stream as AsyncIterable<Record<string, unknown>>) {
            if ("contentBlockDelta" in event) {
              const delta = event.contentBlockDelta as { delta?: { text?: string } };
              if (delta.delta?.text) {
                const data = JSON.stringify({ type: "text", content: delta.delta.text });
                controller.enqueue(encoder.encode(`data: ${data}\n\n`));
              }
            } else if ("contentBlockStart" in event) {
              const block = event.contentBlockStart as { start?: { toolUse?: { toolUseId?: string; name?: string } } };
              if (block.start?.toolUse) {
                const trace = JSON.stringify({
                  type: "trace",
                  event: "tool_start",
                  name: block.start.toolUse.name,
                  toolUseId: block.start.toolUse.toolUseId,
                  timestamp: new Date().toISOString(),
                });
                controller.enqueue(encoder.encode(`data: ${trace}\n\n`));
              }
            } else if ("contentBlockStop" in event) {
              const trace = JSON.stringify({ type: "trace", event: "block_stop", timestamp: new Date().toISOString() });
              controller.enqueue(encoder.encode(`data: ${trace}\n\n`));
            } else if ("messageStart" in event) {
              const trace = JSON.stringify({ type: "trace", event: "message_start", timestamp: new Date().toISOString() });
              controller.enqueue(encoder.encode(`data: ${trace}\n\n`));
            } else if ("messageStop" in event) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
            } else if ("metadata" in event) {
              const meta = event.metadata as { usage?: { inputTokens?: number; outputTokens?: number } };
              if (meta.usage) {
                const trace = JSON.stringify({
                  type: "trace",
                  event: "usage",
                  inputTokens: meta.usage.inputTokens,
                  outputTokens: meta.usage.outputTokens,
                  timestamp: new Date().toISOString(),
                });
                controller.enqueue(encoder.encode(`data: ${trace}\n\n`));
              }
            }
          }
        }
        controller.close();
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Unknown error";
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", content: errMsg })}\n\n`));
        controller.close();
      }
    },
  });
}
