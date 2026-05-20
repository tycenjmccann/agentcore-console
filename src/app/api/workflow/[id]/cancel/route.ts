import { NextRequest, NextResponse } from "next/server";
import { getWorkflow, setWorkflow, emitEvent } from "@/lib/workflow/store";

/**
 * POST /api/workflow/[id]/cancel
 * Cancel a running workflow. Sets phase to "cancelled" and stops running agents.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  const workflow = getWorkflow(id);
  if (!workflow) {
    return NextResponse.json(
      { error: "Workflow not found" },
      { status: 404 }
    );
  }

  // Only allow cancellation of active workflows
  const activePhases = ["intake", "requirements", "design", "development", "verification", "review"];
  if (!activePhases.includes(workflow.phase)) {
    return NextResponse.json(
      { error: `Cannot cancel workflow in phase: ${workflow.phase}` },
      { status: 400 }
    );
  }

  // Update workflow state to cancelled
  workflow.phase = "cancelled";
  workflow.completedAt = new Date().toISOString();

  // Stop all running agent tasks
  for (const task of Object.values(workflow.agentTasks)) {
    if (task.status === "running" || task.status === "waiting_response" || task.status === "pending") {
      task.status = "error";
      task.error = "Workflow cancelled by user";
      task.completedAt = new Date().toISOString();
    }
  }

  // Persist the updated state
  setWorkflow(workflow);

  // Emit cancellation event to all SSE subscribers
  emitEvent(id, { type: "workflow_cancelled" });
  emitEvent(id, { type: "phase_change", phase: "cancelled" });

  return NextResponse.json({
    success: true,
    workflowId: id,
    phase: "cancelled",
  });
}
