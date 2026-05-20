/**
 * POST /api/workflow/[id]/cancel
 *
 * Cancels an active workflow and transitions all non-done tickets to "cancelled" status.
 * This prevents the orchestration Lambda from dispatching new agent invocations.
 *
 * Running agents are NOT actively stopped — they will complete their current task
 * but no new tickets will be dispatched since the orchestrator ignores non-actionable statuses.
 */

import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  UpdateCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { getWorkflowFromDynamo } from "@/lib/workflow/dynamo-read";

export const dynamic = "force-dynamic";

const REGION = process.env.AWS_REGION || "us-east-1";
const TICKETS_TABLE = process.env.JIRA_TABLE_NAME || "agentis-tickets";
const WORKFLOWS_TABLE = process.env.WORKFLOWS_TABLE || "agentis-workflows";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
  marshallOptions: { removeUndefinedValues: true },
});

/** Phases that indicate the workflow is already terminal and cannot be cancelled. */
const TERMINAL_PHASES = new Set(["complete", "completed", "cancelled"]);

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const workflowId = params.id;

    // 1. Validate the workflow exists
    const workflow = await getWorkflowFromDynamo(workflowId);
    if (!workflow) {
      return NextResponse.json(
        { error: "Workflow not found" },
        { status: 404 }
      );
    }

    // 2. Validate the workflow is in an active (non-terminal) state
    const currentPhase = (workflow.phase || "").toLowerCase();
    if (TERMINAL_PHASES.has(currentPhase)) {
      return NextResponse.json(
        { error: "Workflow is already completed or cancelled" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    // 3. Update the workflow: set phase to "cancelled", error message, and completedAt
    await ddb.send(
      new UpdateCommand({
        TableName: WORKFLOWS_TABLE,
        Key: { workflowId },
        UpdateExpression:
          "SET #phase = :phase, #error = :error, #completedAt = :completedAt, #updatedAt = :updatedAt",
        ExpressionAttributeNames: {
          "#phase": "phase",
          "#error": "error",
          "#completedAt": "completedAt",
          "#updatedAt": "updatedAt",
        },
        ExpressionAttributeValues: {
          ":phase": "cancelled",
          ":error": "Cancelled by user",
          ":completedAt": now,
          ":updatedAt": now,
        },
      })
    );

    // 4. Get all tickets for this workflow and cancel non-done ones
    const ticketsResult = await ddb.send(
      new ScanCommand({
        TableName: TICKETS_TABLE,
        FilterExpression: "workflowId = :wid",
        ExpressionAttributeValues: { ":wid": workflowId },
      })
    );

    const allTickets = (ticketsResult.Items || []).filter(
      (t) => t.ticketId !== "__COUNTER__"
    );

    let ticketsCancelled = 0;

    // 5. Transition all non-done tickets to "cancelled"
    const cancelPromises = allTickets
      .filter((ticket) => ticket.status !== "done")
      .map(async (ticket) => {
        try {
          await ddb.send(
            new UpdateCommand({
              TableName: TICKETS_TABLE,
              Key: { ticketId: ticket.ticketId },
              UpdateExpression: "SET #s = :s, #u = :u",
              ExpressionAttributeNames: {
                "#s": "status",
                "#u": "updatedAt",
              },
              ExpressionAttributeValues: {
                ":s": "cancelled",
                ":u": now,
              },
            })
          );
          ticketsCancelled++;
        } catch (err) {
          // Gracefully handle individual ticket update failures
          console.error(
            `[cancel] Failed to cancel ticket ${ticket.ticketId}:`,
            (err as Error).message
          );
        }
      });

    await Promise.all(cancelPromises);

    console.log(
      `[cancel] Workflow ${workflowId} cancelled. ${ticketsCancelled} tickets transitioned to cancelled.`
    );

    // 6. Return success response
    return NextResponse.json({
      cancelled: true,
      ticketsCancelled,
    });
  } catch (err) {
    console.error("[cancel] Unexpected error:", err);
    return NextResponse.json(
      { error: (err as Error).message || "Internal server error" },
      { status: 500 }
    );
  }
}
