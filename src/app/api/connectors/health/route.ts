import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

const REGION = process.env.AWS_REGION || "us-east-1";
const CONNECTORS_TABLE = process.env.CONNECTORS_TABLE || "agentis-connectors";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
  marshallOptions: { removeUndefinedValues: true },
});

type HealthStatus = "VALID" | "DEGRADED" | "INVALID";

export async function GET(req: NextRequest) {
  try {
    const workspaceId = req.nextUrl.searchParams.get("workspaceId");

    if (!workspaceId) {
      return NextResponse.json(
        { error: "workspaceId query parameter is required" },
        { status: 400 },
      );
    }

    const result = await ddb.send(
      new QueryCommand({
        TableName: CONNECTORS_TABLE,
        IndexName: "workspace-type-index",
        KeyConditionExpression: "workspaceId = :ws",
        ExpressionAttributeValues: { ":ws": workspaceId },
      }),
    );

    const connectors = result.Items || [];
    const total = connectors.length;
    const validCount = connectors.filter((c) => c.status === "VALID").length;
    const invalidCount = connectors.filter((c) => c.status === "INVALID").length;

    let overall: HealthStatus;
    if (total === 0 || validCount === total) {
      overall = "VALID";
    } else if (invalidCount === total) {
      overall = "INVALID";
    } else {
      overall = "DEGRADED";
    }

    return NextResponse.json({
      workspaceId,
      overall,
      counts: { total, valid: validCount, invalid: invalidCount, other: total - validCount - invalidCount },
      connectors: connectors.map((c) => ({
        connectorId: c.connectorId,
        connectorType: c.connectorType,
        name: c.name,
        status: c.status,
        lastValidatedAt: c.lastValidatedAt,
      })),
    });
  } catch (err) {
    console.error("Connector health error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
