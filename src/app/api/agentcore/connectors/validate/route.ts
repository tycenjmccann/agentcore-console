import { NextRequest } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";
import {
  ValidateConnectorRequest, ValidationStatus, ValidationErrorCode,
  validateSchema, getErrorHint,
  VALIDATION_TABLE, EVENT_BUS_NAME, EVENT_SOURCE, EVENT_DETAIL_TYPE,
  RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS, VALIDATION_RECORD_TTL_DAYS,
} from "@/lib/connector-validation";

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const eventBridgeClient = new EventBridgeClient({});

export async function POST(req: NextRequest) {
  let body: ValidateConnectorRequest;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.connectorType || !body.agentId || !body.connectorConfig) {
    return Response.json(
      { error: "Missing required fields: connectorType, agentId, connectorConfig" },
      { status: 400 },
    );
  }

  const schemaResult = validateSchema({
    connectorType: body.connectorType,
    connectorConfig: body.connectorConfig,
  });

  if (!schemaResult.valid) {
    const firstError = schemaResult.errors[0];
    const hint = getErrorHint(firstError.code);
    return Response.json(
      { error: firstError.message, hint: hint.action, errors: schemaResult.errors },
      { status: 422 },
    );
  }

  try {
    const now = new Date();
    const windowStart = new Date(now.getTime() - RATE_LIMIT_WINDOW_MS).toISOString();

    const rateLimitQuery = await docClient.send(new QueryCommand({
      TableName: VALIDATION_TABLE,
      IndexName: "GSI1-AgentTimeline",
      KeyConditionExpression: "GSI1PK = :pk AND GSI1SK > :windowStart",
      ExpressionAttributeValues: {
        ":pk": `AGENT#${body.agentId}`,
        ":windowStart": windowStart,
      },
      Select: "COUNT",
    }));

    if ((rateLimitQuery.Count ?? 0) >= RATE_LIMIT_MAX_REQUESTS) {
      return Response.json(
        { error: "Rate limit exceeded. Too many validation requests for this agent.", code: ValidationErrorCode.TIMEOUT_ERROR },
        { status: 429 },
      );
    }

    const validationId = crypto.randomUUID();
    const timestamp = now.toISOString();
    const ttl = Math.floor(now.getTime() / 1000) + VALIDATION_RECORD_TTL_DAYS * 86400;

    await docClient.send(new PutCommand({
      TableName: VALIDATION_TABLE,
      Item: {
        PK: `VALIDATION#${validationId}`,
        SK: "STATUS",
        GSI1PK: `AGENT#${body.agentId}`,
        GSI1SK: timestamp,
        GSI2PK: `CONNECTOR#${body.connectorType}`,
        GSI2SK: timestamp,
        validationId,
        agentId: body.agentId,
        connectorType: body.connectorType,
        status: ValidationStatus.PENDING,
        startedAt: timestamp,
        connectorConfig: body.connectorConfig,
        credentials: body.credentials,
        ttl,
      },
      ConditionExpression: "attribute_not_exists(PK)",
    }));

    await eventBridgeClient.send(new PutEventsCommand({
      Entries: [{
        Source: EVENT_SOURCE,
        DetailType: EVENT_DETAIL_TYPE,
        EventBusName: EVENT_BUS_NAME,
        Detail: JSON.stringify({
          validationId,
          agentId: body.agentId,
          connectorType: body.connectorType,
          connectorConfig: body.connectorConfig,
          credentials: body.credentials,
          requestedAt: timestamp,
        }),
      }],
    }));

    return Response.json(
      { validationId, status: ValidationStatus.PENDING },
      { status: 202 },
    );
  } catch (error) {
    if (error instanceof Error && error.name === "ConditionalCheckFailedException") {
      return Response.json(
        { error: "Rate limit exceeded" },
        { status: 429 },
      );
    }
    console.error("Connector validation error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
