// AgentCore streaming client - ported from sample-amazon-bedrock-agentcore-fullstack-webapp
// Handles SSE streaming for agent invocations

export interface TraceEvent {
  type: "trace";
  event: string;
  name?: string;
  toolUseId?: string;
  inputTokens?: number;
  outputTokens?: number;
  timestamp: string;
}

export interface StreamRequest {
  agentId: string;
  agentArn?: string;
  isHarness?: boolean;
  prompt: string;
  sessionId?: string;
  systemPrompt?: string;
  history?: Array<{ role: string; content: string }>;
  onChunk: (chunk: string) => void;
  onTrace?: (trace: TraceEvent) => void;
  onDone?: (fullResponse: string) => void;
  onError?: (error: Error) => void;
}

export interface AgentInfo {
  id: string;
  name: string;
  arn?: string;
  description?: string;
  status?: string;
  isHarness?: boolean;
  config?: { system_prompt?: string; model_id?: string; [key: string]: unknown };
}

export interface BuilderStreamRequest {
  prompt: string;
  sessionId?: string;
  onChunk: (chunk: string) => void;
  onConfig?: (config: HarnessConfig) => void;
  onDone?: (fullResponse: string) => void;
  onError?: (error: Error) => void;
}

export interface HarnessConfig {
  agent_name: string;
  model_id?: string;
  system_prompt?: string;
  tools?: string[];
  mcp_servers?: Record<string, { url: string; tools?: string[] }>;
  guardrails?: Record<string, unknown>;
  memory?: { type: string; config?: Record<string, unknown> };
}

/**
 * Stream an agent invocation via SSE
 * Routes through our Next.js API proxy at /api/agentcore/invoke
 */
export async function streamAgentInvocation(request: StreamRequest): Promise<string> {
  const response = await fetch("/api/agentcore/invoke", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      agentRuntimeArn: request.agentArn,
      agentId: request.agentId,
      isHarness: request.isHarness,
      prompt: request.prompt,
      sessionId: request.sessionId,
      systemPrompt: request.systemPrompt,
      history: request.history,
    }),
  });

  if (!response.ok) {
    const err = new Error(`Invoke failed: ${response.status} ${response.statusText}`);
    request.onError?.(err);
    throw err;
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullResponse = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6);
        if (data === "[DONE]") {
          request.onDone?.(fullResponse);
          return fullResponse;
        }
        try {
          const parsed = JSON.parse(data);
          if (parsed.type === "text" && parsed.content) {
            fullResponse += parsed.content;
            request.onChunk(parsed.content);
          } else if (parsed.type === "trace") {
            request.onTrace?.(parsed as TraceEvent);
          } else if (parsed.type === "done") {
            request.onDone?.(fullResponse);
            return fullResponse;
          } else if (typeof parsed === "string") {
            fullResponse += parsed;
            request.onChunk(parsed);
          }
        } catch {
          // Not JSON - treat as plain text chunk
          fullResponse += data;
          request.onChunk(data);
        }
      }
    }
  }

  // Handle remaining buffer
  if (buffer.startsWith("data: ")) {
    const data = buffer.slice(6);
    if (data && data !== "[DONE]") {
      try {
        const parsed = JSON.parse(data);
        if (parsed.type === "text" && parsed.content) {
          fullResponse += parsed.content;
          request.onChunk(parsed.content);
        }
      } catch {
        fullResponse += data;
        request.onChunk(data);
      }
    }
  }

  request.onDone?.(fullResponse);
  return fullResponse;
}

/**
 * Stream the builder agent chat for harness-mode agent creation
 * Routes through our Next.js API proxy at /api/agentcore/builder
 */
export async function streamBuilderChat(request: BuilderStreamRequest): Promise<string> {
  const response = await fetch("/api/agentcore/builder", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: request.prompt,
      sessionId: request.sessionId,
    }),
  });

  if (!response.ok) {
    const err = new Error(`Builder failed: ${response.status} ${response.statusText}`);
    request.onError?.(err);
    throw err;
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullResponse = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6);
        if (data === "[DONE]") {
          request.onDone?.(fullResponse);
          return fullResponse;
        }
        try {
          const parsed = JSON.parse(data);
          if (parsed.type === "text" && parsed.content) {
            fullResponse += parsed.content;
            request.onChunk(parsed.content);
          } else if (parsed.type === "config" && parsed.content) {
            request.onConfig?.(parsed.content as HarnessConfig);
          } else if (parsed.type === "done") {
            request.onDone?.(fullResponse);
            return fullResponse;
          }
        } catch {
          fullResponse += data;
          request.onChunk(data);
        }
      }
    }
  }

  request.onDone?.(fullResponse);
  return fullResponse;
}

/**
 * Parse harness config from markdown code blocks in builder response
 */
export function parseHarnessConfig(text: string): HarnessConfig | null {
  const configMatch = text.match(/```(?:agent-config|json|yaml)\n([\s\S]*?)```/);
  if (!configMatch) return null;

  try {
    return JSON.parse(configMatch[1]) as HarnessConfig;
  } catch {
    return null;
  }
}

/**
 * List available agents from AgentCore
 */
export async function listAgentCoreAgents(): Promise<AgentInfo[]> {
  const response = await fetch("/api/agentcore/agents");
  if (!response.ok) return [];
  return response.json();
}

/**
 * Deploy a harness config as a new agent
 */
export async function deployHarnessAgent(config: HarnessConfig): Promise<{ agentId: string; status: string }> {
  const response = await fetch("/api/agentcore/deploy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });

  if (!response.ok) {
    throw new Error(`Deploy failed: ${response.status}`);
  }
  return response.json();
}
