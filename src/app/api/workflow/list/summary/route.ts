import { NextResponse } from "next/server";
import { listWorkflows, ensureRehydrated } from "@/lib/workflow/store";
import type { WorkflowSummary } from "@/lib/workflow/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/workflow/list/summary
 * Returns a lightweight list of workflows for the sidebar.
 * Only includes the fields needed for display (id, title, phase, epicId, startedAt)
 * to avoid transferring large agentTasks/messages payloads.
 */
export async function GET() {
  await ensureRehydrated();
  const workflows = listWorkflows();

  const summaries: WorkflowSummary[] = workflows.map((wf) => ({
    id: wf.id,
    title: wf.input.title,
    phase: wf.phase,
    epicId: wf.epicId,
    startedAt: wf.startedAt,
    completedAt: wf.completedAt,
  }));

  return NextResponse.json(
    { workflows: summaries },
    { headers: { "Cache-Control": "no-store" } }
  );
}
