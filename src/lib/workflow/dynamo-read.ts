/**
 * DynamoDB read helpers for the event-driven workflow.
 * Used by the list, state, and tickets API endpoints.
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";

const REGION = process.env.AWS_REGION || "us-east-1";
const TICKETS_TABLE = process.env.JIRA_TABLE_NAME || "agentis-tickets";
const WORKFLOWS_TABLE = process.env.WORKFLOWS_TABLE || "agentis-workflows";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
  marshallOptions: { removeUndefinedValues: true },
});

export async function listWorkflowsFromDynamo() {
  const result = await ddb.send(new ScanCommand({
    TableName: WORKFLOWS_TABLE,
    Limit: 50,
  }));
  // Sort by startedAt descending
  const items = result.Items || [];
  items.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  return items;
}

export async function getWorkflowFromDynamo(workflowId: string) {
  const result = await ddb.send(new GetCommand({
    TableName: WORKFLOWS_TABLE,
    Key: { workflowId },
  }));
  return result.Item || null;
}

export async function getTicketsForWorkflowFromDynamo(workflowId: string) {
  // Query tickets by workflowId using a scan with filter (no GSI yet)
  const result = await ddb.send(new ScanCommand({
    TableName: TICKETS_TABLE,
    FilterExpression: "workflowId = :wid",
    ExpressionAttributeValues: { ":wid": workflowId },
  }));
  return (result.Items || []).filter(t => t.ticketId !== "__COUNTER__");
}
