import { NextRequest, NextResponse } from "next/server";
import {
  StartQueryCommand,
  GetQueryResultsCommand,
} from "@aws-sdk/client-cloudwatch-logs";
import { getLogsClient, DEFAULT_REGION } from "@/lib/agentcore-sdk";

// In-memory cache for recently captured traces (immediate availability during streaming)
// Bounded: max 100 entries, 5-minute TTL per entry
const TRACE_CACHE_MAX = 100;
const TRACE_CACHE_TTL_MS = 5 * 60 * 1000;

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
  traceCache.delete(key);
  traceCache.set(key, entry);
  return entry.traces;
}

function traceCacheSet(key: string, traces: TraceRecord[]): void {
  traceCache.delete(key);
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
  name: string;
  timestamp: string;
  duration?: number; // seconds
  details?: Record<string, unknown>;
}

/**
 * GET /api/agentcore/traces?session_id=xxx
 * Returns OTEL trace spans for a session from aws/spans.
 * Shows all spans — tool calls, model calls, service calls, lifecycle events.
 */
export async function GET(req: NextRequest) {
  const region = req.headers.get("x-aws-region") || DEFAULT_REGION;
  const sessionId = req.nextUrl.searchParams.get("session_id");

  if (!sessionId) {
    return NextResponse.json({ error: "session_id required" }, { status: 400 });
  }

  // Check in-memory cache first (real-time traces captured during streaming)
  const cached = traceCacheGet(sessionId);
  if (cached && cached.length > 0) {
    return NextResponse.json({ traces: cached, source: "realtime_cache" });
  }

  // Query OTEL spans from aws/spans (Transaction Search log group — all spans land here)
  try {
    const traces = await queryOtelSpans(sessionId, region);
    if (traces.length > 0) {
      return NextResponse.json({ traces, source: "otel_spans" });
    }
  } catch (err) {
    console.error("OTEL spans query error:", (err as Error).message);
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
 * Query aws/spans OTEL log group for all trace spans matching a session ID.
 * Returns every span — no aggressive filtering. The UI handles presentation.
 * Requires Transaction Search to be enabled in the account.
 */
async function queryOtelSpans(sessionId: string, region: string): Promise<TraceRecord[]> {
  const client = getLogsClient(region);

  const endTime = Date.now();
  const startTime = endTime - 14 * 24 * 60 * 60 * 1000; // 14 days back

  const startRes = await client.send(new StartQueryCommand({
    logGroupName: "aws/spans",
    startTime: Math.floor(startTime / 1000),
    endTime: Math.floor(endTime / 1000),
    queryString: `fields @timestamp, name, kind, durationNano,
        attributes.session.id as sessionId,
        attributes.gen_ai.tool.name as toolName,
        attributes.gen_ai.tool.status as toolStatus,
        attributes.gen_ai.tool.description as toolDescription,
        attributes.gen_ai.operation.name as operation,
        status.code as statusCode
      | filter @message like "${sessionId}"
      | filter name not like "InternalOperation"
      | filter name != "GET" and name != "PUT" and name != "POST" and name != "DELETE"
      | filter name not like "CountTokens"
      | filter kind != "CLIENT"
      | sort @timestamp asc
      | limit 200`,
  }));

  if (!startRes.queryId) return [];

  // Poll for results (max 6s)
  for (let i = 0; i < 12; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const results = await client.send(new GetQueryResultsCommand({ queryId: startRes.queryId }));

    if (results.status === "Complete" || results.status === "Cancelled" || results.status === "Failed") {
      if (!results.results || results.results.length === 0) return [];

      return results.results.map((row, idx) => {
        const fields: Record<string, string> = {};
        for (const f of row) {
          if (f.field && f.value) fields[f.field] = f.value;
        }

        const durationSec = fields.durationNano
          ? parseFloat(fields.durationNano) / 1_000_000_000
          : undefined;

        const spanName = fields.name || "span";
        const displayName = formatSpanName(spanName, fields);
        const eventType = categorizeSpan(spanName, fields);

        return {
          id: `otel_${idx}_${Date.now()}`,
          event: eventType,
          name: displayName,
          timestamp: fields["@timestamp"] || new Date().toISOString(),
          duration: durationSec,
          details: {
            spanName,
            kind: fields.kind,
            operation: fields.operation,
            statusCode: fields.statusCode,
            toolName: fields.toolName,
            toolStatus: fields.toolStatus,
            toolDescription: fields.toolDescription,
          },
        };
      });
    }
  }

  return [];
}

/**
 * Format a span name for display. Keeps it readable without losing info.
 */
function formatSpanName(name: string, fields: Record<string, string>): string {
  // Tool execution spans
  if (fields.toolName) {
    return `Tool: ${fields.toolName}${fields.toolStatus ? ` (${fields.toolStatus})` : ""}`;
  }
  if (name.startsWith("execute_tool ")) {
    return `Tool: ${name.replace("execute_tool ", "")}`;
  }

  // Model/chat spans — show model ID cleanly
  if (name.startsWith("chat ")) {
    const model = name.replace("chat ", "");
    // Shorten model IDs like "us.anthropic.claude-sonnet-4-20250514-v1:0"
    const shortModel = model.replace(/^(us|eu|ap)\.\w+\./, "").replace(/-v\d+:\d+$/, "");
    return `Model: ${shortModel}`;
  }
  if (name === "chat") {
    return "Model call";
  }

  // Agent lifecycle
  if (name === "execute_event_loop_cycle") return "Agent event loop cycle";
  if (name.startsWith("invoke_agent")) return `Invoke: ${name.replace("invoke_agent ", "")}`;
  if (name === "POST /invocations") return "Agent invocation";

  // AWS service calls
  if (name.startsWith("Bedrock AgentCore.")) {
    return name.replace("Bedrock AgentCore.", "AgentCore: ");
  }
  if (name.startsWith("Bedrock Runtime.")) {
    return name.replace("Bedrock Runtime.", "Bedrock: ");
  }
  if (name.startsWith("DynamoDB.")) return name;
  if (name.startsWith("CloudWatch Logs.")) return name;

  return name;
}

/**
 * Categorize a span for UI badge/icon. Lightweight — just identifies the type.
 */
function categorizeSpan(name: string, fields: Record<string, string>): string {
  const n = name.toLowerCase();

  // Tool calls
  if (fields.toolName || n.startsWith("execute_tool")) return "tool_call";

  // Model/LLM calls
  if (n.startsWith("chat")) return "model_call";

  // Agent invocations
  if (n.includes("invoke_agent") || n === "post /invocations") return "request";

  // Memory/AgentCore service calls
  if (n.includes("createevent") || n.includes("retrievememory") || n.includes("listevents")) return "service_call";
  if (n.includes("agentcore")) return "service_call";

  // Bedrock runtime calls (token counting etc)
  if (n.includes("bedrock runtime")) return "service_call";

  // DynamoDB / external service calls
  if (n.startsWith("dynamodb.") || n.startsWith("cloudwatch")) return "service_call";

  // Event loop
  if (n.includes("event_loop")) return "span";

  // Errors (only if not already categorized above)
  if (fields.statusCode === "ERROR") return "error";

  // HTTP methods (internal SDK calls)
  if (n === "get" || n === "put" || n === "post" || n === "delete") return "internal";
  if (n === "internaloperation") return "internal";

  // Token counting
  if (n.includes("counttokens")) return "internal";

  return "span";
}
