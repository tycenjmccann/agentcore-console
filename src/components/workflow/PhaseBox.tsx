"use client";

import { useMemo, useState } from "react";
import { Users, Cpu, Wrench, BookOpen, ChevronDown, ChevronRight } from "lucide-react";
import type { AgentTask, AgentPhase, WorkflowPhase } from "@/lib/workflow/types";
import { PHASE_DISPLAY_META, type PipelinePhaseId } from "@/lib/pipeline-config";
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

const PHASE_NUMBER: Record<AgentPhase, number> = {
  requirements: 1,
  design: 2,
  development: 3,
  verification: 4,
  review: 5,
};

const AGENT_PHASE_TO_PIPELINE: Record<string, PipelinePhaseId> = {
  requirements: "requirements",
  design: "design",
  development: "development",
  verification: "qa",
  review: "qa",
};

export default function PhaseBox({
  phase,
  tasks,
  currentWorkflowPhase,
  isCelebrating,
  onAgentClick,
}: PhaseBoxProps) {
  const [agentsExpanded, setAgentsExpanded] = useState(false);

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

  const pipelinePhaseId = AGENT_PHASE_TO_PIPELINE[phase];
  const meta = PHASE_DISPLAY_META[pipelinePhaseId];
  const models = meta.identity.length || 1;
  const tools = meta.tools.length;
  const skills = meta.skills.length;

  const className = [
    "phase-box relative",
    phaseStatus,
    isCelebrating ? "celebrate" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className} data-phase={phase}>
      <span className="phase-status-badge absolute top-2 right-2 text-xs px-2 py-0.5 rounded-full">{phaseStatus}</span>
      <span className="text-xs text-gray-400 uppercase tracking-wide">Phase {PHASE_NUMBER[phase]}</span>
      <h3 className="text-xl font-bold text-white">{PHASE_LABELS[phase]}</h3>
      <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
        <span className="flex items-center gap-1"><Users size={14} />{tasks.length}</span>
        <span className="flex items-center gap-1"><Cpu size={14} />{models}</span>
        <span className="flex items-center gap-1"><Wrench size={14} />{tools}</span>
        <span className="flex items-center gap-1"><BookOpen size={14} />{skills}</span>
      </div>
      <button onClick={() => setAgentsExpanded(!agentsExpanded)} className="flex items-center gap-1 text-xs text-gray-400 mt-3 hover:text-gray-200 transition-colors">
        {agentsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {agentCountLabel}
      </button>
      {agentsExpanded && (
        <div className="phase-agents mt-2">
          {tasks.map((task) => (
            <AgentItem key={task.id} task={task} isCelebrating={isCelebrating} onClick={() => onAgentClick(task.agentId)} />
          ))}
        </div>
      )}
    </div>
  );
}
