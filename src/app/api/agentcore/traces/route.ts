import { NextRequest, NextResponse } from "next/server";
import {
  CloudWatchLogsClient,
  StartQueryCommand,
  GetQueryResultsCommand,
} from "@aws-sdk/client-cloudwatch-logs";
import { findLogGroupForAgent } from "@/lib/agentcore-sdk";

const REGION = process.env.AWS_REGION || "us-east-1";

let logsClient: CloudWatchLogsClient | null = null;
function getLogsClient(): CloudWatchLogsClient {
  if (!logsClient) logsClient = new CloudWatchLogsClient({ region: REGION });
  return logsClient;
}

// In-memory cache for recently captured traces (immediate availability)
const traceCache: Map<string, TraceRecord[]> = new Map();

interface TraceRecord {
  id: string;
  event: string;
  name?: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

/**
 * GET /api/agentcore/traces?session_id=xxx&agent_id=yyy
 * Queries CloudWatch Logs for OTEL trace data associated with a session.
 * Falls back to in-memory cache for recently captured real-time traces.
 */
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session_id");
  const agentId = req.nextUrl.searchParams.get("agent_id");

  if (!sessionId) {
    return NextResponse.json({ error: "session_id required" }, { status: 400 });
  }

  // Try CloudWatch Logs first (dynamically discover log group for agent)
  if (agentId) {
    const logGroup = await findLogGroupForAgent(agentId);
    if (logGroup) {
      try {
        const traces = await querySessionTraces(logGroup, sessionId);
        if (traces.length > 0) {
          return NextResponse.json({ traces, source: "cloudwatch_otel" });
        }
      } catch (err) {
        console.error("CloudWatch traces query error:", err);
      }
    }
  }

  // Fallback to in-memory cache (real-time traces captured during streaming)
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
 * Query CloudWatch Logs Insights for OTEL trace data matching a session ID.
 * AgentCore logs include the sessionId in plain text entries and trace_id in OTEL records.
 *
 * Strategy:
 * 1. Find the traceId associated with this session
 * 2. Query all structured log entries for that traceId
 * 3. Parse into meaningful trace events
 */
async function querySessionTraces(logGroup: string, sessionId: string): Promise<TraceRecord[]> {
  const client = getLogsClient();
  const endTime = Math.floor(Date.now() / 1000);
  const startTime = endTime - 24 * 60 * 60; // Last 24 hours

  // Query: find all log entries that mention this session ID OR its associated trace
  // The session ID appears in JSON log entries like {"sessionId": "sess_xxx"}
  // The corresponding OTEL logs share the same timestamp window and trace_id
  const query = `
    fields @timestamp, @message
    | filter @message like "${sessionId}"
    | sort @timestamp asc
    | limit 200
  `;

  const startRes = await client.send(
    new StartQueryCommand({
      logGroupName: logGroup,
      startTime,
      endTime,
      queryString: query,
    })
  );

  if (!startRes.queryId) return [];

  // Poll for results (max 8 seconds)
  let results = await pollQueryResults(client, startRes.queryId, 8);
  if (!results || results.length === 0) return [];

  // Extract the traceId from the results
  // It can appear as JSON field "traceId":"xxx" or plain text [trace_id=xxx]
  let traceId: string | null = null;
  for (const row of results) {
    const msg = row["@message"] || "";

    // Try JSON field: "traceId":"<hex32>"
    const jsonMatch = msg.match(/"traceId"\s*:\s*"([a-f0-9]{32})"/);
    if (jsonMatch && jsonMatch[1] !== "0".repeat(32)) {
      traceId = jsonMatch[1];
      break;
    }

    // Try plain text: [trace_id=<hex32> ...]
    const plainMatch = msg.match(/trace_id=([a-f0-9]{32})/);
    if (plainMatch && plainMatch[1] !== "0".repeat(32)) {
      traceId = plainMatch[1];
      break;
    }
  }

  if (!traceId) {
    // No traceId found — return what we have as basic events
    return parseBasicLogEvents(results);
  }

  // Now query ALL entries for this traceId to get the full execution trace
  const fullQuery = `
    fields @timestamp, @message
    | filter @message like "${traceId}"
    | sort @timestamp asc
    | limit 200
  `;

  const fullRes = await client.send(
    new StartQueryCommand({
      logGroupName: logGroup,
      startTime,
      endTime,
      queryString: fullQuery,
    })
  );

  if (!fullRes.queryId) return parseBasicLogEvents(results);

  const fullResults = await pollQueryResults(client, fullRes.queryId, 8);
  if (!fullResults || fullResults.length === 0) return parseBasicLogEvents(results);

  return parseOtelLogEvents(fullResults, traceId);
}

/**
 * Poll CW Logs Insights for results
 */
async function pollQueryResults(
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

/**
 * Parse OTEL structured log entries into trace records.
 * Extracts meaningful events like tool calls, model invocations, MCP connections.
 */
function parseOtelLogEvents(rows: Record<string, string>[], traceId: string): TraceRecord[] {
  const traces: TraceRecord[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const ts = row["@timestamp"] || "";
    const msg = row["@message"] || "";

    // Each @message may have tab-separated parts (plain text + JSON OTEL record)
    // We prefer JSON records (richer). If no JSON found, fall back to plain text.
    const parts = msg.split("\t");
    let handled = false;

    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed.startsWith("{")) continue;

      try {
        const obj = JSON.parse(trimmed);
        const body: string = obj.body || obj.message || "";
        const scope: string = obj.scope?.name || "";

        // Only include entries matching our traceId
        if (obj.traceId && obj.traceId !== traceId) continue;

        if (!body || body.length < 5) continue;

        // Deduplicate by body content
        const dedupeKey = body.slice(0, 100);
        if (seen.has(dedupeKey)) { handled = true; continue; }
        seen.add(dedupeKey);

        const record = categorizeLogEvent(body, scope, ts, obj);
        if (record) traces.push(record);
        handled = true;
      } catch {
        /* not valid JSON */
      }
    }

    // Fallback: plain text log line with trace context
    if (!handled) {
      for (const part of parts) {
        const trimmed = part.trim();
        if (trimmed.includes(`trace_id=${traceId}`) && trimmed.includes("] - ")) {
          const logBody = trimmed.split("] - ").pop() || "";
          const dedupeKey = logBody.slice(0, 100);
          if (seen.has(dedupeKey)) continue;
          seen.add(dedupeKey);

          const record = categorizeLogEvent(logBody, "runtime", ts, null);
          if (record) traces.push(record);
        }
      }
    }
  }

  return traces;
}

/**
 * Categorize a log event body into a meaningful trace event type
 */
function categorizeLogEvent(
  body: string,
  scope: string,
  timestamp: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw: any
): TraceRecord | null {
  const lower = body.toLowerCase();
  const id = `otel_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // HTTP requests (MCP, Bedrock, etc.)
  if (lower.includes("http request:") || (lower.includes("mcp") && lower.includes("http"))) {
    const urlMatch = body.match(/(?:POST|GET)\s+(https?:\/\/[^\s"]+)/);
    const statusMatch = body.match(/"HTTP\/[\d.]+ (\d+)\s*([^"]*)?"/);
    const host = urlMatch ? (() => { try { return new URL(urlMatch[1]).hostname.split(".")[0]; } catch { return "service"; } })() : "service";
    const method = body.match(/(POST|GET)/)?.[1] || "REQ";
    const status = statusMatch?.[1] || "";
    const statusText = statusMatch?.[2] || "";
    return {
      id,
      event: "tool_start",
      name: `${method} ${host} → ${status} ${statusText}`.trim(),
      timestamp,
      details: { scope, url: urlMatch?.[1], status, statusText },
    };
  }

  // MCP protocol negotiation
  if (lower.includes("negotiated protocol")) {
    return {
      id,
      event: "tool_start",
      name: `MCP Protocol ${body.match(/version:\s*(.+)/)?.[1] || "connected"}`,
      timestamp,
      details: { scope },
    };
  }

  // Tool provider / allowed tools
  if (lower.includes("allowedtools") || lower.includes("tool_provider")) {
    return {
      id,
      event: "tool_start",
      name: body.slice(0, 80),
      timestamp,
      details: { scope },
    };
  }

  // Conversation manager
  if (lower.includes("conversation_manager") || lower.includes("sliding_window")) {
    return {
      id,
      event: "message_start",
      name: `Context: ${body.slice(0, 80)}`,
      timestamp,
      details: { scope },
    };
  }

  // Streaming response
  if (lower.includes("streaming response") || lower.includes("returning")) {
    return {
      id,
      event: "response",
      name: body.slice(0, 80),
      timestamp,
      details: { scope, sessionId: raw?.sessionId, requestId: raw?.requestId },
    };
  }

  // Model / LLM calls
  if (lower.includes("bedrock") || lower.includes("converse") || lower.includes("model")) {
    return {
      id,
      event: "message_start",
      name: body.slice(0, 100),
      timestamp,
      details: { scope },
    };
  }

  // Strands metrics
  if (scope.includes("strands") || lower.includes("metricsclient")) {
    return {
      id,
      event: "usage",
      name: body.slice(0, 80),
      timestamp,
      details: { scope },
    };
  }

  // Skip noisy/uninformative entries
  if (lower.includes("credentials") || lower.includes("iam role")) return null;
  if (lower.includes("attempting to instrument")) return null;
  if (lower.includes("skipping installation")) return null;

  // Generic: include anything with a meaningful scope
  if (scope && body.length > 10) {
    return {
      id,
      event: "trace",
      name: `[${scope.split(".").pop()}] ${body.slice(0, 100)}`,
      timestamp,
      details: { scope },
    };
  }

  return null;
}

/**
 * Parse basic log events when we don't have a traceId
 */
function parseBasicLogEvents(rows: Record<string, string>[]): TraceRecord[] {
  const traces: TraceRecord[] = [];

  for (const row of rows) {
    const ts = row["@timestamp"] || "";
    const msg = row["@message"] || "";

    const parts = msg.split("\t");
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.startsWith("{")) {
        try {
          const obj = JSON.parse(trimmed);
          const body = obj.body || obj.message || "";
          if (body) {
            traces.push({
              id: `basic_${traces.length}`,
              event: "trace",
              name: body.slice(0, 120),
              timestamp: ts,
            });
          }
        } catch {
          /* skip */
        }
      }
    }
  }

  return traces;
}
