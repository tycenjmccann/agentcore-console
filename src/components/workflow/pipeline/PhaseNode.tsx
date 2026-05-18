"use client";

import type { PipelinePhase } from "./PipelineContext";
import { AgentCard } from "./AgentCard";
import { CheckCircle2, Play, Circle } from "lucide-react";

interface PhaseNodeProps {
  phase: PipelinePhase;
}

export function PhaseNode({ phase }: PhaseNodeProps) {
  const statusClass = {
    pending: "pipeline-phase-pending",
    active: "pipeline-phase-active",
    completed: "pipeline-phase-completed",
  }[phase.status];

  return (
    <div className={`pipeline-phase ${statusClass}`} data-phase-id={phase.id}>
      {/* Phase Header */}
      <div className="flex items-center gap-2 mb-3 px-1">
        <PhaseStatusIcon status={phase.status} />
        <h3 className="text-sm font-semibold text-gray-200">{phase.label}</h3>
        {phase.agents.length > 0 && (
          <span className="text-[10px] text-gray-500 ml-auto">
            {phase.agents.filter((a) => a.status === "complete").length}/{phase.agents.length}
          </span>
        )}
      </div>

      {/* Agent Cards */}
      <div className="space-y-2">
        {phase.agents.length === 0 ? (
          <div className="text-[10px] text-gray-600 px-1 py-2">
            {phase.status === "pending" ? "Waiting..." : "No agents assigned"}
          </div>
        ) : (
          phase.agents.map((agent) => <AgentCard key={agent.id} agent={agent} />)
        )}
      </div>
    </div>
  );
}

function PhaseStatusIcon({ status }: { status: "pending" | "active" | "completed" }) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
    case "active":
      return <Play className="w-4 h-4 text-brand-400 pipeline-phase-icon-pulse" />;
    default:
      return <Circle className="w-4 h-4 text-gray-600" />;
  }
}
