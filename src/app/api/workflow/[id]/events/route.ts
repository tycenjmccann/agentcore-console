/**
 * GET /api/workflow/[id]/events — Fetch ALL events for a workflow (for replay)
 *
 * Returns events as a JSON array, ordered by eventId (timestamp-based).
 * Used by the frontend to replay completed workflows with a scrubber.
 */

import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

export const dynamic = "force-dynamic";

const REGION = process.env.AWS_REGION || "us-east-1";
const EVENTS_TABLE = process.env.EVENTS_TABLE || "agentis-events";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
  marshallOptions: { removeUndefinedValues: true },
});

function transformEvent(item: Record<string, unknown>): Record<string, unknown> | null {
  const eventType = item.type as string;
  const detail = (item.detail || {}) as Record<string, unknown>;
  const agentId = detail.agentId as string;
  const timestamp = item.timestamp as string;
  const eventId = item.eventId as string | undefined;

  switch (eventType) {
    case "agent.streaming": {
      const subType = detail.type as string;
      if (subType === "text") {
        return { type: "agent_output", agentId, chunk: detail.content, timestamp, eventId };
      }
      if (subType === "trace") {
        return { type: "tool_use", agentId, toolName: detail.toolName, timestamp, eventId };
      }
      return null;
    }
    case "agent.complete":
      return { type: "agent_complete", agentId, output: detail.output, branch: detail.branch, commitSha: detail.commitSha, timestamp, eventId };
    case "agent.error":
      return { type: "error", agentId, error: detail.error, timestamp, eventId };
    case "agent.started":
    case "agent.invoked":
      return { type: "agent_status", agentId: agentId || detail.assignee as string, status: "running", timestamp, eventId };
    case "workflow.phase_change":
      return { type: "phase_change", phase: detail.phase, timestamp, eventId };
    case "workflow.complete":
      return { type: "workflow_complete", timestamp, eventId };
    case "workflow.nudge":
      return { type: "nudge", nudged: detail.nudged, ticketsScanned: detail.ticketsScanned, timestamp, eventId };
    default:
      return { type: eventType, ...detail, timestamp, eventId };
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const workflowId = params.id;
  const allEvents: Record<string, unknown>[] = [];
  let lastKey: Record<string, unknown> | undefined;

  // Paginate through all events
  do {
    const result = await ddb.send(new QueryCommand({
      TableName: EVENTS_TABLE,
      KeyConditionExpression: "workflowId = :wid",
      ExpressionAttributeValues: { ":wid": workflowId },
      ScanIndexForward: true,
      ExclusiveStartKey: lastKey,
    }));

    for (const item of result.Items || []) {
      const transformed = transformEvent(item);
      if (transformed) {
        allEvents.push(transformed);
      }
    }
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  return NextResponse.json({ events: allEvents, count: allEvents.length }, {
    headers: { "Cache-Control": "no-store" },
  });
}
