import { NextRequest, NextResponse } from "next/server";
import {
  CloudWatchLogsClient,
  StartQueryCommand,
  GetQueryResultsCommand,
} from "@aws-sdk/client-cloudwatch-logs";
import { getActiveRegion } from "@/lib/agentcore-sdk";

let logsClient: CloudWatchLogsClient | null = null;
let logsClientRegion: string | null = null;
function getLogsClient(): CloudWatchLogsClient {
  const region = getActiveRegion();
  if (!logsClient || logsClientRegion !== region) {
    logsClient = new CloudWatchLogsClient({ region });
    logsClientRegion = region;
  }
  return logsClient;
}

// In-memory cache for recently captured traces (immediate availability during streaming)
const traceCache: Map<string, TraceRecord[]> = new Map();

interface TraceRecord {
  id: string;
  event: string;
  name?: string;
  timestamp: string;
  duration?: number; // seconds
  details?: Record<string, unknown>;
}

/**
 * GET /api/agentcore/traces?session_id=xxx&agent_id=yyy
 * Queries the aws/spans log group for real OTEL trace spans for a session.
 * This shows the actual execution: model calls, tool invocations, durations, tokens.
 */
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session_id");

  if (!sessionId) {
    return NextResponse.json({ error: "session_id required" }, { status: 400 });
  }

  // Query aws/spans for the real OTEL execution trace
  try {
    const traces = await querySpansForSession(sessionId);
    if (traces.length > 0) {
      return NextResponse.json({ traces, source: "otel_spans" });
    }
  } catch (err) {
    console.error("Spans query error:", err);
  }

  // Fallback to in-memory cache (real-time traces captured during active streaming)
  const cached = traceCache.get(sessionId) || [];
  return NextResponse.json({
    traces: cached,
    source: cached.length > 0 ? "realtime_cache" : "empty",
  });
}

/**
 * POST /api/agentcore/traces
 * Cache real-time trace events (captured during streaming, before CW propagation).
 */
export async function POST(req: NextRequest) {
  const { session_id, traces } = await req.json();

  if (!session_id || !traces || !Array.isArray(traces)) {
    return NextResponse.json({ error: "session_id and traces[] required" }, { status: 400 });
  }

  const existing = traceCache.get(session_id) || [];
  existing.push(...traces);
  traceCache.set(session_id, existing);

  return NextResponse.json({ stored: true, total: existing.length });
}

/**
 * Query aws/spans log group for OTEL trace spans matching a session ID.
 * Spans have attributes.session.id that matches our session.
 * Returns structured trace showing: model calls, tool executions, event loops, with durations and tokens.
 */
async function querySpansForSession(sessionId: string): Promise<TraceRecord[]> {
  const client = getLogsClient();
  const endTime = Math.floor(Date.now() / 1000);
  const startTime = endTime - 30 * 24 * 60 * 60; // Last 30 days

  // Query all spans that reference this session ID
  const query = `fields @message | filter @message like "${sessionId}" | sort @timestamp asc | limit 200`;

  const startRes = await client.send(
    new StartQueryCommand({
      logGroupName: "aws/spans",
      startTime,
      endTime,
      queryString: query,
    })
  );

  if (!startRes.queryId) return [];

  const results = await pollQuery(client, startRes.queryId, 12);
  if (!results || results.length === 0) return [];

  return parseSpansToTraceRecords(results);
}

/**
 * Parse raw OTEL span JSON into meaningful trace records for the UI.
 * Filters out noise (GET/PUT S3 ops, internal ops) and highlights:
 * - Model invocations (with tokens and duration)
 * - Tool executions (with duration)
 * - Event loop cycles
 * - Agent invocations (top-level)
 */
function parseSpansToTraceRecords(rows: Record<string, string>[]): TraceRecord[] {
  const traces: TraceRecord[] = [];

  for (const row of rows) {
    const msg = row["@message"];
    if (!msg) continue;

    let obj: any;
    try {
      obj = JSON.parse(msg);
    } catch {
      continue;
    }

    const name: string = obj.name || "";
    const durationNano: number = obj.durationNano || 0;
    const duration = durationNano / 1e9;
    const attrs = obj.attributes || {};
    const startTime = obj.startTimeUnixNano
      ? new Date(obj.startTimeUnixNano / 1e6).toISOString()
      : row["@timestamp"] || "";

    // Skip noisy spans
    if (name === "GET" || name === "PUT") continue;
    if (name === "InternalOperation") continue;
    if (duration < 0.01 && !name.startsWith("execute_tool")) continue;

    const id = `span_${obj.spanId || Math.random().toString(36).slice(2, 10)}`;

    // Categorize the span
    if (name.startsWith("invoke_agent")) {
      // Top-level agent invocation
      const tokensIn = attrs["gen_ai.usage.input_tokens"];
      const tokensOut = attrs["gen_ai.usage.output_tokens"];
      traces.push({
        id,
        event: "agent_invoke",
        name: `Agent Invoke (${duration.toFixed(1)}s)`,
        timestamp: startTime,
        duration,
        details: {
          model: attrs["gen_ai.request.model"],
          tokensIn,
          tokensOut,
          totalTokens: (tokensIn || 0) + (tokensOut || 0),
        },
      });
    } else if (name.startsWith("chat ") || (name === "chat" && attrs["gen_ai.system"] === "strands-agents")) {
      // Model invocation (LLM call)
      const tokensIn = attrs["gen_ai.usage.input_tokens"];
      const tokensOut = attrs["gen_ai.usage.output_tokens"];
      const model = attrs["gen_ai.request.model"] || "";
      const shortModel = model.split("/").pop()?.replace(/^us\.anthropic\./, "").replace(/-v\d.*$/, "") || model;
      const finishReason = attrs["gen_ai.response.finish_reasons"]?.[0] || "";

      // Skip the duplicate "chat" span (strands-agents emits both a raw chat and a wrapped chat)
      if (name === "chat" && attrs["gen_ai.system"] === "strands-agents") continue;

      traces.push({
        id,
        event: "model_call",
        name: `LLM: ${shortModel}`,
        timestamp: startTime,
        duration,
        details: {
          model: shortModel,
          tokensIn,
          tokensOut,
          finishReason,
          timeToFirstToken: attrs["gen_ai.server.time_to_first_token"],
        },
      });
    } else if (name.startsWith("execute_tool")) {
      // Tool execution
      const toolName = name.replace("execute_tool ", "");
      traces.push({
        id,
        event: "tool_call",
        name: `Tool: ${toolName}`,
        timestamp: startTime,
        duration,
        details: { tool: toolName },
      });
    } else if (name === "execute_event_loop_cycle") {
      // Event loop cycle (one think→act step)
      traces.push({
        id,
        event: "cycle",
        name: `Cycle (${duration.toFixed(1)}s)`,
        timestamp: startTime,
        duration,
      });
    } else if (name === "POST /invocations") {
      // Full invocation request
      traces.push({
        id,
        event: "request",
        name: `Request (${duration.toFixed(1)}s total)`,
        timestamp: startTime,
        duration,
      });
    } else if (name.startsWith("Bedrock AgentCore.")) {
      // AgentCore service calls (memory, etc.)
      const op = name.replace("Bedrock AgentCore.", "");
      if (duration >= 0.05) {
        traces.push({
          id,
          event: "service_call",
          name: `AgentCore: ${op}`,
          timestamp: startTime,
          duration,
          details: { memoryId: attrs["gen_ai.memory.id"] },
        });
      }
    } else if (name === "POST" && duration >= 0.1) {
      // Significant POST calls (MCP tool invocations via gateway)
      traces.push({
        id,
        event: "service_call",
        name: `HTTP POST (${duration.toFixed(2)}s)`,
        timestamp: startTime,
        duration,
      });
    } else if (name.startsWith("Bedrock Runtime.CountTokens")) {
      // Token counting (only if slow)
      if (duration >= 0.1) {
        traces.push({
          id,
          event: "service_call",
          name: "CountTokens",
          timestamp: startTime,
          duration,
        });
      }
    }
  }

  return traces;
}

/**
 * Poll CloudWatch Logs Insights query until complete.
 */
async function pollQuery(
  client: CloudWatchLogsClient,
  queryId: string,
  maxSeconds: number
): Promise<Record<string, string>[] | null> {
  let attempts = 0;
  while (attempts < maxSeconds) {
    await new Promise((r) => setTimeout(r, 1000));
    attempts++;

    const res = await client.send(new GetQueryResultsCommand({ queryId }));
    if (res.status === "Complete" || res.status === "Failed") {
      if (!res.results || res.results.length === 0) return null;
      return res.results.map((row) => {
        const fields: Record<string, string> = {};
        for (const f of row) {
          if (f.field && f.value) fields[f.field] = f.value;
        }
        return fields;
      });
    }
  }
  return null;
}
