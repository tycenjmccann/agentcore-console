import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import {
  SecretsManagerClient,
  DeleteSecretCommand,
} from "@aws-sdk/client-secrets-manager";

const REGION = process.env.AWS_REGION || "us-east-1";
const CONNECTORS_TABLE = process.env.CONNECTORS_TABLE || "agentis-connectors";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
  marshallOptions: { removeUndefinedValues: true },
});
const secrets = new SecretsManagerClient({ region: REGION });

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ connectorId: string }> },
) {
  try {
    const { connectorId } = await params;
    const workspaceId = req.nextUrl.searchParams.get("workspaceId");

    if (!workspaceId) {
      return NextResponse.json(
        { error: "workspaceId query parameter is required" },
        { status: 400 },
      );
    }

    const existing = await ddb.send(
      new GetCommand({
        TableName: CONNECTORS_TABLE,
        Key: { connectorId, workspaceId },
      }),
    );

    if (!existing.Item) {
      return NextResponse.json({ error: "Connector not found" }, { status: 404 });
    }

    if (existing.Item.secretRef) {
      const secretName = `agentcore/connectors/${workspaceId}/${connectorId}`;
      await secrets.send(
        new DeleteSecretCommand({
          SecretId: secretName,
          ForceDeleteWithoutRecovery: true,
        }),
      );
    }

    await ddb.send(
      new DeleteCommand({
        TableName: CONNECTORS_TABLE,
        Key: { connectorId, workspaceId },
      }),
    );

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("Connector delete error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
