import { NextResponse } from "next/server";
import { listWorkflowSummaries, ensureRehydrated } from "@/lib/workflow/store";

export const dynamic = "force-dynamic";

/**
 * GET /api/workflow/list/summary
 * Returns a lightweight list of workflows for the sidebar.
 * Only includes the fields needed for display (id, title, phase, epicId, startedAt)
 * to avoid transferring large agentTasks/messages payloads.
 */
export async function GET() {
  await ensureRehydrated();
  const summaries = listWorkflowSummaries();

  return NextResponse.json(
    { workflows: summaries },
    { headers: { "Cache-Control": "no-store" } }
  );
}
