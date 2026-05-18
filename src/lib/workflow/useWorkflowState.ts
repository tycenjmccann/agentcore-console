"use client";

import { useState, useEffect, useRef } from "react";
import {
  WorkflowState,
  WorkflowEvent,
  AgentTask,
  AgentPhase,
} from "@/lib/workflow/types";

export interface AgentVisualState {
  agentId: string;
  phase: AgentPhase;
  status: "pending" | "running" | "complete" | "error" | "waiting";
  ticketId?: string;
  output?: string;
  error?: string;
  shouldAnimate: boolean; // true only for events that happen after mount
}

export interface PhaseVisualState {
  phase: AgentPhase;
  agents: AgentVisualState[];
  isComplete: boolean;
  isActive: boolean;
}

export interface UseWorkflowStateResult {
  workflowState: WorkflowState | null;
  phases: PhaseVisualState[];
  isLoading: boolean;
  error: string | null;
  isComplete: boolean;
}

/**
 * Hook for managing workflow state and SSE subscriptions
 * 
 * Key Design Decision: This hook ONLY animates events that occur AFTER mount.
 * It derives the initial visual state from WorkflowState without animation,
 * preventing the "replay bug" when users return to the page.
 */
export function useWorkflowState(workflowId: string): UseWorkflowStateResult {
  const [workflowState, setWorkflowState] = useState<WorkflowState | null>(null);
  const [phases, setPhases] = useState<PhaseVisualState[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountTimestamp = useRef<Date>(new Date());
  const eventSourceRef = useRef<EventSource | null>(null);

  // Fetch initial workflow state
  useEffect(() => {
    let isMounted = true;

    async function fetchWorkflow() {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/workflow/${workflowId}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch workflow: ${response.statusText}`);
        }

        const data: WorkflowState = await response.json();
        
        if (isMounted) {
          setWorkflowState(data);
          // Derive initial visual state WITHOUT animation flags
          const initialPhases = derivePhaseStates(data, mountTimestamp.current);
          setPhases(initialPhases);
          setIsLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Unknown error");
          setIsLoading(false);
        }
      }
    }

    fetchWorkflow();

    return () => {
      isMounted = false;
    };
  }, [workflowId]);

  // Subscribe to SSE events for real-time updates
  useEffect(() => {
    if (!workflowState) return;

    const eventSource = new EventSource(`/api/workflow/${workflowId}/events`);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const workflowEvent: WorkflowEvent = JSON.parse(event.data);
        handleWorkflowEvent(workflowEvent);
      } catch (err) {
        console.error("Failed to parse SSE event:", err);
      }
    };

    eventSource.onerror = (err) => {
      console.error("SSE connection error:", err);
      eventSource.close();
    };

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [workflowState, workflowId]);

  function handleWorkflowEvent(event: WorkflowEvent) {
    setWorkflowState((prev) => {
      if (!prev) return prev;

      const updated = { ...prev };

      switch (event.type) {
        case "phase_change":
          updated.phase = event.phase;
          break;

        case "agent_status":
          if (event.agentId && updated.agentTasks[event.agentId]) {
            updated.agentTasks[event.agentId] = {
              ...updated.agentTasks[event.agentId],
              status: event.status,
              ticketId: event.ticketId || updated.agentTasks[event.agentId].ticketId,
            };
          }
          break;

        case "agent_complete":
          if (event.agentId && updated.agentTasks[event.agentId]) {
            updated.agentTasks[event.agentId] = {
              ...updated.agentTasks[event.agentId],
              status: "complete",
              output: event.output,
              branch: event.branch,
              commitSha: event.commitSha,
              completedAt: new Date().toISOString(),
            };
          }
          break;

        case "workflow_complete":
          updated.phase = "complete";
          updated.completedAt = new Date().toISOString();
          break;

        case "error":
          if (event.agentId && updated.agentTasks[event.agentId]) {
            updated.agentTasks[event.agentId] = {
              ...updated.agentTasks[event.agentId],
              status: "error",
              error: event.error,
            };
          }
          updated.error = event.error;
          break;
      }

      // Re-derive phase states with animation flags for new events
      const updatedPhases = derivePhaseStates(updated, mountTimestamp.current);
      setPhases(updatedPhases);

      return updated;
    });
  }

  const isComplete = workflowState?.phase === "complete" || false;

  return {
    workflowState,
    phases,
    isLoading,
    error,
    isComplete,
  };
}

/**
 * Derives visual phase states from WorkflowState
 * Maps agent tasks to their respective phases and determines animation flags
 */
function derivePhaseStates(
  workflowState: WorkflowState,
  mountTime: Date
): PhaseVisualState[] {
  const phaseOrder: AgentPhase[] = ["requirements", "design", "development", "review"];
  const agentPhaseMap: Record<string, AgentPhase> = {
    "team-requirements-analyst": "requirements",
    "team-ios-designer": "design",
    "team-android-designer": "design",
    "team-backend-designer": "design",
    "team-security-reviewer": "review",
    "team-legal-compliance": "review",
    "team-localization": "design",
    "team-analytics-designer": "design",
    "team-ios-dev": "development",
    "team-android-dev": "development",
    "team-backend-dev": "development",
    "team-frontend-dev": "development",
  };

  const phaseStates: PhaseVisualState[] = phaseOrder.map((phase) => {
    const agents: AgentVisualState[] = [];

    Object.entries(workflowState.agentTasks).forEach(([agentId, task]) => {
      const agentPhase = agentPhaseMap[agentId];
      if (agentPhase === phase) {
        // Check if this task was updated after mount
        const taskUpdateTime = task.completedAt || task.startedAt;
        const shouldAnimate = taskUpdateTime
          ? new Date(taskUpdateTime) > mountTime
          : false;

        agents.push({
          agentId,
          phase: agentPhase,
          status: mapTaskStatus(task.status),
          ticketId: task.ticketId,
          output: task.output,
          error: task.error,
          shouldAnimate,
        });
      }
    });

    const isComplete = agents.every((a) => a.status === "complete");
    const isActive = agents.some((a) => a.status === "running");

    return {
      phase,
      agents,
      isComplete,
      isActive,
    };
  });

  return phaseStates;
}

function mapTaskStatus(
  status: AgentTask["status"]
): AgentVisualState["status"] {
  switch (status) {
    case "pending":
      return "pending";
    case "running":
      return "running";
    case "waiting_response":
      return "waiting";
    case "complete":
      return "complete";
    case "error":
      return "error";
    default:
      return "pending";
  }
}
