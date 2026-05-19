import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { getWorkflowFromDynamo } from "@/lib/workflow/dynamo-read";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/workflow/[id]/archive
 *
 * Archives (soft-deletes) a workflow by setting its phase to "archived".
 * Used by the history sidebar for cleaning up old workflows.
 *
 * PATCH /api/workflow/[id]/archive
 *
 * Restores an archived workflow back to its previous state.
 */

const REGION = process.env.AWS_REGION || "us-east-1";
const WORKFLOWS_TABLE = process.env.WORKFLOWS_TABLE || "agentis-workflows";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
  marshallOptions: { removeUndefinedValues: true },
});

// Archive (soft-delete) a workflow
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const state = await getWorkflowFromDynamo(params.id);
    if (!state) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    const currentPhase = state.phase as string;

    // Don't archive active workflows
    if (currentPhase !== "complete" && currentPhase !== "error") {
      return NextResponse.json(
        { error: "Cannot archive an active workflow. Wait for completion or cancel it first." },
        { status: 409 }
      );
    }

    // Soft-delete: set phase to "archived" and store previous phase
    await ddb.send(new UpdateCommand({
      TableName: WORKFLOWS_TABLE,
      Key: { workflowId: params.id },
      UpdateExpression: "SET #phase = :archived, #prevPhase = :prevPhase, #archivedAt = :archivedAt",
      ExpressionAttributeNames: {
        "#phase": "phase",
        "#prevPhase": "previousPhase",
        "#archivedAt": "archivedAt",
      },
      ExpressionAttributeValues: {
        ":archived": "archived",
        ":prevPhase": currentPhase,
        ":archivedAt": new Date().toISOString(),
      },
    }));

    return NextResponse.json({
      success: true,
      message: `Workflow ${params.id} archived`,
      previousPhase: currentPhase,
    });
  } catch (err) {
    console.error(`[workflow/${params.id}/archive] DELETE error:`, err);
    return NextResponse.json(
      { error: "Failed to archive workflow", details: (err as Error).message },
      { status: 500 }
    );
  }
}

// Restore an archived workflow
export async function PATCH(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const state = await getWorkflowFromDynamo(params.id);
    if (!state) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    if ((state.phase as string) !== "archived") {
      return NextResponse.json(
        { error: "Workflow is not archived" },
        { status: 409 }
      );
    }

    const previousPhase = (state.previousPhase as string) || "complete";

    await ddb.send(new UpdateCommand({
      TableName: WORKFLOWS_TABLE,
      Key: { workflowId: params.id },
      UpdateExpression: "SET #phase = :phase REMOVE #prevPhase, #archivedAt",
      ExpressionAttributeNames: {
        "#phase": "phase",
        "#prevPhase": "previousPhase",
        "#archivedAt": "archivedAt",
      },
      ExpressionAttributeValues: {
        ":phase": previousPhase,
      },
    }));

    return NextResponse.json({
      success: true,
      message: `Workflow ${params.id} restored`,
      restoredPhase: previousPhase,
    });
  } catch (err) {
    console.error(`[workflow/${params.id}/archive] PATCH error:`, err);
    return NextResponse.json(
      { error: "Failed to restore workflow", details: (err as Error).message },
      { status: 500 }
    );
  }
}
