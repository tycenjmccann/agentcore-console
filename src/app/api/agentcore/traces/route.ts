import { NextRequest, NextResponse } from "next/server";
import {
  DescribeLogStreamsCommand,
  GetLogEventsCommand,
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
 * Uses DescribeLogStreams + GetLogEvents (works without StartQuery/FilterLogEvents permissions).
 * Filters for log lines mentioning the session ID when possible.
 */
async function queryAgentRuntimeLogs(agentId: string, sessionId: string, region: string): Promise<TraceRecord[]> {
  const logGroup = await findLogGroupForAgent(agentId, undefined, region);
  if (!logGroup) return [];

  const client = getLogsClient(region);

  const streamsRes = await client.send(
    new DescribeLogStreamsCommand({
      logGroupName: logGroup,
      orderBy: "LastEventTime",
      descending: true,
      limit: 5,
    })
  );

  const streams = (streamsRes.logStreams || []).filter((s) => s.logStreamName);
  if (streams.length === 0) return [];

  const allTraces: TraceRecord[] = [];

  for (const stream of streams.slice(0, 3)) {
    const eventsRes = await client.send(
      new GetLogEventsCommand({
        logGroupName: logGroup,
        logStreamName: stream.logStreamName!,
        limit: 100,
        startFromHead: false,
      })
    );

    for (const event of eventsRes.events || []) {
      const msg = (event.message || "").trim();
      if (!msg) continue;

      // Filter to lines mentioning the session ID if it appears in any line
      const sessionPresent = allTraces.some((t) => t.name?.includes(sessionId));
      if (sessionPresent && !msg.includes(sessionId)) continue;

      allTraces.push({
        id: `log_${event.timestamp}_${Math.random().toString(36).slice(2, 8)}`,
        event: categorizeLogLine(msg),
        name: msg.length > 140 ? msg.slice(0, 140) + "\u2026" : msg,
        timestamp: new Date(event.timestamp || 0).toISOString(),
      });
    }
  }

  // Sort chronologically
  allTraces.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  return allTraces;
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
