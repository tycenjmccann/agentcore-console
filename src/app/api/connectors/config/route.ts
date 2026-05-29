import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import {
  SecretsManagerClient,
  CreateSecretCommand,
} from "@aws-sdk/client-secrets-manager";
import crypto from "crypto";

const REGION = process.env.AWS_REGION || "us-east-1";
const CONNECTORS_TABLE = process.env.CONNECTORS_TABLE || "agentis-connectors";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
  marshallOptions: { removeUndefinedValues: true },
});
const secrets = new SecretsManagerClient({ region: REGION });

const VALID_CONNECTOR_TYPES = ["github", "jira", "s3", "slack", "linear"] as const;
type ConnectorType = (typeof VALID_CONNECTOR_TYPES)[number];

function generateConnectorId(): string {
  return `conn_${crypto.randomBytes(6).toString("hex").slice(0, 12)}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const { workspaceId, connectorType, name, config, credentials } = body;

    if (!workspaceId || !connectorType || !name) {
      return NextResponse.json(
        { error: "workspaceId, connectorType, and name are required" },
        { status: 400 },
      );
    }

    if (!VALID_CONNECTOR_TYPES.includes(connectorType as ConnectorType)) {
      return NextResponse.json(
        { error: `connectorType must be one of: ${VALID_CONNECTOR_TYPES.join(", ")}` },
        { status: 400 },
      );
    }

    const connectorId = generateConnectorId();
    const now = new Date().toISOString();

    let secretRef: string | undefined;
    if (credentials) {
      const secretName = `agentcore/connectors/${workspaceId}/${connectorId}`;
      const result = await secrets.send(
        new CreateSecretCommand({
          Name: secretName,
          SecretString: JSON.stringify(credentials),
        }),
      );
      secretRef = result.ARN;
    }

    const item = {
      connectorId,
      workspaceId,
      connectorType,
      name,
      config: config || {},
      secretRef,
      status: "PENDING",
      createdAt: now,
      updatedAt: now,
    };

    await ddb.send(
      new PutCommand({
        TableName: CONNECTORS_TABLE,
        Item: item,
      }),
    );

    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    console.error("Connector create error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

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

    return NextResponse.json({ connectors: result.Items || [] });
  } catch (err) {
    console.error("Connector list error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
