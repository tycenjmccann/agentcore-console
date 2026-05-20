import { NextResponse } from "next/server";
import { getAllTickets, getActiveWorkflows, getRecentEvents } from "@/lib/workflow/dynamo-read";
import type { DashboardMetricsResponse } from "@/types/dashboard";

export const dynamic = "force-dynamic";

// ─── In-memory server-side cache ─────────────────────────────────────────────
let cachedResponse: DashboardMetricsResponse | null = null;
let cachedAt = 0;
const CACHE_TTL = 30_000; // 30 seconds

const CACHE_HEADERS = {
  "Cache-Control": "public, max-age=30, stale-while-revalidate=60",
};

const EPIC_COLORS = [
  "bg-orange-500",
  "bg-blue-500",
  "bg-purple-500",
  "bg-green-500",
  "bg-cyan-500",
];

export async function GET() {
  try {
    // Return cached response if still valid
    if (cachedResponse && Date.now() - cachedAt < CACHE_TTL) {
      return NextResponse.json(cachedResponse, { headers: CACHE_HEADERS });
    }

    // Fetch data from all three DynamoDB tables concurrently
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [tickets, workflows, events] = await Promise.all([
      getAllTickets(),
      getActiveWorkflows(),
      getRecentEvents(twentyFourHoursAgo),
    ]);

    // ─── Agent Activity Metrics ────────────────────────────────────────────
    const invocations = events.filter(
      (e) => typeof e.type === "string" && e.type.includes("started")
    ).length;

    const sessionIds = new Set(
      events
        .map((e) => e.workflowId as string | undefined)
        .filter(Boolean)
    );
    const sessions = sessionIds.size;

    // Duration computation from workflow agentTasks
    let totalDurationSeconds = 0;
    let completedTaskCount = 0;

    for (const wf of workflows) {
      const agentTasks = wf.agentTasks as Record<string, Record<string, unknown>> | undefined;
      if (!agentTasks) continue;

      for (const task of Object.values(agentTasks)) {
        const startedAt = task.startedAt as string | undefined;
        const completedAt = task.completedAt as string | undefined;
        if (startedAt && completedAt) {
          const durationMs = new Date(completedAt).getTime() - new Date(startedAt).getTime();
          if (durationMs > 0) {
            totalDurationSeconds += durationMs / 1000;
            completedTaskCount++;
          }
        }
      }
    }

    const avgDuration = completedTaskCount > 0 ? totalDurationSeconds / completedTaskCount : 0;

    // Active agents: distinct assignees on tickets with status=in_progress
    const activeAgentSet = new Set(
      tickets
        .filter((t) => t.status === "in_progress" && t.assignee)
        .map((t) => t.assignee as string)
    );
    const activeAgents = activeAgentSet.size;

    // ─── Ticket Metrics ───────────────────────────────────────────────────
    const resolved = tickets.filter((t) => t.status === "done").length;
    const inProgress = tickets.filter((t) => t.status === "in_progress").length;

    // Active epics: workflows with phase NOT in ["complete", "error"]
    const activeEpics = workflows.filter((wf) => {
      const phase = wf.phase as string | undefined;
      return phase && phase !== "complete" && phase !== "error";
    }).length;

    // Stories done/active: non-epic tickets
    const nonEpicTickets = tickets.filter((t) => t.type !== "epic");
    const storiesDone = nonEpicTickets.filter((t) => t.status === "done").length;
    const storiesActive = nonEpicTickets.filter((t) => t.status !== "done").length;

    // Average resolution time for done tickets
    let totalResolutionMs = 0;
    let resolvedWithTimestamps = 0;
    for (const t of tickets) {
      if (t.status === "done" && t.createdAt && t.updatedAt) {
        const created = new Date(t.createdAt as string).getTime();
        const updated = new Date(t.updatedAt as string).getTime();
        if (updated > created) {
          totalResolutionMs += updated - created;
          resolvedWithTimestamps++;
        }
      }
    }
    const avgResolutionMs = resolvedWithTimestamps > 0
      ? totalResolutionMs / resolvedWithTimestamps
      : 0;

    // Throughput: tickets done in last 7 days / 7
    const doneLastWeek = tickets.filter((t) => {
      if (t.status !== "done" || !t.updatedAt) return false;
      const updated = new Date(t.updatedAt as string).getTime();
      return updated >= sevenDaysAgo.getTime();
    }).length;
    const throughput = doneLastWeek / 7;

    // Automation rate: hardcoded to 100 (all tickets are agent-driven)
    const automationRate = 100;

    // ─── Epic Progress ────────────────────────────────────────────────────
    // Sort workflows by startedAt desc, take the last 5 that have tickets
    const sortedWorkflows = [...workflows].sort((a, b) => {
      const aTime = new Date(a.startedAt as string || 0).getTime();
      const bTime = new Date(b.startedAt as string || 0).getTime();
      return bTime - aTime;
    });

    const epics: DashboardMetricsResponse["epics"] = [];
    let colorIndex = 0;

    for (const wf of sortedWorkflows) {
      if (epics.length >= 5) break;

      const workflowId = wf.workflowId as string;
      if (!workflowId) continue;

      // Find tickets for this workflow
      const wfTickets = tickets.filter((t) => t.workflowId === workflowId);
      if (wfTickets.length === 0) continue;

      const totalTickets = wfTickets.length;
      const doneTickets = wfTickets.filter((t) => t.status === "done").length;

      // Title from workflow's input.title
      const input = wf.input as { title?: string } | undefined;
      const title = input?.title || workflowId;

      epics.push({
        workflowId,
        title,
        totalTickets,
        doneTickets,
        color: EPIC_COLORS[colorIndex % EPIC_COLORS.length],
      });
      colorIndex++;
    }

    // ─── Build Response ───────────────────────────────────────────────────
    const response: DashboardMetricsResponse = {
      agentActivity: {
        invocations,
        sessions,
        avgDuration: Math.round(avgDuration * 100) / 100,
        totalDuration: Math.round(totalDurationSeconds * 100) / 100,
        activeAgents,
        tokens: null,
      },
      tickets: {
        resolved,
        inProgress,
        activeEpics,
        storiesDone,
        storiesActive,
        avgResolutionMs: Math.round(avgResolutionMs),
        throughput: Math.round(throughput * 100) / 100,
        automationRate,
      },
      epics,
      cachedAt: now.toISOString(),
    };

    // Update cache
    cachedResponse = response;
    cachedAt = Date.now();

    return NextResponse.json(response, { headers: CACHE_HEADERS });
  } catch (error) {
    console.error("[dashboard/metrics] Error computing metrics:", error);
    return NextResponse.json(
      { error: "Failed to compute dashboard metrics" },
      { status: 500 }
    );
  }
}
