"use client";

import type { AgentPhase, AgentTask } from "@/lib/workflow/types";
import AgentCard from "./AgentCard";
import { AGENT_ROSTER } from "@/lib/workflow/agents";

interface PhaseColumnProps {
  phase: AgentPhase;
  agentTasks: Record<string, AgentTask>;
  activeTickets: Record<string, string>; // agentId → ticketId
  workflowId?: string;
  onAgentExpand?: (agentId: string) => void;
}

const PHASE_LABELS: Record<AgentPhase, string> = {
  requirements: "Requirements",
  design: "Design",
  development: "Development",
  verification: "QA Verification",
  review: "Review",
};

const PHASE_COLORS: Record<AgentPhase, string> = {
  requirements: "border-yellow-500/50",
  design: "border-blue-500/50",
  development: "border-green-500/50",
  verification: "border-orange-500/50",
  review: "border-purple-500/50",
};

export default function PhaseColumn({
  phase,
  agentTasks,
  activeTickets,
  workflowId,
  onAgentExpand,
}: PhaseColumnProps) {
  const phaseAgents = AGENT_ROSTER.filter((a) => a.phase === phase);

  // Only show agents that have tasks or active tickets
  const visibleAgents = phaseAgents.filter(
    (a) => agentTasks[a.id] || activeTickets[a.id]
  );

  if (visibleAgents.length === 0 && Object.keys(agentTasks).length > 0) {
    // Phase has no involvement in this workflow
    return null;
  }

  const completedCount = visibleAgents.filter(
    (a) => agentTasks[a.id]?.status === "complete"
  ).length;

  return (
    <div className={`border-l-2 ${PHASE_COLORS[phase]} pl-4 min-w-[280px]`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider">
          {PHASE_LABELS[phase]}
        </h3>
        {visibleAgents.length > 0 && (
          <span className="text-xs text-zinc-500">
            {completedCount}/{visibleAgents.length}
          </span>
        )}
      </div>

      <div className="space-y-2">
        {visibleAgents.map((agent) => {
          const task = agentTasks[agent.id];
          return (
            <AgentCard
              key={agent.id}
              agentId={agent.id}
              name={agent.name}
              role={agent.role.split(",")[0]} // first clause only
              status={task?.status || "idle"}
              ticketId={activeTickets[agent.id]}
              outputPreview={task?.output}
              branch={task?.branch}
              error={task?.error}
              workflowId={workflowId}
              onExpand={() => onAgentExpand?.(agent.id)}
            />
          );
        })}
      </div>
    </div>
  );
}
