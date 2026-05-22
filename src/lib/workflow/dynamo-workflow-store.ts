/**
 * DynamoDB Workflow Store
 *
 * Reads/writes workflow metadata to the `agentis-workflows` DynamoDB table.
 * This is the SAME table the orchestrator Lambda uses — both sides see the same state.
 *
 * In Lambda orchestration mode, this replaces the in-memory workflow store for
 * workflow metadata (the in-memory store is still used for SSE/UI state).
 *
 * Required env: WORKFLOWS_TABLE (defaults to "agentis-workflows")
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { WorkflowState } from "./types";

const REGION = process.env.AWS_REGION || "us-east-1";
const WORKFLOWS_TABLE = process.env.WORKFLOWS_TABLE || "agentis-workflows";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
  marshallOptions: { removeUndefinedValues: true },
});

/**
 * Save workflow state to DynamoDB workflows table.
 * The orchestrator Lambda reads from this same table to find workflow context.
 */
export async function saveWorkflowToDynamo(state: WorkflowState): Promise<void> {
  await ddb.send(new PutCommand({
    TableName: WORKFLOWS_TABLE,
    Item: {
      workflowId: state.id,
      ...state,
      updatedAt: new Date().toISOString(),
    },
  }));
}

/**
 * Read workflow state from DynamoDB workflows table.
 */
export async function getWorkflowFromDynamo(workflowId: string): Promise<WorkflowState | null> {
  const result = await ddb.send(new GetCommand({
    TableName: WORKFLOWS_TABLE,
    Key: { workflowId },
  }));
  return (result.Item as WorkflowState) || null;
}

/**
 * Update specific fields on the workflow in DynamoDB.
 */
export async function updateWorkflowInDynamo(
  workflowId: string,
  updates: Partial<WorkflowState>
): Promise<void> {
  const expressions: string[] = [];
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;
    const attrName = `#${key}`;
    const attrValue = `:${key}`;
    expressions.push(`${attrName} = ${attrValue}`);
    names[attrName] = key;
    values[attrValue] = value;
  }

  if (expressions.length === 0) return;

  // Always update timestamp
  expressions.push("#u = :u");
  names["#u"] = "updatedAt";
  values[":u"] = new Date().toISOString();

  await ddb.send(new UpdateCommand({
    TableName: WORKFLOWS_TABLE,
    Key: { workflowId },
    UpdateExpression: `SET ${expressions.join(", ")}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
  }));
}
