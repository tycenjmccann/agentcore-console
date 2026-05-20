/**
 * DynamoDB read helpers for the event-driven workflow.
 * Used by the list, state, tickets, and dashboard metrics API endpoints.
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";

const REGION = process.env.AWS_REGION || "us-east-1";
const TICKETS_TABLE = process.env.JIRA_TABLE_NAME || "agentis-tickets";
const WORKFLOWS_TABLE = process.env.WORKFLOWS_TABLE || "agentis-workflows";
const EVENTS_TABLE = process.env.EVENTS_TABLE || "agentis-events";

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

// ─── Dashboard Metrics Helpers ───────────────────────────────────────────────

/**
 * Full scan of tickets table, excluding the __COUNTER__ record.
 * Tables are small enough for a full scan.
 */
export async function getAllTickets() {
  const items: Record<string, unknown>[] = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const result = await ddb.send(new ScanCommand({
      TableName: TICKETS_TABLE,
      ExclusiveStartKey: lastKey,
    }));
    const batch = (result.Items || []) as Record<string, unknown>[];
    items.push(...batch);
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  // Filter out the __COUNTER__ record
  return items.filter(t => t.ticketId !== "__COUNTER__");
}

/**
 * Scan workflows table, return all records. Filtering done by caller.
 */
export async function getActiveWorkflows() {
  const items: Record<string, unknown>[] = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const result = await ddb.send(new ScanCommand({
      TableName: WORKFLOWS_TABLE,
      ExclusiveStartKey: lastKey,
    }));
    const batch = (result.Items || []) as Record<string, unknown>[];
    items.push(...batch);
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  return items;
}

/**
 * Scan events table for events after the given ISO timestamp.
 */
export async function getRecentEvents(sinceISO: string) {
  const items: Record<string, unknown>[] = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const result = await ddb.send(new ScanCommand({
      TableName: EVENTS_TABLE,
      FilterExpression: "#ts >= :since",
      ExpressionAttributeNames: { "#ts": "timestamp" },
      ExpressionAttributeValues: { ":since": sinceISO },
      ExclusiveStartKey: lastKey,
    }));
    const batch = (result.Items || []) as Record<string, unknown>[];
    items.push(...batch);
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  return items;
}
