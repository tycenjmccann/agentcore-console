"use client";

import { useState, useCallback } from "react";
import type { WorkflowState, AgentTask } from "@/lib/workflow/types";
import { PIPELINE_PHASES } from "@/lib/pipeline-config";
import type { PipelinePhaseConfig } from "@/lib/pipeline-config";
import MobileAgentOverlay from "./MobileAgentOverlay";

interface CompactPipelineViewProps {
  state: WorkflowState;
  streamingText: Record<string, string>;
  isMobile: boolean;
}

type PhaseStatus = "waiting" | "active" | "complete";
type AgentStatus = "waiting" | "running" | "complete" | "error";

const PHASE_ORDER_MAP: Record<string, number> = (() => {
  const order: Record<string, number> = {};
  PIPELINE_PHASES.forEach((phase, idx) => {
    order[phase.id] = idx;
    if (phase.agentPhase !== phase.id) {
      order[phase.agentPhase] = idx;
    }
  });
  order["review"] = PIPELINE_PHASES.length - 1;
  order["complete"] = PIPELINE_PHASES.length;
  order["error"] = -1;
  return order;
})();

function getPhaseStatus(phaseIndex: number, currentPhaseIndex: number, isComplete: boolean): PhaseStatus {
  if (isComplete) return "complete";
  if (phaseIndex < currentPhaseIndex) return "complete";
  if (phaseIndex === currentPhaseIndex) return "active";
  return "waiting";
}

function getAgentStatus(task: AgentTask | undefined): AgentStatus {
  if (!task) return "waiting";
  if (task.status === "complete") return "complete";
  if (task.status === "running" || task.status === "waiting_response") return "running";
  if (task.status === "error") return "error";
  return "waiting";
}

function getPhaseProgress(phase: PipelinePhaseConfig, agentTasks: Record<string, AgentTask>): number {
  if (phase.agents.length === 0) return 0;
  const completed = phase.agents.filter((a) => agentTasks[a.id]?.status === "complete").length;
  return Math.round((completed / phase.agents.length) * 100);
}

const PHASE_ICONS: Record<string, string> = {
  intake: "📥",
  requirements: "📋",
  design: "🎨",
  development: "💻",
  qa: "✅",
};

export default function CompactPipelineView({
  state,
  streamingText,
  isMobile,
}: CompactPipelineViewProps) {
  const [expandedPhase, setExpandedPhase] = useState<string | null>(null);
  const [mobileOverlayAgent, setMobileOverlayAgent] = useState<string | null>(null);

  const currentPhaseIndex = PHASE_ORDER_MAP[state.phase] ?? -1;
  const isComplete = state.phase === "complete";

  const handlePhaseClick = useCallback((phaseId: string) => {
    setExpandedPhase((current) => (current === phaseId ? null : phaseId));
  }, []);

  const handleAgentClick = useCallback(
    (agentId: string) => {
      if (isMobile) {
        setMobileOverlayAgent(agentId);
      }
    },
    [isMobile]
  );

  const closeMobileOverlay = useCallback(() => {
    setMobileOverlayAgent(null);
  }, []);

  return (
    <div className="compact-pipeline">
      {/* Header */}
      <div className="compact-pipeline-header">
        <h2 className="compact-pipeline-title">Pipeline Progress</h2>
        <div className="compact-pipeline-status">
          <span className={`compact-status-badge compact-status-${isComplete ? "complete" : "active"}`}>
            {isComplete ? "Complete" : state.phase}
          </span>
        </div>
      </div>

      {/* Phase Rows */}
      <div className="compact-phase-list" role="list">
        {PIPELINE_PHASES.map((phase, idx) => {
          const phaseStatus = getPhaseStatus(idx, currentPhaseIndex, isComplete);
          const progress = getPhaseProgress(phase, state.agentTasks);
          const isExpanded = expandedPhase === phase.id;

          return (
            <div
              key={phase.id}
              className={`compact-phase-row compact-phase-${phaseStatus}`}
              role="listitem"
            >
              {/* Phase Row Header */}
              <button
                className="compact-phase-header"
                onClick={() => handlePhaseClick(phase.id)}
                aria-expanded={isExpanded}
                aria-controls={`phase-detail-${phase.id}`}
                aria-label={`Phase ${phase.num}: ${phase.name} - ${phaseStatus}`}
              >
                {/* Phase Icon */}
                <span className="compact-phase-icon" aria-hidden="true">
                  {PHASE_ICONS[phase.id] || "⚙️"}
                </span>

                {/* Phase Name */}
                <span className="compact-phase-name">
                  <span className="compact-phase-num">P{phase.num}</span>
                  {phase.name}
                </span>

                {/* Agent Status Pills */}
                <div className="compact-agent-pills" aria-label={`${phase.agents.length} agents`}>
                  {phase.agents.map((agent) => {
                    const agentStatus = getAgentStatus(state.agentTasks[agent.id]);
                    return (
                      <span
                        key={agent.id}
                        className={`compact-pill compact-pill-${agentStatus}`}
                        title={`${agent.displayName}: ${agentStatus}`}
                        aria-label={`${agent.displayName}: ${agentStatus}`}
                      />
                    );
                  })}
                  {phase.agents.length === 0 && phaseStatus !== "waiting" && (
                    <span
                      className={`compact-pill compact-pill-${phaseStatus === "complete" ? "complete" : "running"}`}
                    />
                  )}
                </div>

                {/* Progress bar */}
                <div className="compact-progress-container">
                  <div
                    className={`compact-progress-bar compact-progress-${phaseStatus}`}
                    style={{ width: `${phaseStatus === "complete" ? 100 : progress}%` }}
                    role="progressbar"
                    aria-valuenow={phaseStatus === "complete" ? 100 : progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                </div>

                {/* Expand chevron */}
                <svg
                  className={`compact-chevron ${isExpanded ? "compact-chevron-open" : ""}`}
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  aria-hidden="true"
                >
                  <path d="M4 5.5L7 8.5L10 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {/* Expanded Agent Details (Accordion) */}
              <div
                id={`phase-detail-${phase.id}`}
                className={`compact-phase-detail ${isExpanded ? "compact-phase-detail-open" : ""}`}
                role="region"
                aria-labelledby={`phase-btn-${phase.id}`}
                hidden={!isExpanded}
              >
                {phase.agents.length > 0 ? (
                  <div className="compact-agent-list">
                    {phase.agents.map((agent) => {
                      const task = state.agentTasks[agent.id];
                      const agentStatus = getAgentStatus(task);
                      const hasOutput = !!(task?.output || streamingText[agent.id]);

                      return (
                        <div
                          key={agent.id}
                          className={`compact-agent-row compact-agent-${agentStatus}`}
                          onClick={() => handleAgentClick(agent.id)}
                          role={isMobile ? "button" : undefined}
                          tabIndex={isMobile ? 0 : undefined}
                          aria-label={isMobile ? `View output for ${agent.displayName}` : undefined}
                        >
                          <span className={`compact-agent-dot compact-dot-${agentStatus}`} />
                          <span className="compact-agent-name">{agent.displayName}</span>
                          <span className={`compact-agent-status-text compact-text-${agentStatus}`}>
                            {agentStatus === "running" ? "Working..." : agentStatus === "complete" ? "Done" : agentStatus === "error" ? "Error" : "Waiting"}
                          </span>
                          {hasOutput && !isMobile && (
                            <span className="compact-agent-output-preview">
                              {(streamingText[agent.id] || task?.output || "").slice(0, 60)}...
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="compact-phase-no-agents">
                    <span className="compact-no-agents-text">
                      {phase.type === "app" ? "Web application — no agents" : "No agents configured"}
                    </span>
                  </div>
                )}

                {/* Tools summary */}
                {phase.tools.length > 0 && (
                  <div className="compact-tools-summary">
                    <span className="compact-tools-label">Tools:</span>
                    {phase.tools.map((tool, i) => (
                      <span key={i} className="compact-tool-chip">{tool.label}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile Agent Overlay */}
      {isMobile && mobileOverlayAgent && (
        <MobileAgentOverlay
          agentId={mobileOverlayAgent}
          agentTask={state.agentTasks[mobileOverlayAgent]}
          streamingText={streamingText[mobileOverlayAgent]}
          onClose={closeMobileOverlay}
        />
      )}
    </div>
  );
}
