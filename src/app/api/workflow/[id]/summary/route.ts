import { NextRequest, NextResponse } from "next/server";
import { getWorkflowFromDynamo, getTicketsForWorkflowFromDynamo } from "@/lib/workflow/dynamo-read";

export const dynamic = "force-dynamic";

/**
 * GET /api/workflow/[id]/summary
 *
 * Returns a condensed summary of a workflow for sidebar display.
 * Lighter weight than the full state endpoint — returns only what
 * the collapsed/expanded sidebar card needs to render.
 *
 * Response includes:
 *   - Basic workflow info (id, title, phase, timing)
 *   - Agent progress (completed/total)
 *   - Phase breakdown with agent counts
 *   - Key metrics (duration, ticket count, etc.)
 */

export interface WorkflowSummaryResponse {
  id: string;
  title: string;
  description: string;
  epicId: string;
  phase: string;
  startedAt: string;
  completedAt: string | null;
  duration: number | null; // milliseconds
  progress: {
    completedAgents: number;
    totalAgents: number;
    percentage: number;
  };
  phases: PhaseProgress[];
  ticketCount: number;
  featureBranch: string | null;
  hasErrors: boolean;
}

interface PhaseProgress {
  name: string;
  status: "pending" | "active" | "complete" | "error";
  agentCount: number;
  completedCount: number;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const state = await getWorkflowFromDynamo(params.id);
    if (!state) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    const tickets = await getTicketsForWorkflowFromDynamo(params.id);

    // Calculate agent progress
    const agentTasks = (state.agentTasks || {}) as Record<string, { status: string }>;
    const taskEntries = Object.values(agentTasks);
    const completedAgents = taskEntries.filter((t) => t.status === "complete").length;
    const totalAgents = taskEntries.length || 0;
    const percentage = totalAgents > 0 ? Math.round((completedAgents / totalAgents) * 100) : 0;

    // Calculate phase breakdown
    const phaseOrder = ["requirements", "design", "development", "verification", "review"];
    const currentPhase = state.phase as string;

    const phases: PhaseProgress[] = phaseOrder.map((phaseName) => {
      // Determine phase status based on current workflow phase
      const phaseIndex = phaseOrder.indexOf(phaseName);
      const currentIndex = phaseOrder.indexOf(currentPhase);

      let phaseStatus: PhaseProgress["status"] = "pending";
      if (currentPhase === "complete") {
        phaseStatus = "complete";
      } else if (currentPhase === "error") {
        phaseStatus = phaseIndex <= currentIndex ? "error" : "pending";
      } else if (phaseIndex < currentIndex) {
        phaseStatus = "complete";
      } else if (phaseIndex === currentIndex) {
        phaseStatus = "active";
      }

      // Count agents in this phase
      const phaseAgents = taskEntries.filter((t) => {
        const task = t as { agentId?: string };
        const agentId = task.agentId || "";
        if (phaseName === "requirements") return agentId.includes("requirements");
        if (phaseName === "design") return agentId.includes("designer") || agentId.includes("security") || agentId.includes("legal") || agentId.includes("localization") || agentId.includes("analytics");
        if (phaseName === "development") return agentId.includes("dev") || agentId.includes("frontend") || agentId.includes("backend") || agentId.includes("api");
        if (phaseName === "verification") return agentId.includes("qa");
        if (phaseName === "review") return agentId.includes("ci");
        return false;
      });

      const completedInPhase = phaseAgents.filter((t) => t.status === "complete").length;

      return {
        name: phaseName,
        status: phaseStatus,
        agentCount: phaseAgents.length,
        completedCount: completedInPhase,
      };
    });

    // Calculate duration
    const startedAt = state.startedAt as string;
    const completedAt = (state.completedAt as string) || null;
    let duration: number | null = null;
    if (startedAt) {
      const end = completedAt ? new Date(completedAt).getTime() : Date.now();
      duration = end - new Date(startedAt).getTime();
    }

    const input = (state.input || {}) as { title?: string; description?: string };

    const summary: WorkflowSummaryResponse = {
      id: state.id as string || state.workflowId as string,
      title: input.title || "Untitled",
      description: input.description || "",
      epicId: state.epicId as string,
      phase: currentPhase,
      startedAt,
      completedAt,
      duration,
      progress: {
        completedAgents,
        totalAgents,
        percentage,
      },
      phases,
      ticketCount: tickets.length,
      featureBranch: (state.featureBranch as string) || null,
      hasErrors: currentPhase === "error" || taskEntries.some((t) => t.status === "error"),
    };

    return NextResponse.json(summary, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error(`[workflow/${params.id}/summary] Error:`, err);
    return NextResponse.json(
      { error: "Failed to generate summary", details: (err as Error).message },
      { status: 500 }
    );
  }
}
