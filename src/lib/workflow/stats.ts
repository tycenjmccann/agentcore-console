/**
 * Workflow Statistics Helpers
 *
 * Computes agent progress, phase breakdowns, and duration metrics
 * from raw workflow state. Used by the sidebar summary API.
 */

type PhaseStatus = "pending" | "active" | "complete" | "skipped";

export interface WorkflowStats {
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
}

/** Agent phases — maps agent IDs to their workflow phase */
const AGENT_PHASE_MAP: Record<string, string> = {
  "team-requirements-analyst": "requirements",
  "team-ios-designer": "design",
  "team-backend-designer": "design",
  "team-android-designer": "design",
  "team-security-reviewer": "design",
  "team-legal-compliance": "design",
  "team-localization": "design",
  "team-analytics-designer": "design",
  "team-backend-dev": "development",
  "team-api-dev": "development",
  "team-frontend-dev": "development",
  "team-qa-verifier": "verification",
  "team-ci-agent": "review",
};

const WORKFLOW_PHASES_ORDER = [
  "requirements",
  "design",
  "development",
  "verification",
  "review",
] as const;

/**
 * Compute workflow statistics from a raw workflow record (from DynamoDB).
 * Handles both in-memory format (WorkflowState) and DynamoDB format.
 */
export function computeWorkflowStats(workflow: any): WorkflowStats {
  const agentTasks: Record<string, any> = workflow.agentTasks || {};
  const currentPhase = workflow.phase || "intake";

  // Compute agent progress
  const taskEntries = Object.values(agentTasks);
  let total = taskEntries.length || Object.keys(AGENT_PHASE_MAP).length;
  let completed = 0;
  let running = 0;
  let pending = 0;
  let failed = 0;

  if (taskEntries.length > 0) {
    for (const task of taskEntries as any[]) {
      switch (task.status) {
        case "complete":
          completed++;
          break;
        case "running":
        case "waiting_response":
          running++;
          break;
        case "error":
          failed++;
          break;
        case "pending":
        default:
          pending++;
          break;
      }
    }
  } else {
    // No agent tasks tracked yet — infer from phase
    total = Object.keys(AGENT_PHASE_MAP).length;
    pending = total;
    if (currentPhase !== "intake") {
      // At least requirements is running/complete
      pending = total - 1;
      if (currentPhase === "requirements") {
        running = 1;
      } else {
        completed = 1;
      }
    }
  }

  // Compute phase breakdown
  const phaseBreakdown = computePhaseBreakdown(currentPhase, agentTasks);

  return {
    agentProgress: { total, completed, running, pending, failed },
    phaseBreakdown,
  };
}

/**
 * Determine the status of each phase based on current workflow phase
 * and individual agent task statuses.
 */
function computePhaseBreakdown(
  currentPhase: string,
  agentTasks: Record<string, any>
): WorkflowStats["phaseBreakdown"] {
  const result: Record<string, PhaseStatus> = {
    requirements: "pending",
    design: "pending",
    development: "pending",
    verification: "pending",
    review: "pending",
  };

  const currentPhaseIndex = WORKFLOW_PHASES_ORDER.indexOf(
    currentPhase as any
  );

  // If workflow is complete or error, determine from tasks
  if (currentPhase === "complete") {
    for (const phase of WORKFLOW_PHASES_ORDER) {
      result[phase] = "complete";
    }
    // Check for phases that were skipped (no tasks in that phase completed)
    for (const phase of WORKFLOW_PHASES_ORDER) {
      const phaseAgents = Object.entries(AGENT_PHASE_MAP)
        .filter(([_, p]) => p === phase)
        .map(([id]) => id);

      const hasAnyTask = phaseAgents.some(
        (agentId) => agentTasks[agentId]?.status === "complete"
      );
      if (!hasAnyTask && Object.keys(agentTasks).length > 0) {
        result[phase] = "skipped";
      }
    }
    return result as WorkflowStats["phaseBreakdown"];
  }

  if (currentPhase === "error") {
    // Mark phases up to error point as complete, current as active
    for (let i = 0; i < WORKFLOW_PHASES_ORDER.length; i++) {
      const phase = WORKFLOW_PHASES_ORDER[i];
      if (i < currentPhaseIndex) {
        result[phase] = "complete";
      } else if (i === currentPhaseIndex) {
        result[phase] = "active";
      }
    }
    return result as WorkflowStats["phaseBreakdown"];
  }

  // Normal in-progress workflow
  for (let i = 0; i < WORKFLOW_PHASES_ORDER.length; i++) {
    const phase = WORKFLOW_PHASES_ORDER[i];
    if (i < currentPhaseIndex) {
      result[phase] = "complete";
    } else if (i === currentPhaseIndex || phase === currentPhase) {
      result[phase] = "active";
    } else {
      result[phase] = "pending";
    }
  }

  return result as WorkflowStats["phaseBreakdown"];
}

/**
 * Format elapsed milliseconds into a human-readable duration string.
 * e.g., "2m 34s", "1h 5m", "< 1m"
 */
export function formatDuration(ms: number): string {
  if (ms < 60_000) return "< 1m";

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

/**
 * Compute a percentage progress value (0-100) for a workflow.
 * Useful for progress bars in the sidebar.
 */
export function computeProgressPercent(stats: WorkflowStats): number {
  const { total, completed } = stats.agentProgress;
  if (total === 0) return 0;
  return Math.round((completed / total) * 100);
}
