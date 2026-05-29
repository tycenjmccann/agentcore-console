import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const REGION = process.env.AWS_REGION || "us-east-1";
const VALIDATION_TABLE = process.env.VALIDATION_TABLE || "connector-validations";
const VALIDATION_QUEUE_URL = process.env.VALIDATION_QUEUE_URL || "";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
  marshallOptions: { removeUndefinedValues: true },
});
const sqs = new SQSClient({ region: REGION });

const RETRYABLE_STATUSES = ["failed", "permanently_failed"];

export async function POST(
  _req: NextRequest,
  { params }: { params: { validationId: string } },
) {
  try {
    const { validationId } = params;

    if (!validationId) {
      return NextResponse.json({ error: "validationId is required" }, { status: 400 });
    }

    const result = await ddb.send(new GetCommand({
      TableName: VALIDATION_TABLE,
      Key: { validationId },
    }));

    if (!result.Item) {
      return NextResponse.json({ error: "Validation not found" }, { status: 404 });
    }

    const original = result.Item;

    if (!RETRYABLE_STATUSES.includes(original.status)) {
      return NextResponse.json(
        { error: `Cannot retry validation with status "${original.status}". Only failed or permanently_failed validations can be retried.` },
        { status: 409 },
      );
    }

    const newValidationId = `val_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    const ttl = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

    const newRecord = {
      validationId: newValidationId,
      status: "pending",
      connectorId: original.connectorId,
      connectorType: original.connectorType,
      steps: original.steps,
      config: original.config || undefined,
      workflowId: original.workflowId || undefined,
      retriedFrom: validationId,
      createdAt: now,
      updatedAt: now,
      ttl,
    };

    await ddb.send(new PutCommand({ TableName: VALIDATION_TABLE, Item: newRecord }));

    if (VALIDATION_QUEUE_URL) {
      await sqs.send(new SendMessageCommand({
        QueueUrl: VALIDATION_QUEUE_URL,
        MessageBody: JSON.stringify({
          validationId: newValidationId,
          connectorId: original.connectorId,
          connectorType: original.connectorType,
          steps: original.steps,
          config: original.config || null,
          workflowId: original.workflowId || null,
          retriedFrom: validationId,
        }),
        MessageGroupId: original.connectorId,
        MessageDeduplicationId: newValidationId,
      }));
    }

    return NextResponse.json(
      { validationId: newValidationId, status: "pending", retriedFrom: validationId },
      { status: 201 },
    );
  } catch (err) {
    console.error("Connector validation retry error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
