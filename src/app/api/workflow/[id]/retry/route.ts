/**
 * POST /api/workflow/[id]/retry
 *
 * Restarts a stuck/failed agent with session resume context.
 *
 * When an agent crashes or times out (detected by the 6-min stale timer),
 * this endpoint:
 * 1. Queries the agent's prior tool events from agentis-events
 * 2. Checks for prior output in S3
 * 3. Resets the ticket to "ready" with a resumeContext field
 * 4. The orchestrator picks it up via DDB Stream and prepends resume preamble to the prompt
 *
 * Body: { agentId: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { S3Client, HeadObjectCommand } from "@aws-sdk/client-s3";

const REGION = process.env.AWS_REGION || "us-east-1";
const TICKETS_TABLE = process.env.JIRA_TABLE_NAME || "agentis-tickets";
const WORKFLOWS_TABLE = process.env.WORKFLOWS_TABLE || "agentis-workflows";
const EVENTS_TABLE = process.env.EVENTS_TABLE || "agentis-events";
const ARTIFACT_BUCKET = process.env.ARTIFACT_BUCKET || "";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
  marshallOptions: { removeUndefinedValues: true },
});
const s3 = new S3Client({ region: REGION });

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const workflowId = params.id;
  const { agentId } = await req.json();

  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }

  // 1. Find the ticket for this agent in this workflow
  const ticketResult = await ddb.send(new ScanCommand({
    TableName: TICKETS_TABLE,
    FilterExpression: "workflowId = :wid AND assignee = :aid",
    ExpressionAttributeValues: { ":wid": workflowId, ":aid": agentId },
  }));

  const ticket = ticketResult.Items?.find(t => t.status === "in_progress" || t.status === "error" || t.status === "blocked");
  if (!ticket) {
    return NextResponse.json({ error: "No stuck ticket found for this agent" }, { status: 404 });
  }

  const ticketId = ticket.ticketId;

  // 2. Query recent tool events for this agent (last 10 for context summary)
  const eventsResult = await ddb.send(new QueryCommand({
    TableName: EVENTS_TABLE,
    KeyConditionExpression: "workflowId = :wid",
    FilterExpression: "agentId = :aid",
    ExpressionAttributeValues: { ":wid": workflowId, ":aid": agentId },
    ScanIndexForward: false, // newest first
    Limit: 50,
  }));

  const toolEvents = (eventsResult.Items || [])
    .filter(e => e.type === "agent.streaming" && e.detail?.type === "trace")
    .slice(0, 10);

  const toolSummary = toolEvents.length > 0
    ? toolEvents.map(e => e.detail?.toolName || "unknown").join(", ")
    : "none recorded";

  const lastEvent = eventsResult.Items?.[0];
  const lastEventTime = lastEvent?.timestamp || "unknown";

  // 3. Check if prior output exists in S3
  const s3OutputKey = `workflows/${workflowId}/agents/${agentId}/output.md`;
  let hasS3Output = false;
  try {
    await s3.send(new HeadObjectCommand({ Bucket: ARTIFACT_BUCKET, Key: s3OutputKey }));
    hasS3Output = true;
  } catch {
    // No prior output
  }

  // 4. Build resume context that the orchestrator will prepend to the task prompt
  const resumeContext = [
    "SESSION RESUME - Your prior session was interrupted before completion.",
    "",
    "## Prior Session Context",
    `- **Ticket**: ${ticketId} — ${ticket.title || ""}`,
    `- **Last Activity**: ${lastEventTime}`,
    `- **Tools Used (last 10)**: ${toolSummary}`,
    hasS3Output ? `- **Prior Output (S3)**: ${s3OutputKey}` : "- **Prior Output**: None saved yet",
    ticket.branch ? `- **Feature Branch**: ${ticket.branch}` : "",
    "",
    "## Instructions",
    "1. " + (hasS3Output ? `Read your prior output from S3 key '${s3OutputKey}' to see what you already completed` : "No prior output was saved — start fresh on the remaining work"),
    ticket.branch ? "2. Check the feature branch for any committed work (`git log`)" : "",
    "3. Identify what remains unfinished from your original scope",
    "4. Complete the remaining work — do NOT redo work that is already committed",
    "5. Call report_completion when done",
  ].filter(Boolean).join("\n");

  // 5. Reset ticket to "ready" with resumeContext — DDB Stream will fire → orchestrator invokes agent
  await ddb.send(new UpdateCommand({
    TableName: TICKETS_TABLE,
    Key: { ticketId },
    UpdateExpression: "SET #s = :s, #u = :u, #rc = :rc",
    ExpressionAttributeNames: { "#s": "status", "#u": "updatedAt", "#rc": "resumeContext" },
    ExpressionAttributeValues: {
      ":s": "ready",
      ":u": new Date().toISOString(),
      ":rc": resumeContext,
    },
  }));

  // 6. Publish retry event for UI timeline
  await ddb.send(new PutCommand({
    TableName: EVENTS_TABLE,
    Item: {
      workflowId,
      eventId: `${Date.now()}-retry-${Math.random().toString(36).slice(2, 6)}`,
      type: "agent.retry",
      agentId,
      detail: { ticketId, reason: "manual_restart", toolsUsedBefore: toolSummary },
      timestamp: new Date().toISOString(),
    },
  }));

  return NextResponse.json({
    success: true,
    ticketId,
    agentId,
    message: `Restarting ${agentId} — agent will resume with prior context`,
  });
}
