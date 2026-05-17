"use client";

import { useEffect, useState, useRef } from "react";
import type {
  WorkflowState,
  WorkflowEvent,
  JiraTicket,
  AgentMessage,
  AgentTask,
  AgentTaskStatus,
  WorkflowPhase,
} from "@/lib/workflow/types";
import PhaseColumn from "./PhaseColumn";
import TicketPanel from "./TicketPanel";
import MessageFeed from "./MessageFeed";
import AgentOutput from "./AgentOutput";

interface WorkflowBoardProps {
  workflowId: string;
}

export default function WorkflowBoard({ workflowId }: WorkflowBoardProps) {
  const [state, setState] = useState<WorkflowState | null>(null);
  const [tickets, setTickets] = useState<JiraTicket[]>([]);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState<Record<string, string>>({});
  const eventSourceRef = useRef<EventSource | null>(null);

  // Fetch initial state
  useEffect(() => {
    fetch(`/api/workflow/${workflowId}/state`)
      .then((r) => r.json())
      .then((data) => {
        setState(data);
        setMessages(data.messages || []);
      });

    fetch(`/api/workflow/${workflowId}/tickets`)
      .then((r) => r.json())
      .then((data) => setTickets(data.tickets || []));
  }, [workflowId]);

  // SSE connection with auto-reconnect
  useEffect(() => {
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectAttempts = 0;
    let stopped = false;

    const connect = () => {
      if (stopped) return;
      es = new EventSource(`/api/workflow/${workflowId}/stream`);
      eventSourceRef.current = es;

      es.onopen = () => { reconnectAttempts = 0; };

      es.onmessage = (event) => {
        try {
          const data: WorkflowEvent = JSON.parse(event.data);
          handleEvent(data);
        } catch {
          // skip
        }
      };

      es.onerror = () => {
        es?.close();
        if (stopped) return;
        // Exponential backoff: 1s, 2s, 4s, 8s, max 15s
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 15000);
        reconnectAttempts++;
        // Re-fetch full state then reconnect
        fetch(`/api/workflow/${workflowId}/state`)
          .then((r) => r.json())
          .then((data) => {
            if (data && data.id) {
              setState(data);
              setMessages(data.messages || []);
            }
          })
          .catch(() => {});
        fetch(`/api/workflow/${workflowId}/tickets`)
          .then((r) => r.json())
          .then((data) => setTickets(data.tickets || []))
          .catch(() => {});
        reconnectTimer = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      stopped = true;
      es?.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [workflowId]);

  function handleEvent(event: WorkflowEvent) {
    switch (event.type) {
      case "phase_change":
        setState((s) => s ? { ...s, phase: event.phase } : s);
        break;

      case "agent_status":
        setState((s) => {
          if (!s) return s;
          const tasks = { ...s.agentTasks };
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
          return { ...s, agentTasks: tasks };
        });
        break;

      case "agent_output":
        setStreamingText((prev) => ({
          ...prev,
          [event.agentId]: (prev[event.agentId] || "") + event.chunk,
        }));
        break;

      case "agent_complete":
        setState((s) => {
          if (!s) return s;
          const tasks = { ...s.agentTasks };
          if (tasks[event.agentId]) {
            tasks[event.agentId] = {
              ...tasks[event.agentId],
              status: "complete",
              output: event.output,
              branch: event.branch,
              commitSha: event.commitSha,
            };
          }
          return { ...s, agentTasks: tasks };
        });
        setStreamingText((prev) => {
          const next = { ...prev };
          delete next[event.agentId];
          return next;
        });
        break;

      case "message":
        setMessages((prev) => [...prev, event.message]);
        break;

      case "ticket_created":
        setTickets((prev) => [...prev, event.ticket]);
        break;

      case "ticket_update":
        setTickets((prev) =>
          prev.map((t) =>
            t.id === event.ticketId ? { ...t, status: event.status } : t
          )
        );
        break;

      case "workflow_complete":
        setState((s) => s ? { ...s, phase: "complete" } : s);
        break;

      case "error":
        // Could show a toast here
        break;
    }
  }

  if (!state) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-zinc-400">Loading workflow...</div>
      </div>
    );
  }

  // Build activeTickets map (agentId → ticketId)
  const activeTickets: Record<string, string> = {};
  for (const task of Object.values(state.agentTasks)) {
    activeTickets[task.agentId] = task.ticketId;
  }

  return (
    <div className="space-y-6">
      {/* Phase indicator */}
      <div className="flex items-center gap-2">
        <PhaseIndicator phase={state.phase} />
        {state.phase === "complete" && (
          <span className="text-green-400 text-sm font-medium">Workflow Complete</span>
        )}
      </div>

      {/* Main board: phase columns */}
      <div className="flex gap-6 overflow-x-auto pb-4">
        <PhaseColumn
          phase="requirements"
          agentTasks={state.agentTasks}
          activeTickets={activeTickets}
          workflowId={workflowId}
          onAgentExpand={setExpandedAgent}
        />
        <PhaseColumn
          phase="design"
          agentTasks={state.agentTasks}
          activeTickets={activeTickets}
          workflowId={workflowId}
          onAgentExpand={setExpandedAgent}
        />
        <PhaseColumn
          phase="development"
          agentTasks={state.agentTasks}
          activeTickets={activeTickets}
          workflowId={workflowId}
          onAgentExpand={setExpandedAgent}
        />
      </div>

      {/* Bottom panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TicketPanel tickets={tickets} />
        <MessageFeed messages={messages} />
      </div>

      {/* Workflow complete summary */}
      {state.phase === "complete" && (
        <div className="bg-green-900/20 border border-green-700/50 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-green-300 mb-2">Workflow Complete</h3>
          <div className="space-y-1 text-xs text-zinc-300">
            <p>Started: {state.startedAt ? new Date(state.startedAt).toLocaleString() : "N/A"}</p>
            <p>Completed: {state.completedAt ? new Date(state.completedAt).toLocaleString() : "N/A"}</p>
            <p>Agents involved: {Object.keys(state.agentTasks).length}</p>
            {Object.values(state.agentTasks).some((t) => t.branch) && (
              <div className="mt-2">
                <p className="text-green-400 font-medium">Branches:</p>
                {Object.values(state.agentTasks)
                  .filter((t) => t.branch)
                  .map((t) => (
                    <p key={t.id} className="font-mono text-green-300 pl-2">
                      {t.branch} {t.commitSha ? `(${t.commitSha.slice(0, 7)})` : ""}
                    </p>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error state */}
      {state.phase === "error" && (
        <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-red-300 mb-1">Workflow Error</h3>
          <p className="text-xs text-red-400">{state.error || "Unknown error"}</p>
        </div>
      )}

      {/* Expanded agent output */}
      {expandedAgent && (
        <AgentOutput
          agentId={expandedAgent}
          output={state.agentTasks[expandedAgent]?.output || streamingText[expandedAgent] || ""}
          isStreaming={!!streamingText[expandedAgent]}
          onClose={() => setExpandedAgent(null)}
        />
      )}
    </div>
  );
}

function PhaseIndicator({ phase }: { phase: WorkflowPhase }) {
  const phases: WorkflowPhase[] = ["intake", "requirements", "design", "development", "review", "complete"];
  const currentIndex = phases.indexOf(phase);

  return (
    <div className="flex items-center gap-1">
      {phases.map((p, i) => (
        <div key={p} className="flex items-center gap-1">
          <div
            className={`w-2 h-2 rounded-full ${
              i < currentIndex
                ? "bg-green-500"
                : i === currentIndex
                ? "bg-blue-500 animate-pulse"
                : "bg-zinc-700"
            }`}
          />
          {i < phases.length - 1 && (
            <div className={`w-4 h-0.5 ${i < currentIndex ? "bg-green-500" : "bg-zinc-700"}`} />
          )}
        </div>
      ))}
    </div>
  );
}
