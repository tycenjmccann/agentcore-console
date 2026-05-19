import { NextRequest, NextResponse } from "next/server";
import { listWorkflowsFromDynamo } from "@/lib/workflow/dynamo-read";

export const dynamic = "force-dynamic";

/**
 * GET /api/workflow/stats
 *
 * Returns aggregated workflow statistics for the sidebar header.
 * Lightweight endpoint that only returns counts and metrics,
 * not individual workflow data.
 *
 * Response:
 *   - counts: { total, active, completed, error, archived }
 *   - recentActivity: { last24h, last7d }
 *   - averageDuration: number (ms) for completed workflows
 */

export interface WorkflowStatsResponse {
  counts: {
    total: number;
    active: number;
    completed: number;
    error: number;
    archived: number;
  };
  recentActivity: {
    last24h: number;
    last7d: number;
  };
  averageDuration: number | null;
  longestRunning: {
    id: string;
    title: string;
    startedAt: string;
    durationMs: number;
  } | null;
}

export async function GET(_req: NextRequest) {
  try {
    const workflows = await listWorkflowsFromDynamo();
    const now = Date.now();
    const DAY_MS = 86400000;

    // Calculate counts
    let active = 0;
    let completed = 0;
    let errorCount = 0;
    let archived = 0;
    let last24h = 0;
    let last7d = 0;
    let totalDuration = 0;
    let completedWithDuration = 0;
    let longestRunning: WorkflowStatsResponse["longestRunning"] = null;

    for (const w of workflows) {
      const phase = w.phase as string;
      const startedAt = w.startedAt as string;
      const completedAt = w.completedAt as string | undefined;
      const startTime = new Date(startedAt).getTime();
      const input = w.input as { title?: string } | undefined;

      // Count by status
      if (phase === "archived") {
        archived++;
      } else if (phase === "complete") {
        completed++;
      } else if (phase === "error") {
        errorCount++;
      } else {
        active++;

        // Track longest running active workflow
        const runningDuration = now - startTime;
        if (!longestRunning || runningDuration > longestRunning.durationMs) {
          longestRunning = {
            id: (w.id || w.workflowId) as string,
            title: input?.title || "Untitled",
            startedAt,
            durationMs: runningDuration,
          };
        }
      }

      // Recent activity
      if (now - startTime < DAY_MS) {
        last24h++;
      }
      if (now - startTime < DAY_MS * 7) {
        last7d++;
      }

      // Average duration (completed workflows only)
      if (phase === "complete" && completedAt) {
        const duration = new Date(completedAt).getTime() - startTime;
        if (duration > 0) {
          totalDuration += duration;
          completedWithDuration++;
        }
      }
    }

    const averageDuration = completedWithDuration > 0
      ? Math.round(totalDuration / completedWithDuration)
      : null;

    const stats: WorkflowStatsResponse = {
      counts: {
        total: workflows.length,
        active,
        completed,
        error: errorCount,
        archived,
      },
      recentActivity: {
        last24h,
        last7d,
      },
      averageDuration,
      longestRunning: active > 0 ? longestRunning : null,
    };

    return NextResponse.json(stats, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (err) {
    console.error("[workflow/stats] Error:", err);
    return NextResponse.json(
      { error: "Failed to compute stats", details: (err as Error).message },
      { status: 500 }
    );
  }
}
