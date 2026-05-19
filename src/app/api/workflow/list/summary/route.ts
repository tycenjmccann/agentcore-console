/**
 * GET /api/workflow/list/summary
 *
 * Returns an enriched workflow list designed for the collapsible history sidebar.
 * Each entry includes:
 *  - Basic workflow metadata (id, title, epicId, phase)
 *  - Agent progress summary (total, completed, running, pending)
 *  - Duration info (startedAt, completedAt, elapsedMs)
 *  - Status breakdown by phase
 *
 * This endpoint is optimized for lightweight sidebar rendering without
 * requiring the full workflow state payload.
 */

import { NextRequest, NextResponse } from "next/server";
import { listWorkflowsFromDynamo } from "@/lib/workflow/dynamo-read";
import { computeWorkflowStats } from "@/lib/workflow/stats";

export const dynamic = "force-dynamic";

export interface WorkflowSidebarSummary {
  id: string;
  epicId: string;
  phase: string;
  title: string;
  description: string;
  startedAt: string;
  completedAt?: string;
  elapsedMs: number;
  agentProgress: {
    total: number;
    completed: number;
    running: number;
    pending: number;
    failed: number;
  };
  phaseBreakdown: {
    requirements: PhaseStatus;
    design: PhaseStatus;
    development: PhaseStatus;
    verification: PhaseStatus;
    review: PhaseStatus;
  };
  featureBranch?: string;
  hasErrors: boolean;
}

type PhaseStatus = "pending" | "active" | "complete" | "skipped";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 50);
    const statusFilter = url.searchParams.get("status"); // "active" | "completed" | "all"

    const workflows = await listWorkflowsFromDynamo();

    let filtered = workflows;
    if (statusFilter === "active") {
      filtered = workflows.filter(
        (w: any) => w.phase !== "complete" && w.phase !== "error"
      );
    } else if (statusFilter === "completed") {
      filtered = workflows.filter(
        (w: any) => w.phase === "complete" || w.phase === "error"
      );
    }

    const summaries: WorkflowSidebarSummary[] = filtered
      .slice(0, limit)
      .map((w: any) => {
        const stats = computeWorkflowStats(w);
        const now = Date.now();
        const startTime = new Date(w.startedAt).getTime();
        const endTime = w.completedAt
          ? new Date(w.completedAt).getTime()
          : now;

        return {
          id: w.id || w.workflowId,
          epicId: w.epicId || "",
          phase: w.phase || "intake",
          title: w.input?.title || "Untitled Workflow",
          description: w.input?.description || "",
          startedAt: w.startedAt,
          completedAt: w.completedAt,
          elapsedMs: endTime - startTime,
          agentProgress: stats.agentProgress,
          phaseBreakdown: stats.phaseBreakdown,
          featureBranch: w.featureBranch,
          hasErrors: w.phase === "error" || stats.agentProgress.failed > 0,
        };
      });

    return NextResponse.json({
      summaries,
      total: filtered.length,
      hasMore: filtered.length > limit,
    });
  } catch (err) {
    console.error("[workflow/list/summary] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch workflow summaries" },
      { status: 500 }
    );
  }
}
