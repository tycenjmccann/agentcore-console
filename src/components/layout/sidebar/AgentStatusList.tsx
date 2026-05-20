"use client";

import Link from "next/link";
import { Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAgentStatus, Agent } from "@/hooks/useAgentStatus";

interface AgentStatusListProps {
  collapsed: boolean;
}

function getStatusClass(status: string): string {
  switch (status) {
    case "active":
    case "running":
      return "status-running";
    case "idle":
    case "stopped":
      return "status-stopped";
    case "error":
      return "status-error";
    default:
      return "status-stopped";
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case "active":
    case "running":
      return "Active";
    case "idle":
    case "stopped":
      return "Idle";
    case "error":
      return "Error";
    default:
      return status;
  }
}

export default function AgentStatusList({ collapsed }: AgentStatusListProps) {
  const { agents, loading, error } = useAgentStatus();

  const visibleAgents = agents.slice(0, 5);
  const remainingCount = Math.max(0, agents.length - 5);

  if (collapsed) {
    return (
      <div className="px-2 py-3">
        <div className="relative group flex items-center justify-center">
          <Bot className="w-4 h-4 text-[var(--color-text-muted)]" />
          {agents.length > 0 && (
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full text-[8px] flex items-center justify-center text-white font-bold">
              {agents.filter((a) => a.status === "active" || a.status === "running").length}
            </span>
          )}
          <div className="absolute left-full ml-2 px-2 py-1 bg-surface-3 border border-surface-4 rounded text-xs text-[var(--color-text-primary)] whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-50 transition-opacity">
            {agents.length} Agents
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-3 border-t border-surface-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          Agents
        </h3>
        <span className="text-xs bg-surface-3 text-[var(--color-text-secondary)] px-1.5 py-0.5 rounded-full">
          {agents.length}
        </span>
      </div>

      {loading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-2 animate-pulse">
              <div className="w-2 h-2 rounded-full bg-surface-4" />
              <div className="h-3 bg-surface-4 rounded flex-1" />
            </div>
          ))}
        </div>
      )}

      {error && !loading && (
        <p className="text-xs text-[var(--color-text-muted)] italic">
          Unable to load agents
        </p>
      )}

      {!loading && !error && agents.length === 0 && (
        <p className="text-xs text-[var(--color-text-muted)] italic">
          No agents registered
        </p>
      )}

      {!loading && !error && visibleAgents.length > 0 && (
        <div className="space-y-1.5">
          {visibleAgents.map((agent: Agent) => (
            <div
              key={agent.id}
              className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]"
              title={`${agent.name} — ${getStatusLabel(agent.status)}`}
            >
              <span className={getStatusClass(agent.status)} aria-label={getStatusLabel(agent.status)} />
              <span className="truncate flex-1">{agent.name}</span>
            </div>
          ))}

          {remainingCount > 0 && (
            <Link
              href="/agents"
              className="text-xs text-brand-400 hover:text-brand-300 transition-colors"
            >
              +{remainingCount} more
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
