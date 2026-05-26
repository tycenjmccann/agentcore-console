/**
 * DynamoDB Workflow Store — write operations for workflow state.
 * Used by the cancel API route and orchestrator.
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const REGION = process.env.AWS_REGION || "us-east-1";
const WORKFLOWS_TABLE = process.env.WORKFLOWS_TABLE || "agentis-workflows";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
  marshallOptions: { removeUndefinedValues: true },
});

const TERMINAL_PHASES = ["complete", "error", "cancelled"] as const;

export interface CancelWorkflowResult {
  success: boolean;
  cancelledAt?: string;
  previousPhase?: string;
  error?: string;
}

/**
 * Cancel a workflow — sets phase to "cancelled" with conditional guard against terminal states.
 * Returns the result including timestamps and previous phase for audit.
 */
export async function cancelWorkflow(workflowId: string): Promise<CancelWorkflowResult> {
  // 1. Read current workflow state
  const getResult = await ddb.send(new GetCommand({
    TableName: WORKFLOWS_TABLE,
    Key: { workflowId },
    ConsistentRead: true,
  }));

  if (!getResult.Item) {
    return { success: false, error: "Workflow not found" };
  }

  const workflow = getResult.Item;

  // 2. Check terminal state
  if (TERMINAL_PHASES.includes(workflow.phase as typeof TERMINAL_PHASES[number])) {
    return { success: false, error: `Workflow already in terminal state: ${workflow.phase}` };
  }

  // 3. Conditional write — atomic check-and-set
  const cancelledAt = new Date().toISOString();
  try {
    await ddb.send(new UpdateCommand({
      TableName: WORKFLOWS_TABLE,
      Key: { workflowId },
      UpdateExpression: "SET #phase = :cancelled, cancelledAt = :ts, previousPhase = :prev",
      ConditionExpression: "#phase <> :complete AND #phase <> :error AND #phase <> :alreadyCancelled",
      ExpressionAttributeNames: { "#phase": "phase" },
      ExpressionAttributeValues: {
        ":cancelled": "cancelled",
        ":ts": cancelledAt,
        ":prev": workflow.phase,
        ":complete": "complete",
        ":error": "error",
        ":alreadyCancelled": "cancelled",
      },
    }));
  } catch (err: unknown) {
    if ((err as { name?: string }).name === "ConditionalCheckFailedException") {
      return { success: false, error: "Workflow transitioned to terminal state concurrently" };
    }
    throw err;
  }

  return { success: true, cancelledAt, previousPhase: workflow.phase as string };
}
