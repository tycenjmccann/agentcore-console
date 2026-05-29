import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const REGION = process.env.AWS_REGION || "us-east-1";
const VALIDATION_TABLE = process.env.VALIDATION_TABLE || "connector-validations";
const IDEMPOTENCY_TABLE = process.env.IDEMPOTENCY_TABLE || "validation-idempotency-keys";
const VALIDATION_QUEUE_URL = process.env.VALIDATION_QUEUE_URL || "";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
  marshallOptions: { removeUndefinedValues: true },
});
const sqs = new SQSClient({ region: REGION });

const ALLOWED_CONNECTOR_TYPES = ["github", "jira", "slack", "s3", "dynamodb", "custom"];
const DEFAULT_STEPS = ["auth", "connectivity", "permissions", "data-flow"];
const RATE_LIMIT_MAX_TOKENS = 10;
const RATE_LIMIT_WINDOW_SECONDS = 3600;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const { connectorId, connectorType, steps, config, workflowId, idempotencyKey } = body;

    if (!connectorId || typeof connectorId !== "string") {
      return NextResponse.json({ error: "connectorId is required and must be a string" }, { status: 400 });
    }
    if (!connectorType || typeof connectorType !== "string") {
      return NextResponse.json({ error: "connectorType is required and must be a string" }, { status: 400 });
    }
    if (!ALLOWED_CONNECTOR_TYPES.includes(connectorType)) {
      return NextResponse.json(
        { error: `Invalid connectorType. Must be one of: ${ALLOWED_CONNECTOR_TYPES.join(", ")}` },
        { status: 400 },
      );
    }
    if (steps !== undefined && (!Array.isArray(steps) || !steps.every((s: unknown) => typeof s === "string"))) {
      return NextResponse.json({ error: "steps must be an array of strings" }, { status: 400 });
    }

    // Rate limiting check
    const rateLimitResult = await checkRateLimit(connectorId);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Max 10 validations per connector per hour." },
        { status: 429, headers: { "Retry-After": String(rateLimitResult.retryAfter) } },
      );
    }

    // Idempotency check
    if (idempotencyKey) {
      const existing = await checkIdempotencyKey(idempotencyKey);
      if (existing) {
        return NextResponse.json({ validationId: existing, status: "pending" }, { status: 200 });
      }
    }

    const validationId = `val_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    const ttl = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
    const resolvedSteps = steps || DEFAULT_STEPS;

    const record = {
      validationId,
      status: "pending",
      connectorId,
      connectorType,
      steps: resolvedSteps,
      config: config || undefined,
      workflowId: workflowId || undefined,
      createdAt: now,
      updatedAt: now,
      ttl,
    };

    await ddb.send(new PutCommand({ TableName: VALIDATION_TABLE, Item: record }));

    // Store idempotency key with 24h TTL
    if (idempotencyKey) {
      const idempotencyTtl = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
      await ddb.send(new PutCommand({
        TableName: IDEMPOTENCY_TABLE,
        Item: {
          idempotencyKey,
          validationId,
          createdAt: now,
          ttl: idempotencyTtl,
        },
      }));
    }

    // Send to SQS for async processing
    if (VALIDATION_QUEUE_URL) {
      await sqs.send(new SendMessageCommand({
        QueueUrl: VALIDATION_QUEUE_URL,
        MessageBody: JSON.stringify({
          validationId,
          connectorId,
          connectorType,
          steps: resolvedSteps,
          config: config || null,
          workflowId: workflowId || null,
        }),
        MessageGroupId: connectorId,
        MessageDeduplicationId: idempotencyKey || validationId,
      }));
    }

    return NextResponse.json({ validationId, status: "pending" }, { status: 201 });
  } catch (err) {
    console.error("Connector validation POST error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const connectorId = searchParams.get("connectorId");
    const status = searchParams.get("status");
    const workflowId = searchParams.get("workflowId");
    const limitParam = searchParams.get("limit");

    const limit = Math.min(Math.max(parseInt(limitParam || "20", 10) || 20, 1), 100);

    let result;

    if (connectorId) {
      result = await ddb.send(new QueryCommand({
        TableName: VALIDATION_TABLE,
        IndexName: "connectorId-index",
        KeyConditionExpression: "connectorId = :cid",
        ExpressionAttributeValues: { ":cid": connectorId },
        Limit: limit,
        ScanIndexForward: false,
      }));
    } else if (status) {
      result = await ddb.send(new QueryCommand({
        TableName: VALIDATION_TABLE,
        IndexName: "status-index",
        KeyConditionExpression: "#s = :status",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: { ":status": status },
        Limit: limit,
        ScanIndexForward: false,
      }));
    } else if (workflowId) {
      result = await ddb.send(new QueryCommand({
        TableName: VALIDATION_TABLE,
        IndexName: "workflowId-index",
        KeyConditionExpression: "workflowId = :wid",
        ExpressionAttributeValues: { ":wid": workflowId },
        Limit: limit,
        ScanIndexForward: false,
      }));
    } else {
      result = await ddb.send(new ScanCommand({
        TableName: VALIDATION_TABLE,
        Limit: limit,
      }));
    }

    const validations = result.Items || [];
    return NextResponse.json({ validations, count: validations.length }, { status: 200 });
  } catch (err) {
    console.error("Connector validation GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

async function checkIdempotencyKey(key: string): Promise<string | null> {
  const result = await ddb.send(new GetCommand({
    TableName: IDEMPOTENCY_TABLE,
    Key: { idempotencyKey: key },
  }));
  if (result.Item && result.Item.ttl > Math.floor(Date.now() / 1000)) {
    return result.Item.validationId;
  }
  return null;
}

async function checkRateLimit(connectorId: string): Promise<{ allowed: boolean; retryAfter: number }> {
  const key = `ratelimit_${connectorId}`;
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - RATE_LIMIT_WINDOW_SECONDS;

  try {
    // Try to decrement the token counter atomically
    const result = await ddb.send(new UpdateCommand({
      TableName: IDEMPOTENCY_TABLE,
      Key: { idempotencyKey: key },
      UpdateExpression: "SET tokens = if_not_exists(tokens, :max) - :one, windowStart = if_not_exists(windowStart, :now), #ttl = :ttl",
      ConditionExpression: "(attribute_not_exists(windowStart) OR windowStart < :windowStart) OR (tokens > :zero)",
      ExpressionAttributeNames: { "#ttl": "ttl" },
      ExpressionAttributeValues: {
        ":max": RATE_LIMIT_MAX_TOKENS,
        ":one": 1,
        ":zero": 0,
        ":now": now,
        ":windowStart": windowStart,
        ":ttl": now + RATE_LIMIT_WINDOW_SECONDS,
      },
      ReturnValues: "ALL_NEW",
    }));

    // If the window expired, reset the counter
    const item = result.Attributes;
    if (item && item.windowStart < windowStart) {
      await ddb.send(new PutCommand({
        TableName: IDEMPOTENCY_TABLE,
        Item: {
          idempotencyKey: key,
          tokens: RATE_LIMIT_MAX_TOKENS - 1,
          windowStart: now,
          ttl: now + RATE_LIMIT_WINDOW_SECONDS,
        },
      }));
    }

    return { allowed: true, retryAfter: 0 };
  } catch (err: unknown) {
    if ((err as { name?: string }).name === "ConditionalCheckFailedException") {
      // Rate limit exceeded — get remaining window time
      const existing = await ddb.send(new GetCommand({
        TableName: IDEMPOTENCY_TABLE,
        Key: { idempotencyKey: key },
      }));
      const retryAfter = existing.Item
        ? Math.max(0, (existing.Item.windowStart + RATE_LIMIT_WINDOW_SECONDS) - now)
        : RATE_LIMIT_WINDOW_SECONDS;
      return { allowed: false, retryAfter };
    }
    throw err;
  }
}
