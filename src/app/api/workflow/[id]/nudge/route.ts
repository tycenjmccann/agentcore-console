/**
 * POST /api/workflow/[id]/nudge
 *
 * Lightweight "unstick" endpoint. Scans tickets for the workflow and fixes:
 * 1. Tickets stuck at "todo" with empty blockedBy (stream event was missed)
 * 2. Tickets stuck at "blocked" whose blockers are already "done"
 *
 * Fixes them by re-writing status to trigger a fresh DynamoDB Stream event,
 * which the orchestrator will pick up and invoke the agent.
 */

import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

const REGION = process.env.AWS_REGION || "us-east-1";
const TICKETS_TABLE = process.env.JIRA_TABLE_NAME || "agentis-tickets";
const WORKFLOWS_TABLE = process.env.WORKFLOWS_TABLE || "agentis-workflows";
const EVENTS_TABLE = process.env.EVENTS_TABLE || "agentis-events";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
  marshallOptions: { removeUndefinedValues: true },
});

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const workflowId = params.id;

  // Verify workflow exists
  const wfResult = await ddb.send(new GetCommand({
    TableName: WORKFLOWS_TABLE,
    Key: { workflowId },
  }));
  if (!wfResult.Item) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }

  // Get all tickets for this workflow
  const result = await ddb.send(new ScanCommand({
    TableName: TICKETS_TABLE,
    FilterExpression: "workflowId = :wid",
    ExpressionAttributeValues: { ":wid": workflowId },
  }));
  const tickets = (result.Items || []).filter(t => t.ticketId !== "__COUNTER__");

  // Build status lookup
  const statusMap = new Map(tickets.map(t => [t.ticketId, t.status]));
  const nudged: string[] = [];

  for (const ticket of tickets) {
    const { ticketId, status, blockedBy, assignee } = ticket;
    if (!assignee) continue;

    // Case 1: "todo" with no blockers — should be running. Kick it.
    if (status === "todo" && (!blockedBy || blockedBy.length === 0)) {
      await ddb.send(new UpdateCommand({
        TableName: TICKETS_TABLE,
        Key: { ticketId },
        UpdateExpression: "SET #s = :s, #u = :u",
        ExpressionAttributeNames: { "#s": "status", "#u": "updatedAt" },
        ExpressionAttributeValues: { ":s": "ready", ":u": new Date().toISOString() },
      }));
      nudged.push(`${ticketId} (todo→ready)`);
    }

    // Case 2: "blocked" but all blockers are done (or no blockers at all) — unblock it.
    if (status === "blocked") {
      const hasBlockers = blockedBy && blockedBy.length > 0;
      const allBlockersDone = !hasBlockers || blockedBy.every(
        (blockerId: string) => statusMap.get(blockerId) === "done"
      );
      if (allBlockersDone) {
        await ddb.send(new UpdateCommand({
          TableName: TICKETS_TABLE,
          Key: { ticketId },
          UpdateExpression: "SET #s = :s, #bb = :bb, #u = :u",
          ExpressionAttributeNames: { "#s": "status", "#bb": "blockedBy", "#u": "updatedAt" },
          ExpressionAttributeValues: { ":s": "ready", ":bb": [], ":u": new Date().toISOString() },
        }));
        nudged.push(`${ticketId} (${hasBlockers ? "unblocked" : "blocked-no-blockers"}→ready)`);
      }
    }

    // Case 3: "in_progress" but nothing is happening — reset it.
    if (status === "in_progress") {
      await ddb.send(new UpdateCommand({
        TableName: TICKETS_TABLE,
        Key: { ticketId },
        UpdateExpression: "SET #s = :s, #u = :u",
        ExpressionAttributeNames: { "#s": "status", "#u": "updatedAt" },
        ExpressionAttributeValues: { ":s": "ready", ":u": new Date().toISOString() },
      }));
      nudged.push(`${ticketId} (in_progress→ready)`);
    }
  }

  // Write nudge event to events table (for replay history)
  if (nudged.length > 0) {
    await ddb.send(new PutCommand({
      TableName: EVENTS_TABLE,
      Item: {
        workflowId,
        eventId: `${Date.now()}-nudge-${Math.random().toString(36).slice(2, 6)}`,
        type: "workflow.nudge",
        detail: { nudged, ticketsScanned: tickets.length },
        timestamp: new Date().toISOString(),
      },
    }));
  }

  return NextResponse.json({
    workflowId,
    ticketsScanned: tickets.length,
    nudged,
    message: nudged.length > 0
      ? `Fixed ${nudged.length} stuck ticket(s)`
      : "All tickets healthy — nothing to fix",
  });
}
