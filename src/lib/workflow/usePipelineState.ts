"use client";

/**
 * usePipelineState — Hook that maps WorkflowState/events to PipelineState
 *
 * Translates real-time SSE events (WorkflowEvent) into the visual state
 * consumed by the PipelineBoard component.
 */

import { useCallback, useReducer } from "react";
import type { PipelineState, PhaseStatus, PipelineItemStatus } from "@/lib/workflow/pipeline-types";
import type { WorkflowPhase, WorkflowEvent, AgentTaskStatus } from "@/lib/workflow/types";
import { PIPELINE_PHASES } from "@/components/workflow/pipeline-data";

const PHASE_ID_MAP: Record<string, string> = {
  intake: "p1",
  requirements: "p2",
  design: "p3",
  development: "p4",
  review: "p5",
};

const PHASE_ORDER: WorkflowPhase[] = [
  "intake",
  "requirements",
  "design",
  "development",
  "review",
  "complete",
];

function getPhaseIndex(phase: WorkflowPhase): number {
  return PHASE_ORDER.indexOf(phase);
}

type Action =
  | { type: "SET_PHASE"; phase: WorkflowPhase }
  | { type: "SET_AGENT_STATUS"; agentId: string; status: AgentTaskStatus }
  | { type: "PROCESS_EVENT"; event: WorkflowEvent }
  | { type: "RESET" };

function getInitialState(): PipelineState {
  return {
    currentPhase: "intake",
    phaseStatuses: {
      p1: "inactive",
      p2: "inactive",
      p3: "inactive",
      p4: "inactive",
      p5: "inactive",
    },
    itemStatuses: {},
    agentStatuses: {},
    statusText: "",
    statusPhase: "",
    celebrating: false,
  };
}

function computePhaseStatuses(currentPhase: WorkflowPhase): Record<string, PhaseStatus> {
  const currentIdx = getPhaseIndex(currentPhase);
  const statuses: Record<string, PhaseStatus> = {};

  PHASE_ORDER.forEach((phase, i) => {
    const pid = PHASE_ID_MAP[phase];
    if (!pid) return;
    if (i < currentIdx) statuses[pid] = "done";
    else if (i === currentIdx) statuses[pid] = "active";
    else statuses[pid] = "inactive";
  });

  return statuses;
}

function computeItemStatuses(
  currentPhase: WorkflowPhase,
  agentStatuses: Record<string, AgentTaskStatus>
): Record<string, PipelineItemStatus> {
  const currentIdx = getPhaseIndex(currentPhase);
  const statuses: Record<string, PipelineItemStatus> = {};

  PIPELINE_PHASES.forEach((phase, phaseIdx) => {
    phase.sections.forEach((sec) => {
      sec.items.forEach((item) => {
        if (phaseIdx < currentIdx) {
          statuses[item.id] = "done";
        } else if (phaseIdx === currentIdx) {
          // Check if any agent is working
          const hasRunning = Object.values(agentStatuses).some(
            (s) => s === "running" || s === "waiting_response"
          );
          statuses[item.id] = hasRunning ? "working" : "active";
        } else {
          statuses[item.id] = "idle";
        }
      });
    });
  });

  return statuses;
}

function reducer(state: PipelineState, action: Action): PipelineState {
  switch (action.type) {
    case "SET_PHASE": {
      const phase = action.phase;
      const celebrating = phase === "complete";
      const phaseStatuses = computePhaseStatuses(phase);
      const itemStatuses = computeItemStatuses(phase, state.agentStatuses);

      if (celebrating) {
        // Mark all as done
        Object.keys(phaseStatuses).forEach((k) => (phaseStatuses[k] = "done"));
        Object.keys(itemStatuses).forEach((k) => (itemStatuses[k] = "done"));
      }

      return {
        ...state,
        currentPhase: phase,
        phaseStatuses,
        itemStatuses,
        statusPhase: phase.toUpperCase(),
        statusText: getStatusText(phase),
        celebrating,
      };
    }

    case "SET_AGENT_STATUS": {
      const agentStatuses = {
        ...state.agentStatuses,
        [action.agentId]: action.status,
      };
      const itemStatuses = computeItemStatuses(state.currentPhase, agentStatuses);
      return { ...state, agentStatuses, itemStatuses };
    }

    case "PROCESS_EVENT": {
      const event = action.event;
      if (event.type === "phase_change") {
        return reducer(state, { type: "SET_PHASE", phase: event.phase });
      }
      if (event.type === "agent_status") {
        return reducer(state, {
          type: "SET_AGENT_STATUS",
          agentId: event.agentId,
          status: event.status,
        });
      }
      return state;
    }

    case "RESET":
      return getInitialState();

    default:
      return state;
  }
}

function getStatusText(phase: WorkflowPhase): string {
  switch (phase) {
    case "intake":
      return "Processing PRD and creating epic...";
    case "requirements":
      return "Analyzing requirements and decomposing tickets...";
    case "design":
      return "7 design agents working in parallel...";
    case "development":
      return "3 dev agents implementing features...";
    case "review":
      return "QA reviewing code and running tests...";
    case "complete":
      return "Pipeline complete — all tasks delivered!";
    default:
      return "";
  }
}

export function usePipelineState() {
  const [state, dispatch] = useReducer(reducer, undefined, getInitialState);

  const setPhase = useCallback(
    (phase: WorkflowPhase) => dispatch({ type: "SET_PHASE", phase }),
    []
  );

  const processEvent = useCallback(
    (event: WorkflowEvent) => dispatch({ type: "PROCESS_EVENT", event }),
    []
  );

  const reset = useCallback(() => dispatch({ type: "RESET" }), []);

  return { state, setPhase, processEvent, reset };
}
