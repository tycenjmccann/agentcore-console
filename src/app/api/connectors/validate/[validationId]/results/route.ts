import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

const REGION = process.env.AWS_REGION || "us-east-1";
const VALIDATION_TABLE = process.env.VALIDATION_TABLE || "connector-validations";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
  marshallOptions: { removeUndefinedValues: true },
});

export async function GET(
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

    const item = result.Item;

    const stepResults = (item.steps || []).map((stepName: string) => {
      const stepData = item.stepResults?.[stepName] || {};
      return {
        name: stepName,
        status: stepData.status || (item.status === "pending" ? "pending" : "unknown"),
        startedAt: stepData.startedAt || null,
        completedAt: stepData.completedAt || null,
        error: stepData.error || null,
      };
    });

    return NextResponse.json({
      validationId: item.validationId,
      status: item.status,
      connectorId: item.connectorId,
      connectorType: item.connectorType,
      steps: stepResults,
      summary: item.summary || null,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }, { status: 200 });
  } catch (err) {
    console.error("Connector validation results error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
