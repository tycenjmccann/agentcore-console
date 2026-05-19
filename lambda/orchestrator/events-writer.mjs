/**
 * Events Writer Lambda — Writes EventBridge events to DynamoDB for dashboard polling.
 * Triggered by EventBridge rule matching agentis.orchestrator and agentis.agent-invoker events.
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const REGION = process.env.AWS_REGION || "us-east-1";
const EVENTS_TABLE = process.env.EVENTS_TABLE || "agentis-events";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
  marshallOptions: { removeUndefinedValues: true },
});

export const handler = async (event) => {
  const detail = event.detail || {};
  const workflowId = detail.workflowId || detail.ticketId || "unknown";

  await ddb.send(new PutCommand({
    TableName: EVENTS_TABLE,
    Item: {
      workflowId,
      eventId: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: event["detail-type"] || "unknown",
      source: event.source,
      detail,
      timestamp: event.time || new Date().toISOString(),
      ttl: Math.floor(Date.now() / 1000) + 3600, // 1 hour
    },
  }));
};
