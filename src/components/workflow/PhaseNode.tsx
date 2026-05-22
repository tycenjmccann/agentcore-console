"use client";

import type { WorkflowPhase, AgentTask } from "@/lib/workflow/types";
import type { PhaseVisualStatus } from "./usePipelineState";
import { AGENT_ROSTER } from "@/lib/workflow/agents";
import PipelineAgentCard from "./PipelineAgentCard";

interface PhaseNodeProps {
  phase: WorkflowPhase;
  visualStatus: PhaseVisualStatus;
  agentTasks: Record<string, AgentTask>;
  streamingText: Record<string, string>;
  isCelebrating: boolean;
  suppressAnimation: boolean;
  onAgentExpand?: (agentId: string) => void;
  workflowId?: string;
  onViewArtifacts?: (agentId: string, agentName: string) => void;
}

const PHASE_LABELS: Partial<Record<WorkflowPhase, string>> = {
  intake: "Intake",
  requirements: "Requirements",
  design: "Design",
  development: "Development",
  review: "Review",
  complete: "Complete",
};

const PHASE_ICONS: Partial<Record<WorkflowPhase, string>> = {
  intake: "✉",
  requirements: "📋",
  design: "🎨",
  development: "⚙️",
  review: "🔍",
  complete: "✅",
};

export default function PhaseNode({
  phase,
  visualStatus,
  agentTasks,
  streamingText,
  isCelebrating,
  suppressAnimation,
  onAgentExpand,
  workflowId,
  onViewArtifacts,
}: PhaseNodeProps) {
  // Get agents assigned to this phase that have tasks
  const phaseAgents = AGENT_ROSTER.filter(
    (a) => a.phase === phase || (phase === "intake" && a.id === "team-requirements-analyst")
  );

  // Only show agents with active tasks
  const visibleAgents = phaseAgents.filter(
    (a) => agentTasks[a.id]
  );

  const completedCount = visibleAgents.filter(
    (a) => agentTasks[a.id]?.status === "complete"
  ).length;

  const totalCount = visibleAgents.length;

  const isActive = visualStatus === "active";
  const isDone = visualStatus === "done";
  const isInactive = visualStatus === "inactive";

  return (
    <div
      className={`
        relative flex flex-col
        w-[280px] min-w-[280px]
        rounded-xl border
        bg-surface-1
        ${!suppressAnimation ? "transition-all duration-500" : ""}
        ${isActive ? "border-brand-500/60 shadow-[0_0_20px_rgba(14,165,233,0.15)]" : ""}
        ${isDone ? "border-green-500/30 shadow-[0_0_12px_rgba(34,197,94,0.08)]" : ""}
        ${isInactive ? "border-surface-4 opacity-40" : ""}
        ${visualStatus === "error" ? "border-red-500/40" : ""}
        ${isCelebrating && !suppressAnimation ? "pipeline-celebrate" : ""}
      `}
    >
      {/* Phase header */}
      <div className={`
        flex items-center justify-between
        px-4 py-3 border-b
        ${isActive ? "border-brand-500/20" : isDone ? "border-green-500/10" : "border-surface-4"}
      `}>
        <div className="flex items-center gap-2">
          <span className="text-sm">{PHASE_ICONS[phase] || "📌"}</span>
          <h3 className={`text-xs font-semibold uppercase tracking-wider ${
            isActive ? "text-brand-400" : isDone ? "text-green-400" : "text-zinc-400"
          }`}>
            {PHASE_LABELS[phase] || phase}
          </h3>
        </div>

        {totalCount > 0 && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
            isDone
              ? "bg-green-500/15 text-green-400"
              : isActive
              ? "bg-brand-500/15 text-brand-400"
              : "bg-surface-3 text-zinc-600"
          }`}>
            {completedCount}/{totalCount}
          </span>
        )}
      </div>

      {/* Agent cards */}
      <div className="p-3 space-y-2 max-h-[400px] overflow-y-auto scrollbar-thin">
        {visibleAgents.length === 0 ? (
          <div className="text-xs text-zinc-600 text-center py-4">
            No agents active
          </div>
        ) : (
          visibleAgents.map((agent) => {
            const task = agentTasks[agent.id];
            return (
              <PipelineAgentCard
                key={agent.id}
                agentId={agent.id}
                name={agent.name}
                role={agent.role.split(",")[0]}
                status={task?.status || "idle"}
                ticketId={task?.ticketId}
                outputPreview={task?.output || streamingText[agent.id]}
                branch={task?.branch}
                error={task?.error}
                isCelebrating={isCelebrating}
                suppressAnimation={suppressAnimation}
                onExpand={() => onAgentExpand?.(agent.id)}
                onViewArtifacts={
                  onViewArtifacts && workflowId
                    ? () => onViewArtifacts(agent.id, agent.name)
                    : undefined
                }
              />
            );
          })
        )}
      </div>

      {/* Active phase glow indicator */}
      {isActive && !suppressAnimation && (
        <div className="absolute -inset-px rounded-xl border border-brand-500/30 pointer-events-none pipeline-phase-glow" />
      )}
    </div>
  );
}
