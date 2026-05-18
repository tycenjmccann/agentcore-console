import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/workflow/[id]
 * Returns the current WorkflowState for pipeline hydration.
 * Reads from DynamoDB workflow state table.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const workflowId = params.id;

  if (!workflowId) {
    return NextResponse.json({ error: "Missing workflow ID" }, { status: 400 });
  }

  try {
    const { DynamoDBClient, GetItemCommand } = await import("@aws-sdk/client-dynamodb");
    const { unmarshall } = await import("@aws-sdk/util-dynamodb");

    const client = new DynamoDBClient({
      region: process.env.AWS_REGION || "us-east-1",
    });

    const tableName = process.env.WORKFLOW_STATE_TABLE || "agentcore-workflow-state";

    const result = await client.send(
      new GetItemCommand({
        TableName: tableName,
        Key: {
          id: { S: workflowId },
        },
      })
    );

    if (!result.Item) {
      return NextResponse.json(
        { error: "Workflow not found" },
        { status: 404 }
      );
    }

    const workflow = unmarshall(result.Item);
    return NextResponse.json(workflow);
  } catch (error: unknown) {
    console.error("[API] Error fetching workflow state:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
