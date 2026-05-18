"use client";

import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import type { AgentTask, AgentPhase, WorkflowEvent } from "@/lib/workflow/types";
import { usePipelineSSE } from "./usePipelineSSE";
import PhaseBox from "./PhaseBox";
import SVGConnector from "./SVGConnector";
import AgentOutputPanel from "./AgentOutputPanel";
import StatusBar from "./StatusBar";
import "./pipeline.css";

interface PipelineVisualizationProps {
  workflowId: string;
}

/** Ordered list of agent phases to display */
const PHASE_ORDER: AgentPhase[] = ["requirements", "design", "development", "review"];

/** Map workflow phases to their corresponding agent phase index */
const WORKFLOW_PHASE_INDEX: Record<string, number> = {
  intake: 0,
  requirements: 0,
  design: 1,
  development: 2,
  review: 3,
  complete: 4,
  error: 4,
};

/** Phase ordering for connector status */
const PHASE_INDEX: Record<AgentPhase, number> = {
  requirements: 0,
  design: 1,
  development: 2,
  review: 3,
};

export default function PipelineVisualization({ workflowId }: PipelineVisualizationProps) {
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [isCelebrating, setIsCelebrating] = useState(false);
  const [noAnimate, setNoAnimate] = useState(true);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Handle workflow_complete event for celebration
  const handleEvent = useCallback((event: WorkflowEvent) => {
    if (event.type === "workflow_complete") {
      setIsCelebrating(true);
      setTimeout(() => setIsCelebrating(false), 1500);
    }
  }, []);

  const { state, isConnected, isLoading, error } = usePipelineSSE({
    workflowId,
    onEvent: handleEvent,
  });

  // After initial state load, enable animations after a short delay
  // CRITICAL: prevents animation replay on reconnect/initial load
  useEffect(() => {
    if (state && noAnimate) {
      // Give the browser one frame to render without animations
      const timer = setTimeout(() => setNoAnimate(false), 100);
      return () => clearTimeout(timer);
    }
  }, [state, noAnimate]);

  // Group tasks by their agent phase based on agent ID naming convention
  const phaseGroups = useMemo(() => {
    if (!state) return {} as Record<AgentPhase, AgentTask[]>;

    const groups: Record<AgentPhase, AgentTask[]> = {
      requirements: [],
      design: [],
      development: [],
      review: [],
    };

    Object.values(state.agentTasks).forEach((task) => {
      const agentId = task.agentId;
      let phase: AgentPhase;

      if (agentId.includes("requirement") || agentId.includes("intake")) {
        phase = "requirements";
      } else if (
        agentId.includes("designer") ||
        agentId.includes("design") ||
        agentId.includes("security") ||
        agentId.includes("compliance") ||
        agentId.includes("localization") ||
        agentId.includes("analytics")
      ) {
        phase = "design";
      } else if (
        agentId.includes("dev") ||
        agentId.includes("frontend") ||
        agentId.includes("backend") ||
        agentId.includes("api") ||
        agentId.includes("i18n")
      ) {
        phase = "development";
      } else if (
        agentId.includes("review") ||
        agentId.includes("qa") ||
        agentId.includes("verif")
      ) {
        phase = "review";
      } else {
        // Default fallback
        phase = "development";
      }

      groups[phase].push(task);
    });

    return groups;
  }, [state]);

  // Only display phases that have tasks assigned (dynamic rendering)
  const visiblePhases = useMemo(() => {
    return PHASE_ORDER.filter(
      (phase) => phaseGroups[phase] && phaseGroups[phase].length > 0
    );
  }, [phaseGroups]);

  // Get connector status between phases
  const getConnectorStatus = useCallback(
    (index: number): "pending" | "active" | "done" => {
      if (!state) return "pending";
      if (state.phase === "complete") return "done";

      const currentPhaseIdx = WORKFLOW_PHASE_INDEX[state.phase] ?? 0;
      const connectorTargetPhase = visiblePhases[index + 1];
      if (!connectorTargetPhase) return "pending";

      const targetIdx = PHASE_INDEX[connectorTargetPhase];

      if (targetIdx < currentPhaseIdx) return "done";
      if (targetIdx === currentPhaseIdx) return "active";
      return "pending";
    },
    [state, visiblePhases]
  );

  // Get selected agent task for output panel
  const selectedTask = useMemo(() => {
    if (!selectedAgentId || !state) return null;
    return state.agentTasks[selectedAgentId] || null;
  }, [selectedAgentId, state]);

  // Loading state
  if (isLoading) {
    return (
      <div className="pipeline-canvas flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[var(--pipeline-active)] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-[var(--pipeline-text-muted)] text-sm">
            Loading pipeline...
          </p>
        </div>
      </div>
    );
  }

  // Error state (only show if we have no state at all)
  if (error && !state) {
    return (
      <div className="pipeline-canvas flex items-center justify-center">
        <div className="text-center">
          <p className="text-[var(--pipeline-error)] text-sm mb-2">
            Failed to load pipeline
          </p>
          <p className="text-[var(--pipeline-text-dim)] text-xs">{error}</p>
        </div>
      </div>
    );
  }

  if (!state) return null;

  const canvasClassName = [
    "pipeline-canvas",
    noAnimate ? "no-animate" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <div className={canvasClassName} ref={canvasRef}>
        <h2 className="pipeline-title">
          {state.input?.title || "Workflow Pipeline"}
        </h2>

        <div className="pipeline-scroll-container" style={{ position: "relative" }}>
          {/* SVG Layer for connectors */}
          {visiblePhases.length > 1 && (
            <svg
              className="connector-svg"
              style={{
                width: visiblePhases.length * 290 + (visiblePhases.length - 1) * 44,
                height: 120,
                position: "absolute",
                top: 0,
                left: 0,
                pointerEvents: "none",
              }}
            >
              {visiblePhases.slice(0, -1).map((_, idx) => (
                <SVGConnector
                  key={idx}
                  index={idx}
                  totalPhases={visiblePhases.length}
                  status={getConnectorStatus(idx)}
                  isCelebrating={isCelebrating}
                />
              ))}
            </svg>
          )}

          {/* Phase boxes */}
          {visiblePhases.map((phase) => (
            <PhaseBox
              key={phase}
              phase={phase}
              tasks={phaseGroups[phase] || []}
              currentWorkflowPhase={state.phase}
              isCelebrating={isCelebrating}
              onAgentClick={setSelectedAgentId}
            />
          ))}
        </div>

        <StatusBar phase={state.phase} isConnected={isConnected} />
      </div>

      {/* Agent Output Panel */}
      <AgentOutputPanel
        task={selectedTask}
        isOpen={selectedAgentId !== null}
        onClose={() => setSelectedAgentId(null)}
      />
    </>
  );
}
