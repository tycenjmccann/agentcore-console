import { NextRequest } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { VALIDATION_TABLE, ValidationRecord } from "@/lib/connector-validation";

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export async function GET(
  req: NextRequest,
  { params }: { params: { validationId: string } },
) {
  const { validationId } = params;

  if (!validationId) {
    return Response.json({ error: "validationId is required" }, { status: 400 });
  }

  try {
    const result = await docClient.send(new GetCommand({
      TableName: VALIDATION_TABLE,
      Key: {
        PK: `VALIDATION#${validationId}`,
        SK: "STATUS",
      },
    }));

    if (!result.Item) {
      return Response.json({ error: "Validation not found" }, { status: 404 });
    }

    const record: ValidationRecord = {
      validationId: result.Item.validationId,
      agentId: result.Item.agentId,
      connectorType: result.Item.connectorType,
      status: result.Item.status,
      stage: result.Item.stage,
      startedAt: result.Item.startedAt,
      completedAt: result.Item.completedAt,
      results: result.Item.results,
      error: result.Item.error,
      reportUrl: result.Item.reportUrl,
    };

    return Response.json(record);
  } catch (error) {
    console.error("Get validation status error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
