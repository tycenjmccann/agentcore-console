import { NextRequest, NextResponse } from "next/server";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

const REGION = process.env.AWS_REGION || "us-east-1";
const VALIDATOR_LAMBDA =
  process.env.CONNECTOR_VALIDATOR_LAMBDA || "agentis-connector-validator";

const lambda = new LambdaClient({ region: REGION });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { connectorIds, checks, workspaceId } = body;

    if (!workspaceId || !connectorIds || !Array.isArray(connectorIds) || connectorIds.length === 0) {
      return NextResponse.json(
        { error: "workspaceId and connectorIds (non-empty array) are required" },
        { status: 400 },
      );
    }

    const resp = await lambda.send(
      new InvokeCommand({
        FunctionName: VALIDATOR_LAMBDA,
        InvocationType: "RequestResponse",
        Payload: Buffer.from(
          JSON.stringify({ connectorIds, checks, workspaceId }),
        ),
      }),
    );

    if (resp.FunctionError) {
      const errorPayload = JSON.parse(new TextDecoder().decode(resp.Payload));
      return NextResponse.json(
        { error: "Validator Lambda error", details: errorPayload },
        { status: 502 },
      );
    }

    const result = JSON.parse(new TextDecoder().decode(resp.Payload));

    return NextResponse.json(result);
  } catch (err) {
    console.error("Connector validate error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
