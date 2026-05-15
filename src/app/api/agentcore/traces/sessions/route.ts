import { NextRequest, NextResponse } from "next/server";
import {
  StartQueryCommand,
  GetQueryResultsCommand,
} from "@aws-sdk/client-cloudwatch-logs";
import { getLogsClient, DEFAULT_REGION } from "@/lib/agentcore-sdk";

/**
 * GET /api/agentcore/traces/sessions?agent_id=xxx
 * Discovers sessions from OTEL trace data (aws/spans).
 * Strategy 1: Group by session.id (runtime agents, or harness agents with baggage set)
 * Strategy 2: Group by traceId (fallback — each traceId = one invocation)
 */
export async function GET(req: NextRequest) {
  const region = req.headers.get("x-aws-region") || DEFAULT_REGION;
  const agentId = req.nextUrl.searchParams.get("agent_id");

  if (!agentId) {
    return NextResponse.json({ error: "agent_id required" }, { status: 400 });
  }

  const agentIdBase = agentId.replace(/-[A-Za-z0-9]{6,}$/, "");

  // Strategy 1: Query by session.id (preferred — correlates multi-turn conversations)
  try {
    const sessions = await queryBySessionId(agentIdBase, region);
    if (sessions.length > 0) {
      return NextResponse.json({ sessions, groupedBy: "session.id" });
    }
  } catch {
    // aws/spans not available or query failed
  }

  // Strategy 2: Fall back to traceId grouping (each trace = one invocation)
  try {
    const sessions = await queryByTraceId(agentIdBase, region);
    if (sessions.length > 0) {
      return NextResponse.json({ sessions, groupedBy: "traceId" });
    }
  } catch {
    // Query failed
  }

  return NextResponse.json({ sessions: [], groupedBy: "none" });
}

/**
 * Find distinct session.id values for an agent.
 * Works when the agent (or platform) sets session.id on spans.
 */
async function queryBySessionId(agentIdBase: string, region: string) {
  const client = getLogsClient(region);
  const endTime = Date.now();
  const startTime = endTime - 14 * 24 * 60 * 60 * 1000;

  const startRes = await client.send(new StartQueryCommand({
    logGroupName: "aws/spans",
    startTime: Math.floor(startTime / 1000),
    endTime: Math.floor(endTime / 1000),
    queryString: `fields @timestamp, attributes.session.id as sessionId
      | filter @message like "${agentIdBase}"
      | filter ispresent(attributes.session.id)
      | stats min(@timestamp) as firstSeen, max(@timestamp) as lastSeen, count(*) as spanCount by sessionId
      | sort lastSeen desc
      | limit 50`,
  }));

  if (!startRes.queryId) return [];
  return pollResults(client, startRes.queryId, (fields) => {
    const sessionId = fields["sessionId"];
    if (!sessionId) return null;
    return {
      sessionId,
      createdAt: fields["firstSeen"] || fields["lastSeen"] || new Date().toISOString(),
      spanCount: parseInt(fields["spanCount"] || "0", 10),
      source: "otel_session" as const,
    };
  });
}

/**
 * Fall back to grouping by traceId when session.id isn't populated.
 * Each traceId represents one agent invocation.
 * Only returns traces with >2 spans (filters out trivial SDK calls).
 */
async function queryByTraceId(agentIdBase: string, region: string) {
  const client = getLogsClient(region);
  const endTime = Date.now();
  const startTime = endTime - 14 * 24 * 60 * 60 * 1000;

  const startRes = await client.send(new StartQueryCommand({
    logGroupName: "aws/spans",
    startTime: Math.floor(startTime / 1000),
    endTime: Math.floor(endTime / 1000),
    queryString: `fields @timestamp, traceId
      | filter @message like "${agentIdBase}"
      | stats min(@timestamp) as firstSeen, max(@timestamp) as lastSeen, count(*) as spanCount by traceId
      | filter spanCount > 1
      | sort lastSeen desc
      | limit 50`,
  }));

  if (!startRes.queryId) return [];
  return pollResults(client, startRes.queryId, (fields) => {
    const traceId = fields["traceId"];
    if (!traceId) return null;
    return {
      sessionId: traceId,
      createdAt: fields["firstSeen"] || fields["lastSeen"] || new Date().toISOString(),
      spanCount: parseInt(fields["spanCount"] || "0", 10),
      source: "otel_trace" as const,
    };
  });
}

/**
 * Poll a CloudWatch Logs Insights query for results (max 6s).
 */
async function pollResults<T>(
  client: ReturnType<typeof getLogsClient>,
  queryId: string,
  mapRow: (fields: Record<string, string>) => T | null,
): Promise<T[]> {
  for (let i = 0; i < 12; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const results = await client.send(new GetQueryResultsCommand({ queryId }));

    if (results.status === "Complete" || results.status === "Cancelled" || results.status === "Failed") {
      if (!results.results || results.results.length === 0) return [];

      return results.results
        .map((row) => {
          const fields: Record<string, string> = {};
          for (const f of row) {
            if (f.field && f.value) fields[f.field] = f.value;
          }
          return mapRow(fields);
        })
        .filter((s): s is NonNullable<T> => s !== null);
    }
  }

  return [];
}
