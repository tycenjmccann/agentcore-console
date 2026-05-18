"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type {
  WorkflowState,
  WorkflowPhase,
  AgentTaskStatus,
} from "@/lib/workflow/types";

// ── Phase configuration ─────────────────────────────────────────────────────

interface PhaseConfig {
  id: string;
  num: number;
  name: string;
  phaseType: "app" | "agent";
  phaseTypeLabel: string;
  identity: string[];
  config: Record<string, string>;
  sections: PhaseSection[];
}

interface PhaseSection {
  label: string;
  items: PhaseItem[];
}

interface PhaseItem {
  id: string;
  label: string;
  dotType: "skill" | "ext" | "svc";
}

const PHASES: PhaseConfig[] = [
  {
    id: "intake",
    num: 1,
    name: "Intake",
    phaseType: "app",
    phaseTypeLabel: "Web Application",
    identity: ["Next.js 14 / App Router"],
    config: {
      Host: "localhost:3000",
      Storage: "S3 multipart upload",
      Trigger: "EventBridge on epic create",
    },
    sections: [
      {
        label: "User Actions",
        items: [
          { id: "i-prd", label: "Upload PRD / Mockup / Figma", dotType: "ext" },
          { id: "i-repo", label: "Set Target Git Repo", dotType: "ext" },
          { id: "i-s3", label: "S3 Artifact Storage", dotType: "svc" },
        ],
      },
      {
        label: "Trigger",
        items: [
          { id: "i-epic", label: "Jira Epic Created (EventBridge)", dotType: "svc" },
        ],
      },
    ],
  },
  {
    id: "requirements",
    num: 2,
    name: "Requirements",
    phaseType: "agent",
    phaseTypeLabel: "1 AgentCore Harness Agent",
    identity: ["AgentCore Runtime", "Claude Opus 4 (via Bedrock)"],
    config: {
      Model: "us.anthropic.claude-opus-4-0-v1",
      Memory: "built-in (short-term context)",
      "Max turns": "50",
      Timeout: "15 min",
    },
    sections: [
      {
        label: "Tools",
        items: [
          { id: "r-s3", label: "S3 Read & Write", dotType: "svc" },
          { id: "r-memory", label: "Memory Read/Write", dotType: "svc" },
          { id: "r-gateway", label: "Gateway (Figma, Browser)", dotType: "ext" },
        ],
      },
      {
        label: "Agent",
        items: [
          { id: "r-agent", label: "Requirements Analyst", dotType: "svc" },
        ],
      },
      {
        label: "Skills (loaded: requirements-analysis)",
        items: [
          { id: "r-parse", label: "PRD Parsing & Visual Analysis", dotType: "skill" },
          { id: "r-criteria", label: "Acceptance Criteria Generation", dotType: "skill" },
          { id: "r-decomp", label: "Vertical-Slice Ticket Decomposition", dotType: "skill" },
        ],
      },
      {
        label: "Output",
        items: [
          { id: "r-s3write", label: "Write artifacts to S3", dotType: "svc" },
          { id: "r-jira", label: "Gateway: report_completion (tickets)", dotType: "svc" },
        ],
      },
    ],
  },
  {
    id: "design",
    num: 3,
    name: "Design",
    phaseType: "agent",
    phaseTypeLabel: "7 AgentCore Harness Agents",
    identity: ["AgentCore Runtime (x7 parallel)", "Claude Opus 4 / Sonnet 4"],
    config: {
      Dispatch: "parallel fan-out, 7 runtimes",
      Memory: "built-in + shared namespace",
      A2A: "cross-agent query enabled",
    },
    sections: [
      {
        label: "Tools (all agents)",
        items: [
          { id: "d-s3", label: "S3 Read & Write", dotType: "svc" },
          { id: "d-memory", label: "Memory Read/Write", dotType: "svc" },
          { id: "d-a2a", label: "A2A (cross-agent invoke)", dotType: "svc" },
          { id: "d-skill", label: "SkillLoader (domain skills)", dotType: "svc" },
        ],
      },
      {
        label: "Agents (parallel)",
        items: [
          { id: "d-ios", label: "iOS Designer", dotType: "skill" },
          { id: "d-android", label: "Android Designer", dotType: "skill" },
          { id: "d-backend", label: "Backend Systems Designer", dotType: "skill" },
          { id: "d-security", label: "Security Reviewer", dotType: "skill" },
          { id: "d-analytics", label: "Analytics Designer", dotType: "skill" },
          { id: "d-localization", label: "Localization Planner", dotType: "skill" },
          { id: "d-privacy", label: "Privacy/Compliance", dotType: "skill" },
        ],
      },
      {
        label: "Output",
        items: [
          { id: "d-docs", label: "Design docs to S3", dotType: "svc" },
        ],
      },
    ],
  },
  {
    id: "development",
    num: 4,
    name: "Development",
    phaseType: "agent",
    phaseTypeLabel: "3 AgentCore Harness Agents",
    identity: ["AgentCore Runtime (x3 parallel)", "Claude Sonnet 4"],
    config: {
      Dispatch: "parallel fan-out, 3 runtimes",
      Tools: "Code Interpreter + GitHub",
      Branch: "feature/{ticket-id}",
    },
    sections: [
      {
        label: "Tools (all agents)",
        items: [
          { id: "dev-s3", label: "S3 Read (design docs)", dotType: "svc" },
          { id: "dev-code", label: "Code Interpreter", dotType: "svc" },
          { id: "dev-git", label: "GitHub (branch, commit, PR)", dotType: "svc" },
          { id: "dev-a2a", label: "A2A (ask designers)", dotType: "svc" },
        ],
      },
      {
        label: "Agents (parallel)",
        items: [
          { id: "dev-frontend", label: "Frontend Dev (Swift/TS)", dotType: "skill" },
          { id: "dev-backend", label: "Backend Dev (Node/TS)", dotType: "skill" },
          { id: "dev-api", label: "API Dev (Services)", dotType: "skill" },
        ],
      },
      {
        label: "Output",
        items: [
          { id: "dev-pr", label: "Pull Requests", dotType: "svc" },
        ],
      },
    ],
  },
  {
    id: "review",
    num: 5,
    name: "Review",
    phaseType: "app",
    phaseTypeLabel: "Human + Automated",
    identity: ["PR Review & Merge"],
    config: {
      Checks: "lint, test, security scan",
      Approval: "human review required",
      Merge: "squash to main",
    },
    sections: [
      {
        label: "Automated",
        items: [
          { id: "rv-lint", label: "Lint & Format Check", dotType: "ext" },
          { id: "rv-test", label: "Unit & Integration Tests", dotType: "ext" },
          { id: "rv-security", label: "Security Scan", dotType: "ext" },
        ],
      },
      {
        label: "Human",
        items: [
          { id: "rv-review", label: "Code Review & Approval", dotType: "ext" },
          { id: "rv-merge", label: "Merge to Main", dotType: "ext" },
        ],
      },
    ],
  },
];

// ── Phase status derivation from WorkflowState ──────────────────────────────

type PhaseStatus = "pending" | "active" | "done";

function getPhaseStatus(phaseId: string, workflowPhase: WorkflowPhase): PhaseStatus {
  const order: WorkflowPhase[] = ["intake", "requirements", "design", "development", "review", "complete"];
  const currentIdx = order.indexOf(workflowPhase);
  const phaseIdx = order.indexOf(phaseId as WorkflowPhase);

  if (phaseId === "review" && workflowPhase === "complete") return "done";
  if (workflowPhase === "complete") return "done";
  if (workflowPhase === "error") {
    return phaseIdx < currentIdx ? "done" : phaseIdx === currentIdx ? "active" : "pending";
  }
  if (phaseIdx < currentIdx) return "done";
  if (phaseIdx === currentIdx) return "active";
  return "pending";
}

function getItemStatus(
  itemId: string,
  phaseStatus: PhaseStatus,
  agentTasks: Record<string, { status: AgentTaskStatus }>
): "" | "active" | "done" | "working" {
  if (phaseStatus === "done") return "done";
  if (phaseStatus === "pending") return "";

  // Map specific items to agent task status
  const agentMapping: Record<string, string> = {
    "r-agent": "team-requirements",
    "d-ios": "team-ios-designer",
    "d-android": "team-android-designer",
    "d-backend": "team-backend-designer",
    "d-security": "team-security-reviewer",
    "d-analytics": "team-analytics-designer",
    "d-localization": "team-localization",
    "d-privacy": "team-legal-compliance",
    "dev-frontend": "team-frontend-dev",
    "dev-backend": "team-backend-dev",
    "dev-api": "team-api-dev",
  };

  const agentId = agentMapping[itemId];
  if (agentId && agentTasks[agentId]) {
    const taskStatus = agentTasks[agentId].status;
    if (taskStatus === "running" || taskStatus === "waiting_response") return "working";
    if (taskStatus === "complete") return "done";
    if (taskStatus === "error") return "active";
  }

  // For active phase, show all items as active
  if (phaseStatus === "active") return "active";
  return "";
}

// ── SVG Connector Defs ──────────────────────────────────────────────────────

function ConnectorDefs() {
  return (
    <defs>
      <linearGradient id="flowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.2} />
        <stop offset="50%" stopColor="#0ea5e9" stopOpacity={0.9} />
        <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.2} />
      </linearGradient>
      <filter id="pathGlow" x="-10%" y="-10%" width="120%" height="120%">
        <feGaussianBlur stdDeviation={2} result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="dotGlow" x="-100%" y="-100%" width="300%" height="300%">
        <feGaussianBlur stdDeviation={4} result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

interface PipelineVisualizationProps {
  workflowState: WorkflowState | null;
  onStepClick?: (phaseId: string, itemId: string) => void;
}

export default function PipelineVisualization({
  workflowState,
  onStepClick,
}: PipelineVisualizationProps) {
  const [celebrating, setCelebrating] = useState(false);
  const pipelineRef = useRef<HTMLDivElement>(null);
  const [connectorPaths, setConnectorPaths] = useState<string[]>([]);

  const currentPhase: WorkflowPhase = workflowState?.phase ?? "intake";
  const agentTasks = workflowState?.agentTasks ?? {};

  // Celebrate when workflow completes
  useEffect(() => {
    if (currentPhase === "complete") {
      setCelebrating(true);
      const timer = setTimeout(() => setCelebrating(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [currentPhase]);

  // Compute SVG connector paths between phases
  const computeConnectors = useCallback(() => {
    if (!pipelineRef.current) return;
    const phases = pipelineRef.current.querySelectorAll<HTMLElement>(".phase");
    const paths: string[] = [];

    for (let i = 0; i < phases.length - 1; i++) {
      const curr = phases[i];
      const next = phases[i + 1];
      const currRect = curr.getBoundingClientRect();
      const nextRect = next.getBoundingClientRect();
      const containerRect = pipelineRef.current.getBoundingClientRect();

      const x1 = currRect.right - containerRect.left;
      const y1 = currRect.top + currRect.height / 2 - containerRect.top;
      const x2 = nextRect.left - containerRect.left;
      const y2 = nextRect.top + nextRect.height / 2 - containerRect.top;

      const midX = (x1 + x2) / 2;
      paths.push(`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`);
    }

    setConnectorPaths(paths);
  }, []);

  useEffect(() => {
    computeConnectors();
    const handleResize = () => computeConnectors();
    window.addEventListener("resize", handleResize);
    // Recompute after layout settles
    const timer = setTimeout(computeConnectors, 100);
    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(timer);
    };
  }, [computeConnectors, currentPhase]);

  // Status text
  const statusText = getStatusText(currentPhase, agentTasks);

  return (
    <div className={`pipeline-container ${celebrating ? "celebrate" : ""}`}>
      <div className="pipeline-title">Agentis Hub</div>
      <div className="pipeline-subtitle">Autonomous Multi-Agent Development Pipeline</div>

      {/* Legend */}
      <div className="pipeline-legend">
        <div className="legend-item">
          <span className="dot skill" />
          <span>Loaded Skill</span>
        </div>
        <div className="legend-item">
          <span className="dot ext" />
          <span>External</span>
        </div>
      </div>

      {/* Pipeline Canvas */}
      <div className="pipeline-canvas" ref={pipelineRef}>
        {/* SVG Connectors */}
        <svg className="connectors">
          <ConnectorDefs />
          {connectorPaths.map((path, idx) => {
            const phaseStatus = getPhaseStatus(PHASES[idx].id, currentPhase);
            const isActive = phaseStatus === "active" || phaseStatus === "done";
            const isDone = phaseStatus === "done";
            return (
              <path
                key={idx}
                className={`flow-path ${isActive ? "show" : ""} ${isDone ? "" : isActive ? "active" : ""}`}
                d={path}
              />
            );
          })}
        </svg>

        {/* Phase Cards */}
        <div className="pipeline-phases">
          {PHASES.map((phase) => {
            const phaseStatus = getPhaseStatus(phase.id, currentPhase);
            const boxClass = phaseStatus === "active" ? "awake" : phaseStatus === "done" ? "done" : "";

            return (
              <div key={phase.id} className={`phase ${phaseStatus}`}>
                <div className={`agent-box ${boxClass}`}>
                  <div className="phase-num">Phase {phase.num}</div>
                  <div className="phase-name">{phase.name}</div>
                  <div className={`phase-type ${phase.phaseType}`}>
                    {phase.phaseTypeLabel}
                  </div>

                  <div className="phase-identity">
                    {phase.identity.map((label, i) => (
                      <div key={i} className="id-label" style={{ textAlign: "center", height: "auto", lineHeight: "1.4" }}>
                        {label}
                      </div>
                    ))}
                  </div>

                  <div className="config-detail">
                    {Object.entries(phase.config).map(([key, val]) => (
                      <div key={key} className="cfg-row">
                        <span className="cfg-key">{key}</span>
                        <span className="cfg-val">{val}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="work-area">
                  {phase.sections.map((section, sIdx) => (
                    <div key={sIdx}>
                      <div className="sec-label">{section.label}</div>
                      {section.items.map((item) => {
                        const itemStatus = getItemStatus(item.id, phaseStatus, agentTasks);
                        return (
                          <div
                            key={item.id}
                            className={`pipeline-item ${itemStatus}`}
                            onClick={() => onStepClick?.(phase.id, item.id)}
                          >
                            {item.dotType === "svc" ? (
                              <span className="item-dot ext" style={{ background: "#0ea5e9" }} />
                            ) : (
                              <span className={`item-dot ${item.dotType}`} />
                            )}
                            <span className="item-label">{item.label}</span>
                            <span className="item-status" />
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Status */}
      <div className="pipeline-status">
        <div className="status-phase-label">{currentPhase}</div>
        <div className="status-text">{statusText}</div>
      </div>
    </div>
  );
}

function getStatusText(
  phase: WorkflowPhase,
  agentTasks: Record<string, { status: AgentTaskStatus }>
): string {
  switch (phase) {
    case "intake":
      return "Awaiting PRD upload and repository configuration";
    case "requirements":
      return "Analyzing requirements and decomposing into tickets";
    case "design": {
      const running = Object.values(agentTasks).filter(
        (t) => t.status === "running" || t.status === "waiting_response"
      ).length;
      return running > 0
        ? `${running} design agent${running > 1 ? "s" : ""} working in parallel`
        : "Design agents preparing...";
    }
    case "development": {
      const devRunning = Object.values(agentTasks).filter(
        (t) => t.status === "running"
      ).length;
      return devRunning > 0
        ? `${devRunning} developer${devRunning > 1 ? "s" : ""} writing code`
        : "Development agents preparing...";
    }
    case "review":
      return "Pull requests ready for review";
    case "complete":
      return "All tasks completed successfully!";
    case "error":
      return "An error occurred — check agent logs";
    default:
      return "";
  }
}
