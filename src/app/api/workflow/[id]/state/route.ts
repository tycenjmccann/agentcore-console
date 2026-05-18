import { NextRequest, NextResponse } from "next/server";
import { getWorkflow, ensureRehydrated } from "@/lib/workflow/store";

/**
 * GET /api/workflow/[id]/state
 * Returns the current workflow state for the pipeline visualization.
 *
 * CRITICAL: This endpoint is used on initial load and reconnection.
 * The client derives visual state from the snapshot (no animation replay).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await ensureRehydrated();
    const state = getWorkflow(params.id);

    if (!state) {
      return NextResponse.json(
        { error: "Workflow not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(state);
  } catch (error) {
    console.error("[api/workflow/state] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch workflow state" },
      { status: 500 }
    );
  }
}
