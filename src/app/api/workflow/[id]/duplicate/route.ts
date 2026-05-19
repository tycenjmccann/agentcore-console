import { NextRequest, NextResponse } from "next/server";
import { getWorkflowFromDynamo } from "@/lib/workflow/dynamo-read";

export const dynamic = "force-dynamic";

/**
 * POST /api/workflow/[id]/duplicate
 *
 * Creates a new workflow intake pre-populated with the settings from an existing workflow.
 * Used by the history sidebar "Duplicate" action on completed workflows.
 *
 * Does NOT start a new workflow — returns the pre-filled input that the
 * frontend IntakeForm can use to let the user review and modify before submitting.
 *
 * Response:
 *   - prefilled: WorkflowInput-like object ready for the intake form
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const state = await getWorkflowFromDynamo(params.id);
    if (!state) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    const input = state.input as {
      title?: string;
      description?: string;
      repoConfig?: unknown;
      sources?: unknown[];
      modelOverride?: unknown;
    } | undefined;

    if (!input) {
      return NextResponse.json(
        { error: "Workflow has no input data to duplicate" },
        { status: 422 }
      );
    }

    // Create pre-filled input for the intake form
    const prefilled = {
      title: input.title ? `${input.title} (copy)` : "Untitled (copy)",
      description: input.description || "",
      repoConfig: input.repoConfig || { layout: "monorepo", repos: [] },
      sources: input.sources || [],
      modelOverride: input.modelOverride || undefined,
      // Metadata about the source workflow
      duplicatedFrom: {
        workflowId: params.id,
        epicId: state.epicId,
        originalTitle: input.title,
        completedAt: state.completedAt || null,
      },
    };

    return NextResponse.json({ prefilled });
  } catch (err) {
    console.error(`[workflow/${params.id}/duplicate] Error:`, err);
    return NextResponse.json(
      { error: "Failed to duplicate workflow", details: (err as Error).message },
      { status: 500 }
    );
  }
}
