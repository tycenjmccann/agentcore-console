"use client";

import { useMemo } from "react";
import type { WorkflowPhase, AgentTask } from "@/lib/workflow/types";
import type { PhaseVisualStatus } from "./usePipelineState";
import PhaseNode from "./PhaseNode";
import PhaseConnector from "./PhaseConnector";
import { AGENT_ROSTER } from "@/lib/workflow/agents";

interface PipelineCanvasProps {
  currentPhase: WorkflowPhase;
  agentTasks: Record<string, AgentTask>;
  streamingText: Record<string, string>;
  isCelebrating: boolean;
  suppressAnimation: boolean;
  onAgentExpand?: (agentId: string) => void;
}

/** Ordered pipeline phases to display */
const PIPELINE_PHASES: WorkflowPhase[] = [
  "requirements",
  "design",
  "development",
  "review",
];

/** Phase ordering index for comparison */
const PHASE_ORDER: Record<WorkflowPhase, number> = {
  intake: 0,
  requirements: 1,
  design: 2,
  development: 3,
  verification: 4,
  review: 5,
  complete: 6,
  error: -1,
};

export default function PipelineCanvas({
  currentPhase,
  agentTasks,
  streamingText,
  isCelebrating,
  suppressAnimation,
  onAgentExpand,
}: PipelineCanvasProps) {
  // Derive which phases have any agents with tasks
  const activePhases = useMemo(() => {
    const phasesWithTasks = new Set<WorkflowPhase>();
    for (const agentId of Object.keys(agentTasks)) {
      const agentDef = AGENT_ROSTER.find((a) => a.id === agentId);
      if (agentDef) {
        phasesWithTasks.add(agentDef.phase as WorkflowPhase);
      }
    }
    // Always show at least the current phase
    phasesWithTasks.add(currentPhase === "intake" ? "requirements" : currentPhase);
    return PIPELINE_PHASES.filter((p) => phasesWithTasks.has(p));
  }, [agentTasks, currentPhase]);

  // Derive visual status for each phase
  const getPhaseVisualStatus = (phase: WorkflowPhase): PhaseVisualStatus => {
    if (currentPhase === "error") return "error";
    if (currentPhase === "complete") return "done";

    const currentOrder = PHASE_ORDER[currentPhase];
    const phaseOrder = PHASE_ORDER[phase];

    if (phaseOrder < currentOrder) return "done";
    if (phaseOrder === currentOrder) return "active";
    // intake maps to requirements phase
    if (currentPhase === "intake" && phase === "requirements") return "active";
    return "inactive";
  };

  return (
    <div className="relative">
      {/* Horizontal scrollable pipeline */}
      <div className="flex items-stretch gap-0 overflow-x-auto pb-4 scrollbar-thin">
        {activePhases.map((phase, index) => {
          const visualStatus = getPhaseVisualStatus(phase);
          const nextPhase = activePhases[index + 1];
          const nextVisualStatus = nextPhase ? getPhaseVisualStatus(nextPhase) : "inactive";

          return (
            <div key={phase} className="flex items-center">
              <PhaseNode
                phase={phase}
                visualStatus={visualStatus}
                agentTasks={agentTasks}
                streamingText={streamingText}
                isCelebrating={isCelebrating}
                suppressAnimation={suppressAnimation}
                onAgentExpand={onAgentExpand}
              />

              {/* Connector to next phase */}
              {index < activePhases.length - 1 && (
                <PhaseConnector
                  fromStatus={visualStatus}
                  toStatus={nextVisualStatus}
                  suppressAnimation={suppressAnimation}
                  isCelebrating={isCelebrating}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Status bar */}
      <div className={`
        mt-4 flex items-center gap-3 px-4 py-2.5 rounded-lg
        bg-surface-1 border border-surface-4
        ${!suppressAnimation ? "transition-all duration-300" : ""}
        ${isCelebrating ? "border-orange-500/40 bg-orange-500/5" : ""}
      `}>
        <div className={`w-2 h-2 rounded-full ${
          currentPhase === "complete"
            ? "bg-green-500"
            : currentPhase === "error"
            ? "bg-red-500"
            : "bg-brand-500 animate-pulse"
        }`} />
        <span className="text-xs text-zinc-400">
          {currentPhase === "complete" ? (
            <span className="text-green-400">Workflow complete</span>
          ) : currentPhase === "error" ? (
            <span className="text-red-400">Workflow error</span>
          ) : (
            <>
              <span className="text-zinc-300">Phase:</span>{" "}
              <span className="text-brand-400 capitalize">{currentPhase}</span>
              {" "}&mdash;{" "}
              <span className="text-zinc-500">
                {Object.values(agentTasks).filter((t) => t.status === "running").length} agent(s) working
              </span>
            </>
          )}
        </span>

        {/* Connection status */}
        <div className="ml-auto flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500/60" />
          <span className="text-[10px] text-zinc-600">Live</span>
        </div>
      </div>
    </div>
  );
}
