import { NextRequest, NextResponse } from "next/server";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

const REGION = process.env.AWS_REGION || "us-east-1";
const PREFLIGHT_LAMBDA =
  process.env.CONNECTOR_PREFLIGHT_LAMBDA || "agentis-connector-preflight";

const lambda = new LambdaClient({ region: REGION });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { workflowId } = body;

    if (!workflowId) {
      return NextResponse.json(
        { error: "workflowId is required" },
        { status: 400 },
      );
    }

    const resp = await lambda.send(
      new InvokeCommand({
        FunctionName: PREFLIGHT_LAMBDA,
        InvocationType: "RequestResponse",
        Payload: Buffer.from(JSON.stringify({ workflowId })),
      }),
    );

    if (resp.FunctionError) {
      const errorPayload = JSON.parse(new TextDecoder().decode(resp.Payload));
      return NextResponse.json(
        { error: "Preflight Lambda error", details: errorPayload },
        { status: 502 },
      );
    }

    const result = JSON.parse(new TextDecoder().decode(resp.Payload));

    return NextResponse.json(result);
  } catch (err) {
    console.error("Connector preflight error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
