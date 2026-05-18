"use client";

/**
 * PipelineBoard — Main Architecture Pipeline Visualization
 *
 * Renders the multi-phase autonomous agent pipeline with:
 * - Animated phase cards showing agent config, tools, and skills
 * - SVG connector lines between phases
 * - Real-time status updates driven by WorkflowState
 * - Step-through demo mode for showcase
 */

import { useState, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import type { PipelineState, PipelineItemStatus, PhaseStatus } from "@/lib/workflow/pipeline-types";
import type { WorkflowPhase } from "@/lib/workflow/types";
import { PIPELINE_PHASES } from "./pipeline-data";
import PhaseCard from "./PhaseCard";
import PipelineConnectors from "./PipelineConnectors";
import PipelineLegend from "./PipelineLegend";

// Phase ordering for step-through
const PHASE_ORDER: WorkflowPhase[] = [
  "intake",
  "requirements",
  "design",
  "development",
  "review",
  "complete",
];

// Map workflow phases to phase IDs
const PHASE_ID_MAP: Record<string, string> = {
  intake: "p1",
  requirements: "p2",
  design: "p3",
  development: "p4",
  review: "p5",
};

function getInitialState(): PipelineState {
  return {
    currentPhase: "intake",
    phaseStatuses: {
      p1: "inactive",
      p2: "inactive",
      p3: "inactive",
      p4: "inactive",
      p5: "inactive",
    },
    itemStatuses: {},
    agentStatuses: {},
    statusText: "Ready to start pipeline",
    statusPhase: "IDLE",
    celebrating: false,
  };
}

interface PipelineBoardProps {
  /** External workflow state — if provided, drives the visualization */
  workflowPhase?: WorkflowPhase;
  /** Callback when user clicks "Run Pipeline" in demo mode */
  onStart?: () => void;
}

export default function PipelineBoard({ workflowPhase, onStart }: PipelineBoardProps) {
  const [state, setState] = useState<PipelineState>(getInitialState);
  const [stepIndex, setStepIndex] = useState(-1);

  const phaseIds = useMemo(() => PIPELINE_PHASES.map((p) => p.id), []);

  // Advance the pipeline one step (demo mode)
  const advanceStep = useCallback(() => {
    setStepIndex((prev) => {
      const next = prev + 1;
      if (next >= PHASE_ORDER.length) return prev;

      const phase = PHASE_ORDER[next];

      setState((s) => {
        const newPhaseStatuses = { ...s.phaseStatuses };
        const newItemStatuses = { ...s.itemStatuses };

        // Mark all previous phases as done
        for (let i = 0; i < next; i++) {
          const pid = PHASE_ID_MAP[PHASE_ORDER[i]];
          if (pid) {
            newPhaseStatuses[pid] = "done";
            // Mark all items in done phases
            const phaseConfig = PIPELINE_PHASES.find((p) => p.id === pid);
            if (phaseConfig) {
              phaseConfig.sections.forEach((sec) => {
                sec.items.forEach((item) => {
                  newItemStatuses[item.id] = "done";
                });
              });
            }
          }
        }

        // Set current phase as active
        const currentPid = PHASE_ID_MAP[phase];
        if (currentPid) {
          newPhaseStatuses[currentPid] = "active";
          // Mark current phase items as active/working
          const phaseConfig = PIPELINE_PHASES.find((p) => p.id === currentPid);
          if (phaseConfig) {
            phaseConfig.sections.forEach((sec) => {
              sec.items.forEach((item, idx) => {
                // First items active, rest working for visual variety
                newItemStatuses[item.id] = idx === 0 ? "active" : "working";
              });
            });
          }
        }

        const celebrating = phase === "complete";

        // If complete, mark everything done
        if (celebrating) {
          Object.keys(newPhaseStatuses).forEach((k) => {
            newPhaseStatuses[k] = "done";
          });
          Object.keys(newItemStatuses).forEach((k) => {
            newItemStatuses[k] = "done";
          });
        }

        return {
          ...s,
          currentPhase: phase,
          phaseStatuses: newPhaseStatuses,
          itemStatuses: newItemStatuses,
          statusPhase: phase.toUpperCase(),
          statusText: getStatusText(phase),
          celebrating,
        };
      });

      return next;
    });
  }, []);

  const handleStart = useCallback(() => {
    if (onStart) {
      onStart();
    }
    // Start step-through in demo mode
    advanceStep();
  }, [onStart, advanceStep]);

  const isComplete = state.currentPhase === "complete";
  const isIdle = stepIndex === -1;

  return (
    <div className={cn("flex flex-col items-center", state.celebrating && "celebrating")}>
      {/* Title */}
      <h1 className="pipeline-title mb-[3px]">Agentis Hub</h1>
      <p className="text-[12px] text-[#64748b] tracking-[2px] uppercase mb-4">
        Autonomous Multi-Agent Development Pipeline
      </p>

      {/* Legend */}
      <PipelineLegend />

      {/* Pipeline Canvas */}
      <div className="relative w-full min-h-[840px] overflow-x-auto">
        <PipelineConnectors phaseStatuses={state.phaseStatuses} phaseIds={phaseIds} />

        {/* Phase Cards */}
        <div className="flex items-start gap-[44px] relative z-[2] px-4">
          {PIPELINE_PHASES.map((phase) => (
            <PhaseCard
              key={phase.id}
              phase={phase}
              status={state.phaseStatuses[phase.id] || "inactive"}
              itemStatuses={state.itemStatuses}
            />
          ))}
        </div>
      </div>

      {/* Status Bar */}
      <div className="text-center mt-4 min-h-[44px]">
        {!isIdle && (
          <>
            <div className={cn(
              "text-[11px] tracking-[2px] uppercase mb-[2px]",
              state.celebrating ? "text-[#f97316]" : "text-[#0ea5e9]"
            )}>
              {state.statusPhase}
            </div>
            <div className="text-[15px] font-medium text-[#e2e8f0]">
              {state.statusText}
            </div>
          </>
        )}
      </div>

      {/* Controls */}
      <div className="mt-3">
        {isIdle ? (
          <button className="pipeline-btn" onClick={handleStart}>
            Run Pipeline
          </button>
        ) : !isComplete ? (
          <button className="pipeline-btn" onClick={advanceStep}>
            Next Phase
          </button>
        ) : (
          <button
            className="pipeline-btn"
            onClick={() => {
              setState(getInitialState());
              setStepIndex(-1);
            }}
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}

function getStatusText(phase: WorkflowPhase): string {
  switch (phase) {
    case "intake":
      return "Processing PRD and creating epic...";
    case "requirements":
      return "Analyzing requirements and decomposing tickets...";
    case "design":
      return "7 design agents working in parallel...";
    case "development":
      return "3 dev agents implementing features...";
    case "review":
      return "QA reviewing code and running tests...";
    case "complete":
      return "Pipeline complete — all tasks delivered!";
    default:
      return "";
  }
}
