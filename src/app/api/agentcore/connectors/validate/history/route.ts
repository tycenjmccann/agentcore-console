import { NextRequest } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { VALIDATION_TABLE, ValidationRecord } from "@/lib/connector-validation";

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export async function GET(req: NextRequest) {
  const agentId = req.nextUrl.searchParams.get("agentId");

  if (!agentId) {
    return Response.json({ error: "agentId query parameter is required" }, { status: 400 });
  }

  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") || "50", 10), 100);
  const startTime = req.nextUrl.searchParams.get("startTime");
  const endTime = req.nextUrl.searchParams.get("endTime");

  let keyCondition = "GSI1PK = :pk";
  const expressionValues: Record<string, string> = {
    ":pk": `AGENT#${agentId}`,
  };

  if (startTime && endTime) {
    keyCondition += " AND GSI1SK BETWEEN :start AND :end";
    expressionValues[":start"] = startTime;
    expressionValues[":end"] = endTime;
  } else if (startTime) {
    keyCondition += " AND GSI1SK >= :start";
    expressionValues[":start"] = startTime;
  } else if (endTime) {
    keyCondition += " AND GSI1SK <= :end";
    expressionValues[":end"] = endTime;
  }

  try {
    const result = await docClient.send(new QueryCommand({
      TableName: VALIDATION_TABLE,
      IndexName: "GSI1-AgentTimeline",
      KeyConditionExpression: keyCondition,
      ExpressionAttributeValues: expressionValues,
      ScanIndexForward: false,
      Limit: limit,
    }));

    const records: ValidationRecord[] = (result.Items ?? []).map(item => ({
      validationId: item.validationId,
      agentId: item.agentId,
      connectorType: item.connectorType,
      status: item.status,
      stage: item.stage,
      startedAt: item.startedAt,
      completedAt: item.completedAt,
      results: item.results,
      error: item.error,
      reportUrl: item.reportUrl,
    }));

    return Response.json(records);
  } catch (error) {
    console.error("Validation history error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
