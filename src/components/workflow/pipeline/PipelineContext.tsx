"use client";

import { createContext, useContext, useReducer, useCallback, type ReactNode, type Dispatch } from "react";
import type {
  WorkflowState,
  WorkflowPhase,
  AgentTaskStatus,
  AgentTask,
  WorkflowEvent,
} from "@/lib/workflow/types";

// ─── Pipeline State Types ────────────────────────────────────────────────────

export interface PipelinePhase {
  id: WorkflowPhase;
  label: string;
  status: "pending" | "active" | "completed";
  agents: PipelineAgent[];
  order: number;
}

export interface PipelineAgent {
  id: string;
  name: string;
  status: AgentTaskStatus;
  latestOutput: string | null;
  completedAt: string | null;
}

export interface PipelineState {
  workflowId: string;
  workflowStatus: WorkflowPhase;
  phases: PipelinePhase[];
  showCelebration: boolean;
  hydratedAt: number | null;
  error: string | null;
}

// ─── Actions ─────────────────────────────────────────────────────────────────

export type PipelineAction =
  | { type: "HYDRATE"; payload: WorkflowState }
  | { type: "PHASE_CHANGE"; phase: WorkflowPhase }
  | { type: "AGENT_STATUS"; agentId: string; status: AgentTaskStatus }
  | { type: "AGENT_OUTPUT"; agentId: string; chunk: string }
  | { type: "AGENT_COMPLETE"; agentId: string; output: string }
  | { type: "WORKFLOW_COMPLETE" }
  | { type: "DISMISS_CELEBRATION" }
  | { type: "ERROR"; error: string };

// ─── Phase Definitions ───────────────────────────────────────────────────────

const PHASE_ORDER: { id: WorkflowPhase; label: string }[] = [
  { id: "intake", label: "Intake" },
  { id: "requirements", label: "Requirements" },
  { id: "design", label: "Design" },
  { id: "development", label: "Development" },
  { id: "review", label: "Review" },
  { id: "complete", label: "Complete" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getPhaseStatus(
  phaseId: WorkflowPhase,
  currentPhase: WorkflowPhase
): "pending" | "active" | "completed" {
  const currentIdx = PHASE_ORDER.findIndex((p) => p.id === currentPhase);
  const phaseIdx = PHASE_ORDER.findIndex((p) => p.id === phaseId);
  if (currentPhase === "complete" || currentPhase === "error") {
    return phaseId === "complete" ? "active" : "completed";
  }
  if (phaseIdx < currentIdx) return "completed";
  if (phaseIdx === currentIdx) return "active";
  return "pending";
}

function mapAgentToPhase(agentId: string): WorkflowPhase {
  if (agentId.includes("requirements") || agentId.includes("intake")) return "requirements";
  if (agentId.includes("designer") || agentId.includes("design")) return "design";
  if (agentId.includes("dev") || agentId.includes("frontend") || agentId.includes("backend")) return "development";
  if (agentId.includes("review") || agentId.includes("qa") || agentId.includes("security")) return "review";
  return "requirements";
}

function agentDisplayName(agentId: string): string {
  return agentId
    .replace("team-", "")
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function deriveStateFromWorkflow(workflow: WorkflowState): PipelineState {
  const currentPhase = workflow.phase;

  // Build phases with agents placed correctly
  const phases: PipelinePhase[] = PHASE_ORDER.map((p, idx) => ({
    id: p.id,
    label: p.label,
    status: getPhaseStatus(p.id, currentPhase),
    agents: [],
    order: idx,
  }));

  // Place agents into their phases
  if (workflow.agentTasks) {
    Object.entries(workflow.agentTasks).forEach(([agentId, task]) => {
      const phaseId = mapAgentToPhase(agentId);
      const phase = phases.find((p) => p.id === phaseId);
      if (phase) {
        phase.agents.push({
          id: agentId,
          name: agentDisplayName(agentId),
          status: task.status,
          latestOutput: task.output ? task.output.slice(0, 200) : null,
          completedAt: task.completedAt || null,
        });
      }
    });
  }

  return {
    workflowId: workflow.id,
    workflowStatus: currentPhase,
    phases,
    showCelebration: false,
    hydratedAt: Date.now(),
    error: workflow.error || null,
  };
}

// ─── Reducer ─────────────────────────────────────────────────────────────────

function pipelineReducer(state: PipelineState, action: PipelineAction): PipelineState {
  switch (action.type) {
    case "HYDRATE":
      return deriveStateFromWorkflow(action.payload);

    case "PHASE_CHANGE": {
      const phases = state.phases.map((p) => ({
        ...p,
        status: getPhaseStatus(p.id, action.phase),
      }));
      return { ...state, workflowStatus: action.phase, phases };
    }

    case "AGENT_STATUS": {
      const phases = state.phases.map((p) => ({
        ...p,
        agents: p.agents.map((a) =>
          a.id === action.agentId ? { ...a, status: action.status } : a
        ),
      }));
      // If the agent doesn't exist yet, add it to the appropriate phase
      const agentExists = phases.some((p) => p.agents.some((a) => a.id === action.agentId));
      if (!agentExists) {
        const targetPhaseId = mapAgentToPhase(action.agentId);
        const targetPhase = phases.find((p) => p.id === targetPhaseId);
        if (targetPhase) {
          targetPhase.agents.push({
            id: action.agentId,
            name: agentDisplayName(action.agentId),
            status: action.status,
            latestOutput: null,
            completedAt: null,
          });
        }
      }
      return { ...state, phases };
    }

    case "AGENT_OUTPUT": {
      const phases = state.phases.map((p) => ({
        ...p,
        agents: p.agents.map((a) =>
          a.id === action.agentId
            ? { ...a, latestOutput: (a.latestOutput || "") + action.chunk }
            : a
        ),
      }));
      return { ...state, phases };
    }

    case "AGENT_COMPLETE": {
      const phases = state.phases.map((p) => ({
        ...p,
        agents: p.agents.map((a) =>
          a.id === action.agentId
            ? {
                ...a,
                status: "complete" as AgentTaskStatus,
                latestOutput: action.output.slice(0, 200),
                completedAt: new Date().toISOString(),
              }
            : a
        ),
      }));
      return { ...state, phases };
    }

    case "WORKFLOW_COMPLETE": {
      const phases = state.phases.map((p) => ({
        ...p,
        status: "completed" as const,
      }));
      return {
        ...state,
        workflowStatus: "complete",
        phases,
        showCelebration: true,
      };
    }

    case "DISMISS_CELEBRATION":
      return { ...state, showCelebration: false };

    case "ERROR":
      return { ...state, error: action.error, workflowStatus: "error" };

    default:
      return state;
  }
}

// ─── Context ─────────────────────────────────────────────────────────────────

const initialState: PipelineState = {
  workflowId: "",
  workflowStatus: "intake",
  phases: PHASE_ORDER.map((p, idx) => ({
    id: p.id,
    label: p.label,
    status: "pending" as const,
    agents: [],
    order: idx,
  })),
  showCelebration: false,
  hydratedAt: null,
  error: null,
};

interface PipelineContextType {
  state: PipelineState;
  dispatch: Dispatch<PipelineAction>;
}

const PipelineContext = createContext<PipelineContextType | null>(null);

export function PipelineProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(pipelineReducer, initialState);
  return (
    <PipelineContext.Provider value={{ state, dispatch }}>
      {children}
    </PipelineContext.Provider>
  );
}

export function usePipeline(): PipelineContextType {
  const ctx = useContext(PipelineContext);
  if (!ctx) throw new Error("usePipeline must be used within PipelineProvider");
  return ctx;
}

export function useDispatchWorkflowEvent() {
  const { dispatch } = usePipeline();

  return useCallback(
    (event: WorkflowEvent) => {
      switch (event.type) {
        case "phase_change":
          dispatch({ type: "PHASE_CHANGE", phase: event.phase });
          break;
        case "agent_status":
          dispatch({ type: "AGENT_STATUS", agentId: event.agentId, status: event.status });
          break;
        case "agent_output":
          dispatch({ type: "AGENT_OUTPUT", agentId: event.agentId, chunk: event.chunk });
          break;
        case "agent_complete":
          dispatch({ type: "AGENT_COMPLETE", agentId: event.agentId, output: event.output });
          break;
        case "workflow_complete":
          dispatch({ type: "WORKFLOW_COMPLETE" });
          break;
        case "error":
          dispatch({ type: "ERROR", error: event.error });
          break;
      }
    },
    [dispatch]
  );
}
