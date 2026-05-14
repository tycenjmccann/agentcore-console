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
  GetAgentRuntimeCommand,
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

// Agent → Memory mapping (user-defined, persisted to disk)
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const MAPPINGS_FILE = join(process.cwd(), ".memory-mappings.json");

function loadMappings(): Record<string, string> {
  try {
    if (existsSync(MAPPINGS_FILE)) {
      return JSON.parse(readFileSync(MAPPINGS_FILE, "utf-8"));
    }
  } catch { /* ignore */ }
  return {};
}

function saveMappings(mappings: Record<string, string>) {
  writeFileSync(MAPPINGS_FILE, JSON.stringify(mappings, null, 2));
}

export function setMemoryMapping(agentId: string, memoryId: string) {
  const mappings = loadMappings();
  mappings[agentId] = memoryId;
  saveMappings(mappings);
}

export function removeMemoryMapping(agentId: string) {
  const mappings = loadMappings();
  delete mappings[agentId];
  saveMappings(mappings);
}

export function getMemoryMapping(agentId: string): string | null {
  const mappings = loadMappings();
  return mappings[agentId] || null;
}

export function getAllMemoryMappings(): Record<string, string> {
  return loadMappings();
}

// Agent → Payload Format mapping (persisted to disk)
const FORMATS_FILE = join(process.cwd(), ".payload-formats.json");

function loadFormats(): Record<string, string> {
  try {
    if (existsSync(FORMATS_FILE)) {
      return JSON.parse(readFileSync(FORMATS_FILE, "utf-8"));
    }
  } catch { /* ignore */ }
  return {};
}

function saveFormats(formats: Record<string, string>) {
  writeFileSync(FORMATS_FILE, JSON.stringify(formats, null, 2));
}

export function setPayloadFormat(agentId: string, format: string) {
  const formats = loadFormats();
  formats[agentId] = format;
  saveFormats(formats);
}

export function getPayloadFormat(agentId: string): string | null {
  const formats = loadFormats();
  return formats[agentId] || null;
}

export function getAllPayloadFormats(): Record<string, string> {
  return loadFormats();
}

/**
 * Get the currently active AWS region.
 */
export function getActiveRegion(): string {
  return activeRegion;
}

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
  description?: string;
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

  // List runtimes (filter out harness-backing runtimes — those are implementation details)
  const harnessNames = new Set(agents.map((a) => a.name));
  try {
    const runtimeRes = await client.send(new ListAgentRuntimesCommand({ maxResults: 100 }));
    for (const r of runtimeRes.agentRuntimes || []) {
      const name = r.agentRuntimeName || r.agentRuntimeId!;
      // Skip runtimes that are backing endpoints for harnesses (pattern: "harness_<harnessName>")
      if (name.startsWith("harness_") && harnessNames.has(name.replace("harness_", ""))) {
        continue;
      }
      agents.push({
        id: r.agentRuntimeId!,
        name,
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

    // Extract a short description from system prompt (first sentence or first 120 chars)
    let description: string | undefined;
    if (systemPrompt) {
      const firstSentence = systemPrompt.match(/^[^.!?\n]+[.!?]?/)?.[0] || "";
      description = firstSentence.length > 120 ? firstSentence.slice(0, 117) + "..." : firstSentence;
    }

    // Extract memory ID from harness config (the API returns the ARN directly)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const memoryConfig = (h as any).memory?.agentCoreMemoryConfiguration;
    let memoryId: string | null = null;
    if (memoryConfig?.arn) {
      // ARN format: arn:aws:bedrock-agentcore:region:account:memory/MEMORY_ID
      const arnParts = memoryConfig.arn.split("/");
      memoryId = arnParts[arnParts.length - 1] || null;
    }

    return { model: modelId, systemPrompt, tools, description, memoryId: memoryId || undefined };
  } catch (err) {
    console.error("Failed to get harness detail:", err);
    return {};
  }
}

/**
 * Get runtime detail — extracts memory ID from env vars or runtime config.
 */
export async function getRuntimeDetail(runtimeId: string): Promise<Partial<DiscoveredAgent>> {
  try {
    const client = getControlClient();
    const res = await client.send(new GetAgentRuntimeCommand({ agentRuntimeId: runtimeId }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rt = res as any;

    // Check environment variables for memory ARN/ID references
    const envVars = rt.environmentVariables || {};
    let memoryId: string | null = null;

    // Common env var names that agents use for memory config
    const memoryEnvKeys = ["BEDROCK_AGENTCORE_MEMORY_ID", "MEMORY_ID", "AGENTCORE_MEMORY_ID", "MEMORY_ARN", "AGENT_MEMORY_ID", "MEMORY_RESOURCE_ID"];
    for (const key of memoryEnvKeys) {
      if (envVars[key]) {
        const val = envVars[key];
        // If it's an ARN, extract the ID
        if (val.includes("memory/")) {
          memoryId = val.split("memory/")[1] || null;
        } else {
          memoryId = val;
        }
        break;
      }
    }

    // Also check all env vars for anything containing a memory ARN pattern
    if (!memoryId) {
      for (const val of Object.values(envVars)) {
        if (typeof val === "string" && val.includes(":memory/")) {
          memoryId = val.split("memory/")[1] || null;
          break;
        }
      }
    }

    return {
      description: rt.description || undefined,
      memoryId: memoryId || undefined,
    };
  } catch (err) {
    console.error("Failed to get runtime detail:", err);
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
  // Strategy 1: User-defined mapping (fastest, persisted to disk)
  const mapped = getMemoryMapping(agentId);
  if (mapped) return mapped;

  // Strategy 2: Pull memory ID from agent config (harness memory field, runtime env vars)
  const agents = await discoverAgents();
  const agent = agents.find((a) => a.id === agentId);

  if (agent?.type === "harness") {
    const detail = await getHarnessDetail(agentId);
    if (detail.memoryId) return detail.memoryId;
  }

  if (agent?.type === "runtime") {
    const runtimeDetail = await getRuntimeDetail(agentId);
    if (runtimeDetail.memoryId) return runtimeDetail.memoryId;
  }

  if (agent?.memoryId) return agent.memoryId;

  // Strategy 3: Name-based matching — convention is {agentName}_mem-{suffix}
  const memories = await discoverMemories();
  if (memories.length === 0) return null;

  // 3a: Precise prefix match using agentId base name (strips trailing -randomSuffix)
  const agentIdBase = agentId.replace(/-[^-]+$/, "");
  for (const mem of memories) {
    if (mem.id.startsWith(`${agentIdBase}_mem`)) return mem.id;
  }

  // 3b: Prefix match using agent display name
  const agentName = agent?.name || agentId;
  const baseName = agentName.replace(/-[A-Za-z0-9]{6,}$/, "");
  for (const mem of memories) {
    if (mem.id.startsWith(`${baseName}_mem`)) return mem.id;
  }

  // 3c: Loose substring fallback
  for (const mem of memories) {
    if (mem.id.toLowerCase().includes(baseName.toLowerCase())) return mem.id;
  }

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
  if (groups.length === 0) return null;

  // Get agent name from discovery cache if not provided
  let name = agentName;
  if (!name) {
    const agents = await discoverAgents();
    const agent = agents.find((a) => a.id === agentId);
    name = agent?.name;
  }

  const baseName = (name || agentId).replace(/-[A-Za-z0-9]{6,}$/, "");

  // Strategy 1: Log group contains the full agent base name
  for (const group of groups) {
    if (group.toLowerCase().includes(baseName.toLowerCase())) return group;
  }

  // Strategy 2: Significant name parts (> 5 chars, non-generic)
  const genericWords = new Set(["agent", "runtime", "harness", "default", "service"]);
  const significantParts = baseName
    .split(/[-_]/)
    .filter((p) => p.length > 5 && !genericWords.has(p.toLowerCase()));

  for (const group of groups) {
    for (const part of significantParts) {
      if (group.toLowerCase().includes(part.toLowerCase())) return group;
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
/**
 * Supported runtime payload formats.
 * Agents can declare their format, or we'll try the most common ones.
 */
export type PayloadFormat = "prompt" | "messages" | "input_text" | "query" | "custom";

const PAYLOAD_BUILDERS: Record<string, (prompt: string, sessionId: string) => object> = {
  // Most common: simple prompt field
  prompt: (prompt) => ({ prompt }),
  // Converse-style messages array
  messages: (prompt) => ({ messages: [{ role: "user", content: [{ text: prompt }] }] }),
  // Simple input.text pattern
  input_text: (prompt) => ({ input: { text: prompt } }),
  // Query pattern (RAG agents)
  query: (prompt) => ({ query: prompt }),
};

/**
 * Build the invoke payload for a runtime agent.
 * If format is specified, use it directly. Otherwise default to "prompt".
 * The "custom" format passes the prompt as-is (for agents that expect raw JSON input from the user).
 */
function buildRuntimePayload(prompt: string, sessionId: string, format?: PayloadFormat | string): string {
  if (format === "custom") {
    // User is expected to send valid JSON as the prompt
    try { JSON.parse(prompt); return prompt; } catch { /* fall through to prompt format */ }
  }
  // Auto-detect: if prompt is already valid JSON and no explicit format, send as-is
  if (!format) {
    try { JSON.parse(prompt); return prompt; } catch { /* not JSON, use default builder */ }
  }
  const builder = PAYLOAD_BUILDERS[format || "prompt"] || PAYLOAD_BUILDERS.prompt;
  return JSON.stringify(builder(prompt, sessionId));
}

export async function invokeAgentRuntime(params: {
  agentRuntimeArn: string;
  prompt: string;
  sessionId: string;
  payloadFormat?: PayloadFormat | string;
}): Promise<ReadableStream> {
  const client = getAgentCoreClient();
  const encoder = new TextEncoder();

  const payload = buildRuntimePayload(params.prompt, params.sessionId, params.payloadFormat);

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
              // Handle various response structures from different agent frameworks
              if (parsed.result?.content) {
                // MCP/A2A style: { result: { content: [{ text: "..." }] } }
                text = parsed.result.content.map((b: { text?: string }) => b.text || "").join("");
              } else if (parsed.output?.text) {
                // Simple output style: { output: { text: "..." } }
                text = parsed.output.text;
              } else if (parsed.output?.message?.content) {
                // Converse output: { output: { message: { content: [{ text: "..." }] } } }
                text = parsed.output.message.content.map((b: { text?: string }) => b.text || "").join("");
              } else if (parsed.completion) {
                // Completion style: { completion: "..." }
                text = parsed.completion;
              } else if (parsed.response) {
                // Generic response field
                text = typeof parsed.response === "string" ? parsed.response : JSON.stringify(parsed.response, null, 2);
              } else if (parsed.answer) {
                // Q&A style: { answer: "..." }
                text = parsed.answer;
              } else if (typeof parsed === "string") {
                text = parsed;
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
