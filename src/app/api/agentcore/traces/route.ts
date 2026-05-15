import { NextRequest, NextResponse } from "next/server";
import {
  DescribeLogStreamsCommand,
  GetLogEventsCommand,
  StartQueryCommand,
  GetQueryResultsCommand,
} from "@aws-sdk/client-cloudwatch-logs";
import { findLogGroupForAgent, getLogsClient, DEFAULT_REGION } from "@/lib/agentcore-sdk";

// In-memory cache for recently captured traces (immediate availability during streaming)
// Bounded: max 100 entries, 5-minute TTL per entry
const TRACE_CACHE_MAX = 100;
const TRACE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  traces: TraceRecord[];
  insertedAt: number;
}

const traceCache: Map<string, CacheEntry> = new Map();

function traceCacheGet(key: string): TraceRecord[] | undefined {
  const entry = traceCache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.insertedAt > TRACE_CACHE_TTL_MS) {
    traceCache.delete(key);
    return undefined;
  }
  // Move to end for LRU ordering
  traceCache.delete(key);
  traceCache.set(key, entry);
  return entry.traces;
}

function traceCacheSet(key: string, traces: TraceRecord[]): void {
  // Delete first so re-insertion moves it to the end
  traceCache.delete(key);
  // Evict oldest entries (first in map) if at capacity
  while (traceCache.size >= TRACE_CACHE_MAX) {
    const oldest = traceCache.keys().next().value;
    if (oldest !== undefined) traceCache.delete(oldest);
    else break;
  }
  traceCache.set(key, { traces, insertedAt: Date.now() });
}

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
 * Returns execution traces for a session.
 * Priority: in-memory real-time cache → CloudWatch runtime logs for the agent.
 */
export async function GET(req: NextRequest) {
  const region = req.headers.get("x-aws-region") || DEFAULT_REGION;
  const sessionId = req.nextUrl.searchParams.get("session_id");
  const agentId = req.nextUrl.searchParams.get("agent_id");

  if (!sessionId) {
    return NextResponse.json({ error: "session_id required" }, { status: 400 });
  }

  // Check in-memory cache first (real-time traces captured during streaming)
  const cached = traceCacheGet(sessionId) || [];
  if (cached.length > 0) {
    return NextResponse.json({ traces: cached, source: "realtime_cache" });
  }

  // Fall back to CloudWatch runtime logs for the agent
  if (agentId) {
    try {
      const traces = await queryAgentRuntimeLogs(agentId, sessionId, region);
      if (traces.length > 0) {
        return NextResponse.json({ traces, source: "cloudwatch_logs" });
      }
    } catch (err) {
      console.error("CloudWatch log query error:", err);
    }
  }

  // Fall back to aws/spans OTEL log group (requires Transaction Search enabled)
  try {
    const traces = await queryOtelSpans(sessionId, region);
    if (traces.length > 0) {
      return NextResponse.json({ traces, source: "otel_spans" });
    }
  } catch (err) {
    // Transaction Search not enabled or aws/spans doesn't exist — silent fallback
    console.debug("OTEL spans query skipped:", (err as Error).message);
  }

  return NextResponse.json({ traces: [], source: "empty" });
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

  const existing = traceCacheGet(session_id) || [];
  existing.push(...traces);
  traceCacheSet(session_id, existing);

  return NextResponse.json({ stored: true, total: existing.length });
}

/**
 * Query the agent's runtime log group for recent execution logs.
 * Parses structured runtime logs into human-readable trace steps.
 * Filters out noise (streaming chunks, credential loading) and extracts
 * meaningful execution events (memory ops, model calls, tool executions).
 */
async function queryAgentRuntimeLogs(agentId: string, sessionId: string, region: string): Promise<TraceRecord[]> {
  const logGroup = await findLogGroupForAgent(agentId, undefined, region);
  if (!logGroup) return [];

  const client = getLogsClient(region);

  // Find the log stream for this session (streams are named with session ID)
  const streamsRes = await client.send(
    new DescribeLogStreamsCommand({
      logGroupName: logGroup,
      orderBy: "LastEventTime",
      descending: true,
      limit: 10,
    })
  );

  const streams = (streamsRes.logStreams || []).filter((s) => s.logStreamName);
  if (streams.length === 0) return [];

  // Prefer streams that contain the session ID in their name
  const sessionStream = streams.find((s) => s.logStreamName!.includes(sessionId));
  const targetStreams = sessionStream ? [sessionStream] : streams.slice(0, 2);

  const allTraces: TraceRecord[] = [];

  for (const stream of targetStreams) {
    const eventsRes = await client.send(
      new GetLogEventsCommand({
        logGroupName: logGroup,
        logStreamName: stream.logStreamName!,
        limit: 200,
        startFromHead: true,
      })
    );

    for (const event of eventsRes.events || []) {
      const msg = (event.message || "").trim();
      if (!msg) continue;

      const parsed = parseRuntimeLogEvent(msg, event.timestamp || 0);
      if (parsed) {
        allTraces.push(parsed);
      }
    }
  }

  // Sort chronologically
  allTraces.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  return allTraces;
}

/**
 * Parse a single runtime log event into a structured trace record.
 * Returns null for noise (streaming chunks, credential logs, etc.)
 */
function parseRuntimeLogEvent(msg: string, timestamp: number): TraceRecord | null {
  // Skip streaming text chunks (short lines that aren't timestamps or JSON)
  if (!msg.startsWith("20") && !msg.startsWith("{") && !msg.startsWith("WARNING")) {
    return null;
  }

  // Try structured JSON format: { timestamp, level, message, logger, sessionId }
  if (msg.startsWith("{")) {
    try {
      const parsed = JSON.parse(msg);

      // Skip OTEL log records (they're noise in the runtime stream)
      if (parsed.resource && parsed.scope) return null;

      if (parsed.message && parsed.logger) {
        const event = categorizeLogger(parsed.logger, parsed.message);
        if (!event) return null; // Filtered out

        return {
          id: `log_${timestamp}_${Math.random().toString(36).slice(2, 8)}`,
          event: event.type,
          name: event.name,
          timestamp: parsed.timestamp || new Date(timestamp).toISOString(),
          details: {
            logger: parsed.logger,
            level: parsed.level,
            requestId: parsed.requestId,
            sessionId: parsed.sessionId,
          },
        };
      }
    } catch {
      // Not valid JSON — fall through to text parsing
    }
  }

  // Parse Python log format: TIMESTAMP LEVEL [logger] [file:line] [trace_id=... span_id=...] - MESSAGE
  const logMatch = msg.match(
    /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3})\s+(\w+)\s+\[([^\]]+)\]\s+\[([^\]]+)\]\s+\[([^\]]+)\]\s*-?\s*(.*)/
  );

  if (logMatch) {
    const [, ts, level, logger, , , message] = logMatch;
    const event = categorizeLogger(logger, message);
    if (!event) return null;

    return {
      id: `log_${timestamp}_${Math.random().toString(36).slice(2, 8)}`,
      event: event.type,
      name: event.name,
      timestamp: new Date(ts.replace(",", ".") + "Z").toISOString(),
      details: {
        logger,
        level,
        message: message.trim(),
      },
    };
  }

  // Skip everything else (streaming chunks, warnings without context)
  return null;
}

/**
 * Categorize a log entry by its logger and message.
 * Returns null for entries that should be filtered out.
 */
function categorizeLogger(logger: string, message: string): { type: string; name: string } | null {
  const l = logger.toLowerCase();
  const m = message.toLowerCase();

  // Filter out noise
  if (l.includes("botocore.credentials")) return null;
  if (l.includes("opentelemetry.instrumentation")) return null;
  if (m.includes("found credentials")) return null;
  if (m.includes("skipping install")) return null;
  if (m.includes("attempting to instrument")) return null;

  // Memory operations
  if (l.includes("memory")) {
    if (m.includes("initialized") || m.includes("init")) {
      return { type: "service_call", name: "Memory initialized" };
    }
    if (m.includes("retrieved") || m.includes("retrieve")) {
      const countMatch = message.match(/(\d+)\s+memor/i);
      return { type: "service_call", name: countMatch ? `Retrieved ${countMatch[1]} memories` : "Memory retrieval" };
    }
    if (m.includes("created event") || m.includes("store") || m.includes("save")) {
      return { type: "service_call", name: "Stored conversation in memory" };
    }
    return { type: "service_call", name: message.length > 80 ? message.slice(0, 77) + "..." : message };
  }

  // Model/LLM calls
  if (l.includes("strands.telemetry") || l.includes("metrics")) {
    return { type: "model_call", name: "Model metrics recorded" };
  }
  if (m.includes("model") || m.includes("converse") || m.includes("invoke_model")) {
    return { type: "model_call", name: message.length > 80 ? message.slice(0, 77) + "..." : message };
  }

  // Tool execution
  if (m.includes("tool") && (m.includes("call") || m.includes("execut") || m.includes("invoke"))) {
    return { type: "tool_call", name: message.length > 80 ? message.slice(0, 77) + "..." : message };
  }

  // Application lifecycle
  if (l.includes("bedrock_agentcore.app")) {
    if (m.includes("streaming response") || m.includes("returning")) {
      return { type: "request", name: "Streaming response started" };
    }
    return { type: "internal", name: message.length > 80 ? message.slice(0, 77) + "..." : message };
  }

  // Agent event loop
  if (l.includes("strands") || l.includes("agent")) {
    if (m.includes("event_loop") || m.includes("iteration")) {
      return { type: "span", name: message.length > 80 ? message.slice(0, 77) + "..." : message };
    }
    return { type: "internal", name: message.length > 80 ? message.slice(0, 77) + "..." : message };
  }

  // Generic INFO/WARNING that passed noise filter
  return { type: "internal", name: message.length > 80 ? message.slice(0, 77) + "..." : message };
}

/**
 * Query the aws/spans OTEL log group for traces matching a session ID.
 * Requires Transaction Search to be enabled in the account.
 */
async function queryOtelSpans(sessionId: string, region: string): Promise<TraceRecord[]> {
  const client = getLogsClient(region);
  const logGroupName = "aws/spans";

  // Use CloudWatch Logs Insights to find spans for this session
  const endTime = Date.now();
  const startTime = endTime - 14 * 24 * 60 * 60 * 1000; // 14 days back

  const startRes = await client.send(new StartQueryCommand({
    logGroupName,
    startTime: Math.floor(startTime / 1000),
    endTime: Math.floor(endTime / 1000),
    queryString: `fields @timestamp, name, kind, status.code, attributes.session_id, duration
      | filter attributes.session_id = "${sessionId}" or resource.attributes.session_id = "${sessionId}"
      | sort @timestamp asc
      | limit 100`,
  }));

  if (!startRes.queryId) return [];

  // Poll for results (max 5s)
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const results = await client.send(new GetQueryResultsCommand({ queryId: startRes.queryId }));

    if (results.status === "Complete" || results.status === "Cancelled" || results.status === "Failed") {
      if (!results.results || results.results.length === 0) return [];

      return results.results.map((row, idx) => {
        const fields: Record<string, string> = {};
        for (const f of row) {
          if (f.field && f.value) fields[f.field] = f.value;
        }
        return {
          id: `otel_${idx}_${Date.now()}`,
          event: categorizeOtelSpan(fields.name || "", fields["kind"] || ""),
          name: fields.name || "span",
          timestamp: fields["@timestamp"] || new Date().toISOString(),
          duration: fields.duration ? parseFloat(fields.duration) : undefined,
          details: fields,
        };
      });
    }
  }

  return [];
}

function categorizeOtelSpan(name: string, kind: string): string {
  const n = name.toLowerCase();
  if (n.includes("tool") || n.includes("function")) return "tool_call";
  if (n.includes("model") || n.includes("llm") || n.includes("converse") || n.includes("invoke_model")) return "model_call";
  if (n.includes("memory") || n.includes("session")) return "service_call";
  if (n.includes("error") || n.includes("fail")) return "error";
  if (kind === "SERVER" || n.includes("request") || n.includes("invoke")) return "request";
  return "span";
}

function categorizeLogLine(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("error") || m.includes("exception") || m.includes("failed")) return "error";
  if (m.includes("post /invocations") || m.includes("post /invoke")) return "request";
  if (m.includes("tool") && (m.includes("calling") || m.includes("execute") || m.includes("invoke"))) return "tool_call";
  if (m.includes("model") || m.includes("llm") || m.includes("chat") || m.includes("converse")) return "model_call";
  if (m.includes("memory") || m.includes("session")) return "service_call";
  if (m.includes("warning") || m.includes("warn")) return "span";
  return "internal";
}
