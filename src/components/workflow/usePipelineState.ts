"use client";

import { useEffect, useReducer, useRef, useCallback } from "react";
import type {
  WorkflowState,
  WorkflowEvent,
  WorkflowPhase,
  AgentTask,
  AgentTaskStatus,
  JiraTicket,
  AgentMessage,
} from "@/lib/workflow/types";

// ─── Visual State Types ──────────────────────────────────────────────────────

export type PhaseVisualStatus = "inactive" | "active" | "done" | "error";
export type AgentVisualStatus = "idle" | "working" | "done" | "error";

export interface PipelinePhaseState {
  id: WorkflowPhase;
  label: string;
  visualStatus: PhaseVisualStatus;
  agents: PipelineAgentState[];
}

export interface PipelineAgentState {
  id: string;
  name: string;
  role: string;
  visualStatus: AgentVisualStatus;
  ticketId?: string;
  outputPreview?: string;
  branch?: string;
  error?: string;
}

export interface PipelineState {
  workflowState: WorkflowState | null;
  tickets: JiraTicket[];
  messages: AgentMessage[];
  streamingText: Record<string, string>;
  isInitialLoad: boolean;
  isConnected: boolean;
  isCelebrating: boolean;
}

// ─── Actions ─────────────────────────────────────────────────────────────────

type PipelineAction =
  | { type: "SET_STATE"; state: WorkflowState; isReconnect?: boolean }
  | { type: "SET_TICKETS"; tickets: JiraTicket[] }
  | { type: "SET_CONNECTED"; connected: boolean }
  | { type: "EVENT"; event: WorkflowEvent }
  | { type: "INITIAL_LOAD_COMPLETE" }
  | { type: "CELEBRATE" }
  | { type: "CELEBRATE_END" };

// ─── Reducer ─────────────────────────────────────────────────────────────────

function pipelineReducer(state: PipelineState, action: PipelineAction): PipelineState {
  switch (action.type) {
    case "SET_STATE":
      return {
        ...state,
        workflowState: action.state,
        messages: action.state.messages || [],
        isInitialLoad: action.isReconnect ? false : state.isInitialLoad,
      };

    case "SET_TICKETS":
      return { ...state, tickets: action.tickets };

    case "SET_CONNECTED":
      return { ...state, isConnected: action.connected };

    case "INITIAL_LOAD_COMPLETE":
      return { ...state, isInitialLoad: false };

    case "CELEBRATE":
      return { ...state, isCelebrating: true };

    case "CELEBRATE_END":
      return { ...state, isCelebrating: false };

    case "EVENT": {
      const event = action.event;
      switch (event.type) {
        case "phase_change":
          return {
            ...state,
            workflowState: state.workflowState
              ? { ...state.workflowState, phase: event.phase }
              : state.workflowState,
          };

        case "agent_status": {
          if (!state.workflowState) return state;
          const tasks = { ...state.workflowState.agentTasks };
          if (tasks[event.agentId]) {
            tasks[event.agentId] = { ...tasks[event.agentId], status: event.status };
          } else {
            tasks[event.agentId] = {
              id: `task_${Date.now()}`,
              agentId: event.agentId,
              ticketId: event.ticketId || "",
              status: event.status,
              input: "",
            };
          }
          return {
            ...state,
            workflowState: { ...state.workflowState, agentTasks: tasks },
          };
        }

        case "agent_output":
          return {
            ...state,
            streamingText: {
              ...state.streamingText,
              [event.agentId]: (state.streamingText[event.agentId] || "") + event.chunk,
            },
          };

        case "agent_complete": {
          if (!state.workflowState) return state;
          const tasks = { ...state.workflowState.agentTasks };
          if (tasks[event.agentId]) {
            tasks[event.agentId] = {
              ...tasks[event.agentId],
              status: "complete",
              output: event.output,
              branch: event.branch,
              commitSha: event.commitSha,
            };
          }
          const newStreaming = { ...state.streamingText };
          delete newStreaming[event.agentId];
          return {
            ...state,
            workflowState: { ...state.workflowState, agentTasks: tasks },
            streamingText: newStreaming,
          };
        }

        case "message":
          return {
            ...state,
            messages: [...state.messages, event.message],
          };

        case "ticket_created":
          return {
            ...state,
            tickets: [...state.tickets, event.ticket],
          };

        case "ticket_update":
          return {
            ...state,
            tickets: state.tickets.map((t) =>
              t.id === event.ticketId ? { ...t, status: event.status } : t
            ),
          };

        case "workflow_complete":
          return {
            ...state,
            workflowState: state.workflowState
              ? { ...state.workflowState, phase: "complete" }
              : state.workflowState,
          };

        case "error":
          return state;

        default:
          return state;
      }
    }

    default:
      return state;
  }
}

// ─── Hook ────────────────────────────────────────────────────────────────────

const INITIAL_STATE: PipelineState = {
  workflowState: null,
  tickets: [],
  messages: [],
  streamingText: {},
  isInitialLoad: true,
  isConnected: false,
  isCelebrating: false,
};

export function usePipelineState(workflowId: string) {
  const [state, dispatch] = useReducer(pipelineReducer, INITIAL_STATE);
  const eventSourceRef = useRef<EventSource | null>(null);
  const celebrationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch initial state
  const fetchState = useCallback(async (isReconnect = false) => {
    try {
      const [stateRes, ticketsRes] = await Promise.all([
        fetch(`/api/workflow/${workflowId}/state`),
        fetch(`/api/workflow/${workflowId}/tickets`),
      ]);

      if (stateRes.ok) {
        const data = await stateRes.json();
        dispatch({ type: "SET_STATE", state: data, isReconnect });
      }

      if (ticketsRes.ok) {
        const data = await ticketsRes.json();
        dispatch({ type: "SET_TICKETS", tickets: data.tickets || [] });
      }

      if (!isReconnect) {
        // Allow a frame for instant state application before enabling animations
        requestAnimationFrame(() => {
          dispatch({ type: "INITIAL_LOAD_COMPLETE" });
        });
      }
    } catch {
      // Silent fail - will retry on reconnect
    }
  }, [workflowId]);

  // SSE connection
  useEffect(() => {
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectAttempts = 0;
    let stopped = false;

    const connect = () => {
      if (stopped) return;
      es = new EventSource(`/api/workflow/${workflowId}/stream`);
      eventSourceRef.current = es;

      es.onopen = () => {
        reconnectAttempts = 0;
        dispatch({ type: "SET_CONNECTED", connected: true });
      };

      es.onmessage = (event) => {
        try {
          const data: WorkflowEvent = JSON.parse(event.data);
          dispatch({ type: "EVENT", event: data });

          // Trigger celebration on workflow_complete
          if (data.type === "workflow_complete") {
            dispatch({ type: "CELEBRATE" });
            celebrationTimerRef.current = setTimeout(() => {
              dispatch({ type: "CELEBRATE_END" });
            }, 1200);
          }
        } catch {
          // skip invalid events
        }
      };

      es.onerror = () => {
        es?.close();
        dispatch({ type: "SET_CONNECTED", connected: false });
        if (stopped) return;

        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 15000);
        reconnectAttempts++;

        // Re-fetch full state on reconnect (P0: derive visual state instantly)
        fetchState(true);
        reconnectTimer = setTimeout(connect, delay);
      };
    };

    // Initial fetch then connect
    fetchState(false).then(() => connect());

    return () => {
      stopped = true;
      es?.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (celebrationTimerRef.current) clearTimeout(celebrationTimerRef.current);
    };
  }, [workflowId, fetchState]);

  return state;
}
