"use client";

import type { PipelineAgent } from "./PipelineContext";
import { Bot, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

interface AgentCardProps {
  agent: PipelineAgent;
}

export function AgentCard({ agent }: AgentCardProps) {
  const statusClasses = getStatusClasses(agent.status);

  return (
    <div
      className={`pipeline-agent-card ${statusClasses.container}`}
      title={agent.latestOutput || agent.name}
    >
      <div className="flex items-center gap-2 min-w-0">
        <div className={`pipeline-agent-indicator ${statusClasses.indicator}`}>
          <StatusIcon status={agent.status} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-gray-200 truncate">{agent.name}</p>
          {agent.latestOutput && (
            <p className="text-[10px] text-gray-500 truncate mt-0.5">
              {agent.latestOutput.slice(0, 60)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "running":
    case "waiting_response":
      return <Loader2 className="w-3 h-3 text-brand-400 animate-spin" />;
    case "complete":
      return <CheckCircle2 className="w-3 h-3 text-emerald-400" />;
    case "error":
      return <AlertCircle className="w-3 h-3 text-red-400" />;
    default:
      return <Bot className="w-3 h-3 text-gray-500" />;
  }
}

function getStatusClasses(status: string): {
  container: string;
  indicator: string;
} {
  switch (status) {
    case "running":
      return {
        container: "pipeline-agent-running",
        indicator: "bg-brand-500/20 border-brand-500/40",
      };
    case "waiting_response":
      return {
        container: "pipeline-agent-waiting",
        indicator: "bg-yellow-500/20 border-yellow-500/40",
      };
    case "complete":
      return {
        container: "pipeline-agent-complete",
        indicator: "bg-emerald-500/20 border-emerald-500/40",
      };
    case "error":
      return {
        container: "pipeline-agent-error",
        indicator: "bg-red-500/20 border-red-500/40",
      };
    default:
      return {
        container: "",
        indicator: "bg-surface-3 border-surface-4",
      };
  }
}
