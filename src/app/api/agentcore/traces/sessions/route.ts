import { NextRequest, NextResponse } from "next/server";
import {
  StartQueryCommand,
  GetQueryResultsCommand,
  DescribeLogStreamsCommand,
  GetLogEventsCommand,
} from "@aws-sdk/client-cloudwatch-logs";
import { findLogGroupForAgent, getLogsClient, DEFAULT_REGION } from "@/lib/agentcore-sdk";

/**
 * GET /api/agentcore/traces/sessions?agent_id=xxx
 * Discovers sessions from OTEL trace data (aws/spans) and runtime logs.
 * Used when agents don't have memory configured but do have trace data.
 */
export async function GET(req: NextRequest) {
  const region = req.headers.get("x-aws-region") || DEFAULT_REGION;
  const agentId = req.nextUrl.searchParams.get("agent_id");

  if (!agentId) {
    return NextResponse.json({ error: "agent_id required" }, { status: 400 });
  }

  const sessions: Array<{ sessionId: string; createdAt: string; source: string }> = [];

  // Strategy 1: Query aws/spans for distinct session IDs (requires Transaction Search)
  try {
    const otelSessions = await queryOtelSessions(agentId, region);
    sessions.push(...otelSessions);
  } catch {
    // aws/spans not available or Transaction Search not enabled
  }

  // Strategy 2: Extract session-like groupings from runtime logs
  if (sessions.length === 0) {
    try {
      const logSessions = await queryRuntimeLogSessions(agentId, region);
      sessions.push(...logSessions);
    } catch {
      // Runtime logs not available
    }
  }

  // Deduplicate and sort
  const deduped = new Map<string, typeof sessions[0]>();
  for (const s of sessions) {
    if (!deduped.has(s.sessionId)) deduped.set(s.sessionId, s);
  }
  const sorted = Array.from(deduped.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return NextResponse.json({ sessions: sorted });
}

async function queryOtelSessions(agentId: string, region: string) {
  const client = getLogsClient(region);
  const endTime = Date.now();
  const startTime = endTime - 14 * 24 * 60 * 60 * 1000; // 14 days

  // Query for distinct session IDs associated with this agent
  const agentIdBase = agentId.replace(/-[A-Za-z0-9]{6,}$/, "");
  const startRes = await client.send(new StartQueryCommand({
    logGroupName: "aws/spans",
    startTime: Math.floor(startTime / 1000),
    endTime: Math.floor(endTime / 1000),
    queryString: `fields @timestamp, attributes.session_id
      | filter resource.attributes.service_name like "${agentIdBase}" or attributes.agent_id = "${agentId}"
      | stats min(@timestamp) as firstSeen, max(@timestamp) as lastSeen by attributes.session_id
      | sort lastSeen desc
      | limit 50`,
  }));

  if (!startRes.queryId) return [];

  // Poll for results (max 5s)
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const results = await client.send(new GetQueryResultsCommand({ queryId: startRes.queryId }));

    if (results.status === "Complete" || results.status === "Cancelled" || results.status === "Failed") {
      if (!results.results || results.results.length === 0) return [];

      return results.results
        .map((row) => {
          const fields: Record<string, string> = {};
          for (const f of row) {
            if (f.field && f.value) fields[f.field] = f.value;
          }
          const sessionId = fields["attributes.session_id"];
          if (!sessionId) return null;
          return {
            sessionId,
            createdAt: fields["firstSeen"] || fields["lastSeen"] || new Date().toISOString(),
            source: "otel" as const,
          };
        })
        .filter((s): s is NonNullable<typeof s> => s !== null);
    }
  }

  return [];
}

async function queryRuntimeLogSessions(agentId: string, region: string) {
  const logGroup = await findLogGroupForAgent(agentId, undefined, region);
  if (!logGroup) return [];

  const client = getLogsClient(region);

  // Get recent log streams — each stream often corresponds to an invocation/session
  const streamsRes = await client.send(new DescribeLogStreamsCommand({
    logGroupName: logGroup,
    orderBy: "LastEventTime",
    descending: true,
    limit: 20,
  }));

  const streams = (streamsRes.logStreams || []).filter((s) => s.logStreamName);
  const sessions: Array<{ sessionId: string; createdAt: string; source: string }> = [];

  // Check each stream for session IDs in log lines
  for (const stream of streams.slice(0, 10)) {
    const eventsRes = await client.send(new GetLogEventsCommand({
      logGroupName: logGroup,
      logStreamName: stream.logStreamName!,
      limit: 20,
      startFromHead: true,
    }));

    // Look for session ID patterns in log events
    const sessionIdPattern = /session[_-]?id["\s:=]+["']?([a-f0-9-]{8,}|sess_[a-z0-9]+)/i;
    for (const event of eventsRes.events || []) {
      const match = event.message?.match(sessionIdPattern);
      if (match) {
        sessions.push({
          sessionId: match[1],
          createdAt: new Date(event.timestamp || 0).toISOString(),
          source: "runtime_logs",
        });
        break; // One session ID per stream is enough
      }
    }

    // If no session ID found, use the stream name as a pseudo-session
    if (!sessions.find((s) => s.sessionId === stream.logStreamName)) {
      sessions.push({
        sessionId: stream.logStreamName!,
        createdAt: new Date(stream.lastEventTimestamp || stream.creationTime || 0).toISOString(),
        source: "runtime_logs",
      });
    }
  }

  return sessions;
}
