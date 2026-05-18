"use client";

import { useMemo } from "react";
import type { AgentTask, AgentPhase, WorkflowPhase } from "@/lib/workflow/types";
import AgentItem from "./AgentItem";

interface PhaseBoxProps {
  phase: AgentPhase;
  tasks: AgentTask[];
  currentWorkflowPhase: WorkflowPhase;
  isCelebrating: boolean;
  onAgentClick: (agentId: string) => void;
}

const PHASE_LABELS: Record<AgentPhase, string> = {
  requirements: "Requirements",
  design: "Design",
  development: "Development",
  verification: "Verification",
  review: "Review",
};

const PHASE_DESCRIPTIONS: Record<AgentPhase, string> = {
  requirements: "Analyze & plan tickets",
  design: "Architecture & UI design",
  development: "Implement features",
  verification: "QA & testing",
  review: "Verify & validate",
};

/** Map workflow phase to ordered agent phases for comparison */
const PHASE_ORDER: Record<string, number> = {
  intake: 0,
  requirements: 1,
  design: 2,
  development: 3,
  review: 4,
  complete: 5,
  error: 5,
};

export default function PhaseBox({
  phase,
  tasks,
  currentWorkflowPhase,
  isCelebrating,
  onAgentClick,
}: PhaseBoxProps) {
  const phaseStatus = useMemo(() => {
    const currentOrder = PHASE_ORDER[currentWorkflowPhase] ?? 0;
    const thisOrder = PHASE_ORDER[phase] ?? 0;

    if (currentWorkflowPhase === "complete") return "done";
    if (currentWorkflowPhase === "error" && thisOrder <= currentOrder) return "done";
    if (thisOrder < currentOrder) return "done";
    if (thisOrder === currentOrder) return "active";
    return "pending";
  }, [phase, currentWorkflowPhase]);

  const agentCountLabel = useMemo(() => {
    const count = tasks.length;
    if (count === 0) return "0 Agents";
    if (count === 1) return "1 Agent";
    return `${count} Agents (parallel)`;
  }, [tasks]);

  const className = [
    "phase-box",
    phaseStatus,
    isCelebrating ? "celebrate" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className} data-phase={phase}>
      <div className="phase-header">
        <span className="phase-title">{PHASE_LABELS[phase]}</span>
        <span className="phase-agent-count">{agentCountLabel}</span>
      </div>

      <div className="phase-meta">
        <span className="skill-dot" />
        <span>{PHASE_DESCRIPTIONS[phase]}</span>
      </div>

      <div className="phase-agents">
        {tasks.map((task) => (
          <AgentItem
            key={task.id}
            task={task}
            isCelebrating={isCelebrating}
            onClick={() => onAgentClick(task.agentId)}
          />
        ))}
      </div>
    </div>
  );
}
