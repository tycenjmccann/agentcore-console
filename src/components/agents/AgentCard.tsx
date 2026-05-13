"use client";

import { Bot, GitPullRequest, Clock, Cpu } from "lucide-react";
import Link from "next/link";
import { Agent } from "@/lib/types";
import { formatTimestamp } from "@/lib/utils";

interface AgentCardProps {
  agent: Agent;
}

const statusStyles: Record<string, { dot: string; label: string }> = {
  ACTIVE: { dot: "status-running", label: "Active" },
  INACTIVE: { dot: "status-stopped", label: "Inactive" },
  DEPLOYING: { dot: "status-pending", label: "Deploying" },
  ERROR: { dot: "status-error", label: "Error" },
};

export default function AgentCard({ agent }: AgentCardProps) {
  const status = statusStyles[agent.status] || statusStyles.INACTIVE;
  const successRate = agent.total_tasks > 0
    ? Math.round((agent.successful_tasks / agent.total_tasks) * 100)
    : 0;

  return (
    <Link href={`/agents/${agent.agent_id}`} data-testid={`agent-card-${agent.agent_id}`}>
      <div className="card-hover">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-surface-3 rounded-lg flex items-center justify-center">
              <Bot className="w-5 h-5 text-brand-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">{agent.name}</h3>
              <p className="text-xs text-gray-500 mt-0.5">{agent.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className={status.dot} />
            <span className="text-xs text-gray-400">{status.label}</span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="flex items-center gap-1.5">
            <GitPullRequest className="w-3.5 h-3.5 text-gray-500" />
            <span className="text-xs text-gray-400">{agent.total_tasks} tasks</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-gray-500" />
            <span className="text-xs text-gray-400">{successRate}% success</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-gray-500" />
            <span className="text-xs text-gray-400">
              {agent.last_invoked ? formatTimestamp(agent.last_invoked) : "Never"}
            </span>
          </div>
        </div>

        {agent.blueprint && (
          <div className="mt-3 pt-3 border-t border-surface-4">
            <div className="flex flex-wrap gap-1.5">
              {agent.blueprint.tools.slice(0, 4).map((tool) => (
                <span key={tool} className="text-[10px] px-1.5 py-0.5 bg-surface-3 rounded text-gray-500">
                  {tool}
                </span>
              ))}
              {agent.blueprint.tools.length > 4 && (
                <span className="text-[10px] px-1.5 py-0.5 bg-surface-3 rounded text-gray-500">
                  +{agent.blueprint.tools.length - 4}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}
