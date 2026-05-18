"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { WorkflowState, WorkflowPhase, AgentTask, WorkflowEvent } from "@/lib/workflow/types";
import awsIcons from "@/lib/aws-icons.json";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface PipelineVisualizationProps {
  workflowState: WorkflowState | null;
  onStepClick?: (phaseId: string, itemId: string) => void;
}

type PhaseVisualState = "idle" | "active" | "done";

interface PhaseConfig {
  id: string;
  num: number;
  name: string;
  phaseKey: WorkflowPhase;
  type: "app" | "agent";
  agentCount?: number;
  identity: {
    label?: string;
    icons?: { src: string; alt: string }[];
    descriptions?: string[];
  };
  config: { key: string; value: string }[];
  sections: {
    label: string;
    items: {
      id: string;
      icon?: string;
      dot?: "skill" | "ext";
      label: string;
      agentId?: string; // maps to agentTasks key for per-agent status
    }[];
  }[];
}

// ─── Phase Configuration (matches reference HTML exactly) ────────────────────

const PHASE_ORDER: WorkflowPhase[] = ["intake", "requirements", "design", "development", "verification", "review"];

const PHASES: PhaseConfig[] = [
  {
    id: "p1",
    num: 1,
    name: "Intake",
    phaseKey: "intake",
    type: "app",
    identity: { label: "Next.js 14 / App Router" },
    config: [
      { key: "Host", value: "localhost:3000" },
      { key: "Storage", value: "S3 multipart upload" },
      { key: "Trigger", value: "EventBridge on epic create" },
    ],
    sections: [
      {
        label: "User Actions",
        items: [
          { id: "i-prd", dot: "ext", label: "Upload PRD / Mockup / Figma" },
          { id: "i-repo", dot: "ext", label: "Set Target Git Repo" },
          { id: "i-s3", icon: "s3", label: "S3 Artifact Storage" },
        ],
      },
      {
        label: "Trigger",
        items: [
          { id: "i-epic", icon: "eventbridge", label: "Jira Epic Created (EventBridge)" },
        ],
      },
    ],
  },
  {
    id: "p2",
    num: 2,
    name: "Requirements",
    phaseKey: "requirements",
    type: "agent",
    agentCount: 1,
    identity: {
      icons: [
        { src: awsIcons.agentcore, alt: "AgentCore" },
        { src: awsIcons.bedrock, alt: "Bedrock" },
      ],
      descriptions: ["AgentCore Runtime", "Claude Opus 4 (via Bedrock)"],
    },
    config: [
      { key: "Model", value: "us.anthropic.claude-opus-4-0-v1" },
      { key: "Memory", value: "built-in (short-term context)" },
      { key: "Max turns", value: "50" },
      { key: "Timeout", value: "15 min" },
    ],
    sections: [
      {
        label: "Tools",
        items: [
          { id: "r-s3", icon: "s3", label: "S3 Read & Write" },
          { id: "r-memory", icon: "agentcore", label: "Memory Read/Write" },
          { id: "r-gateway", dot: "ext", label: "Gateway (Figma, Browser)" },
        ],
      },
      {
        label: "Agent",
        items: [
          { id: "r-agent", icon: "agentcore", label: "Requirements Analyst", agentId: "team-requirements-analyst" },
        ],
      },
      {
        label: "Skills (loaded: requirements-analysis)",
        items: [
          { id: "r-parse", dot: "skill", label: "PRD Parsing & Visual Analysis" },
          { id: "r-criteria", dot: "skill", label: "Acceptance Criteria Generation" },
          { id: "r-decomp", dot: "skill", label: "Vertical-Slice Ticket Decomposition" },
        ],
      },
      {
        label: "Output",
        items: [
          { id: "r-s3write", icon: "s3", label: "Write artifacts to S3" },
          { id: "r-jira", icon: "agentcore", label: "Gateway: report_completion (tickets)" },
        ],
      },
    ],
  },
  {
    id: "p3",
    num: 3,
    name: "Design",
    phaseKey: "design",
    type: "agent",
    agentCount: 7,
    identity: {
      icons: [
        { src: awsIcons.agentcore, alt: "AgentCore" },
        { src: awsIcons.bedrock, alt: "Bedrock" },
      ],
      descriptions: ["AgentCore Runtime (x7 parallel)", "Claude Opus 4 / Sonnet 4"],
    },
    config: [
      { key: "Dispatch", value: "parallel fan-out, 7 runtimes" },
      { key: "Memory", value: "built-in + shared namespace" },
      { key: "A2A", value: "cross-agent query enabled" },
    ],
    sections: [
      {
        label: "Tools (all agents)",
        items: [
          { id: "d-s3", icon: "s3", label: "S3 Read & Write" },
          { id: "d-memory", icon: "agentcore", label: "Memory + A2A Messaging" },
          { id: "d-a2a", dot: "ext", label: "A2A + Gateway + Figma" },
        ],
      },
      {
        label: "Agents (parallel)",
        items: [
          { id: "d-ios", icon: "agentcore", label: "iOS Architecture Designer", agentId: "team-ios-designer" },
          { id: "d-backend", icon: "agentcore", label: "Backend Systems Designer", agentId: "team-backend-designer" },
          { id: "d-android", icon: "agentcore", label: "Android Designer", agentId: "team-android-designer" },
          { id: "d-security", icon: "agentcore", label: "Security Reviewer", agentId: "team-security-reviewer" },
          { id: "d-analytics", icon: "agentcore", label: "Analytics Designer", agentId: "team-analytics-designer" },
          { id: "d-legal", icon: "agentcore", label: "Privacy & Compliance", agentId: "team-legal-compliance" },
          { id: "d-i18n", icon: "agentcore", label: "Localization Planner", agentId: "team-localization" },
        ],
      },
      {
        label: "Skills",
        items: [
          { id: "d-sk1", dot: "skill", label: "Domain-Specific Design" },
          { id: "d-sk2", dot: "skill", label: "Architecture Patterns" },
          { id: "d-sk3", dot: "skill", label: "Security & Compliance" },
        ],
      },
      {
        label: "Output",
        items: [
          { id: "d-s3write", icon: "s3", label: "Design docs to S3" },
          { id: "d-jira", icon: "agentcore", label: "Gateway: report_completion" },
        ],
      },
    ],
  },
  {
    id: "p4",
    num: 4,
    name: "Development",
    phaseKey: "development",
    type: "agent",
    agentCount: 3,
    identity: {
      icons: [
        { src: awsIcons.agentcore, alt: "AgentCore" },
        { src: awsIcons.bedrock, alt: "Bedrock" },
      ],
      descriptions: ["AgentCore Runtime (x3 parallel)", "Claude Sonnet 4 (via Bedrock)"],
    },
    config: [
      { key: "Dispatch", value: "parallel fan-out, 3 runtimes" },
      { key: "Branch", value: "shared feature branch" },
      { key: "Tools", value: "Git + Code Interpreter" },
    ],
    sections: [
      {
        label: "Tools (all agents)",
        items: [
          { id: "v-s3", icon: "s3", label: "S3 Read (design docs)" },
          { id: "v-code", icon: "codebuild", label: "Code Interpreter sandbox" },
          { id: "v-memory", icon: "agentcore", label: "Memory + A2A + Gateway" },
          { id: "v-git", dot: "ext", label: "Git — clone repo, feature branch" },
        ],
      },
      {
        label: "Agents (parallel)",
        items: [
          { id: "v-backend", icon: "agentcore", label: "Backend Developer", agentId: "team-backend-dev" },
          { id: "v-frontend", icon: "agentcore", label: "Frontend Developer", agentId: "team-frontend-dev" },
          { id: "v-api", icon: "agentcore", label: "API Developer", agentId: "team-api-dev" },
        ],
      },
      {
        label: "Skills",
        items: [
          { id: "v-sk1", dot: "skill", label: "Node/TypeScript Development" },
          { id: "v-sk2", dot: "skill", label: "Full-Stack Implementation" },
          { id: "v-sk3", dot: "skill", label: "GitHub Workflow" },
        ],
      },
      {
        label: "Output",
        items: [
          { id: "v-branch", dot: "ext", label: "Feature branch (shared)" },
          { id: "v-jira", icon: "agentcore", label: "Gateway: report_completion" },
        ],
      },
    ],
  },
  {
    id: "p5",
    num: 5,
    name: "QA & Ship",
    phaseKey: "verification",
    type: "agent",
    agentCount: 2,
    identity: {
      icons: [
        { src: awsIcons.agentcore, alt: "AgentCore" },
        { src: awsIcons.codebuild, alt: "CodeBuild" },
      ],
      descriptions: ["AgentCore Runtime (x2)", "Code Interpreter (testing)"],
    },
    config: [
      { key: "Dispatch", value: "sequential (verify then ship)" },
      { key: "Retries", value: "3 fix cycles max" },
      { key: "Merge", value: "auto-merge on pass" },
    ],
    sections: [
      {
        label: "Tools",
        items: [
          { id: "q-git", dot: "ext", label: "Git CLI — reading feature branch" },
          { id: "q-code", icon: "codebuild", label: "Code Interpreter — test sandbox" },
          { id: "q-memory", icon: "agentcore", label: "Memory + A2A + Gateway" },
        ],
      },
      {
        label: "Agents",
        items: [
          { id: "q-verifier", icon: "agentcore", label: "QA Verifier", agentId: "team-qa-verifier" },
          { id: "q-ci", icon: "agentcore", label: "CI Validation Agent", agentId: "team-ci-agent" },
        ],
      },
      {
        label: "Skills",
        items: [
          { id: "q-review", dot: "skill", label: "Visual Regression + Pixel Compare" },
          { id: "q-test", dot: "skill", label: "E2E Tests (Playwright)" },
          { id: "q-ci-skill", dot: "skill", label: "CI Failure Analysis + Auto-fix" },
          { id: "q-retry", dot: "skill", label: "Retry Loop (A2A fix request, 3x)" },
        ],
      },
      {
        label: "Output",
        items: [
          { id: "q-pr", dot: "ext", label: "Pull Request (auto-merge ready)" },
          { id: "q-done", icon: "agentcore", label: "Workflow Complete" },
        ],
      },
    ],
  },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getPhaseVisualState(phaseKey: WorkflowPhase, currentPhase: WorkflowPhase): PhaseVisualState {
  const currentIdx = PHASE_ORDER.indexOf(currentPhase);
  const thisIdx = PHASE_ORDER.indexOf(phaseKey);

  if (currentPhase === "complete") return "done";
  if (currentPhase === "error") {
    return thisIdx <= currentIdx ? "done" : "idle";
  }
  // Both "verification" and "review" map to QA & Ship (phase 5)
  if (phaseKey === "verification") {
    if (currentPhase === "verification" || currentPhase === "review") return "active";
    if (currentIdx > PHASE_ORDER.indexOf("verification")) return "done";
    return "idle";
  }

  if (thisIdx < currentIdx) return "done";
  if (thisIdx === currentIdx) return "active";
  return "idle";
}

function getAgentItemClass(agentId: string | undefined, agentTasks: Record<string, AgentTask>, phaseState: PhaseVisualState): string {
  if (!agentId) {
    // Non-agent items: show based on phase state
    if (phaseState === "done") return "done";
    if (phaseState === "active") return "active";
    return "";
  }
  // Agent-specific items: use individual task status
  const task = agentTasks[agentId];
  if (!task) {
    if (phaseState === "done") return "done";
    return "";
  }
  switch (task.status) {
    case "running":
    case "waiting_response":
      return "working";
    case "complete":
      return "done";
    case "error":
      return "done";
    case "pending":
      return phaseState === "active" ? "active" : "";
    default:
      return "";
  }
}

function getStatusDescription(phase: WorkflowPhase, agentTasks: Record<string, AgentTask>): { label: string; text: string } {
  const runningCount = Object.values(agentTasks).filter(
    (t) => t.status === "running" || t.status === "waiting_response"
  ).length;

  switch (phase) {
    case "intake":
      return { label: "Phase 1 — Intake", text: "Collecting requirements and sources..." };
    case "requirements":
      return {
        label: "Phase 2 — Requirements",
        text: runningCount > 0 ? "Requirements Analyst agent working..." : "Analyzing PRD and generating tickets...",
      };
    case "design":
      return {
        label: "Phase 3 — Design (7 Agents Parallel)",
        text: runningCount > 0 ? `${runningCount} design agent${runningCount > 1 ? "s" : ""} running in parallel` : "Design agents working...",
      };
    case "development":
      return {
        label: "Phase 4 — Development (3 Agents Parallel)",
        text: runningCount > 0 ? `${runningCount} dev agent${runningCount > 1 ? "s" : ""} running in parallel on shared branch` : "Developers implementing features...",
      };
    case "verification":
    case "review":
      return { label: "Phase 5 — QA & Ship", text: "QA Verifier + CI Agent running verification" };
    case "complete":
      return { label: "PIPELINE COMPLETE", text: `${Object.keys(agentTasks).length} agents across 5 phases — real code shipped — zero human intervention` };
    case "error":
      return { label: "Error", text: "Workflow encountered an error." };
    default:
      return { label: "Idle", text: "Waiting to start..." };
  }
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function PipelineVisualization({ workflowState, onStepClick }: PipelineVisualizationProps) {
  const [celebrating, setCelebrating] = useState(false);
  const [liveState, setLiveState] = useState<WorkflowState | null>(workflowState);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    setLiveState(workflowState);
  }, [workflowState]);

  // Trigger celebration on complete
  useEffect(() => {
    if (liveState?.phase === "complete" && !celebrating) {
      setCelebrating(true);
      setTimeout(() => setCelebrating(false), 1500);
    }
  }, [liveState?.phase, celebrating]);

  // SSE connection for live updates
  useEffect(() => {
    if (!liveState?.id) return;

    const es = new EventSource(`/api/workflow/${liveState.id}/stream`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data: WorkflowEvent = JSON.parse(event.data);
        handleSSEEvent(data);
      } catch {
        // Ignore parse errors
      }
    };

    es.onerror = () => {
      // EventSource auto-reconnects
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveState?.id]);

  const handleSSEEvent = useCallback((event: WorkflowEvent) => {
    setLiveState((prev) => {
      if (!prev) return prev;
      switch (event.type) {
        case "phase_change":
          return { ...prev, phase: event.phase };
        case "agent_status": {
          const existingTask = prev.agentTasks[event.agentId];
          return {
            ...prev,
            agentTasks: {
              ...prev.agentTasks,
              [event.agentId]: existingTask
                ? { ...existingTask, status: event.status }
                : { id: `task_${Date.now()}`, agentId: event.agentId, ticketId: event.ticketId || "", status: event.status, input: "" },
            },
          };
        }
        case "agent_complete":
          return {
            ...prev,
            agentTasks: {
              ...prev.agentTasks,
              [event.agentId]: {
                ...(prev.agentTasks[event.agentId] || { id: `task_${Date.now()}`, agentId: event.agentId, ticketId: "", input: "" }),
                status: "complete",
                output: event.output,
                branch: event.branch,
                commitSha: event.commitSha,
              },
            },
          };
        case "workflow_complete":
          return { ...prev, phase: "complete", completedAt: new Date().toISOString() };
        default:
          return prev;
      }
    });
  }, []);

  const currentPhase = liveState?.phase ?? "intake";
  const agentTasks = liveState?.agentTasks ?? {};
  const status = getStatusDescription(currentPhase, agentTasks);

  function handleItemClick(phaseId: string, itemId: string, agentId?: string) {
    onStepClick?.(phaseId, itemId);
    if (agentId && agentTasks[agentId]) {
      setExpandedAgent((prev) => (prev === agentId ? null : agentId));
    }
  }

  return (
    <div className={`pipeline-container${celebrating ? " celebrate" : ""}`}>
      <div className="pipeline-title">Agentis Hub</div>
      <div className="pipeline-subtitle">Autonomous Multi-Agent Development Pipeline</div>

      {/* Legend with all 5 AWS icons */}
      <div className="pipeline-legend">
        <div className="legend-item">
          <img className="aws-ico" src={awsIcons.bedrock} alt="Bedrock" />
          Amazon Bedrock
        </div>
        <div className="legend-item">
          <img className="aws-ico" src={awsIcons.agentcore} alt="AgentCore" />
          Bedrock AgentCore
        </div>
        <div className="legend-item">
          <img className="aws-ico" src={awsIcons.s3} alt="S3" />
          Amazon S3
        </div>
        <div className="legend-item">
          <img className="aws-ico" src={awsIcons.eventbridge} alt="EventBridge" />
          Amazon EventBridge
        </div>
        <div className="legend-item">
          <img className="aws-ico" src={awsIcons.codebuild} alt="CodeBuild" />
          Code Interpreter
        </div>
        <div className="legend-item">
          <span className="dot skill" />
          Loaded Skill
        </div>
        <div className="legend-item">
          <span className="dot ext" />
          External
        </div>
      </div>

      {/* Canvas with SVG connectors */}
      <div className="pipeline-canvas">
        <svg className="connectors">
          <defs>
            <linearGradient id="flowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.2} />
              <stop offset="50%" stopColor="#0ea5e9" stopOpacity={0.9} />
              <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.2} />
            </linearGradient>
            <filter id="pathGlow" x="-10%" y="-10%" width="120%" height="120%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="dotGlow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {/* Connector paths between phases */}
          {PHASES.slice(0, -1).map((phase, idx) => {
            const x1 = 290 * (idx + 1) + 44 * idx;
            const x2 = x1 + 44;
            const y = 120;
            const thisState = getPhaseVisualState(phase.phaseKey, currentPhase);
            const isConnected = thisState === "done";
            return (
              <path
                key={`conn-${idx}`}
                className={`flow-path${isConnected ? " show" : ""}${isConnected ? " active" : ""}`}
                d={`M ${x1} ${y} C ${x1 + 22} ${y}, ${x2 - 22} ${y}, ${x2} ${y}`}
              />
            );
          })}
        </svg>

        {/* Pipeline phases */}
        <div className="pipeline-phases">
          {PHASES.map((phase) => {
            const phaseState = getPhaseVisualState(phase.phaseKey, currentPhase);
            const boxClass = phaseState === "active" ? "awake" : phaseState === "done" ? "done" : "";

            return (
              <div
                key={phase.id}
                className={`phase${phaseState === "active" ? " active" : ""}${phaseState === "done" ? " done" : ""}`}
              >
                <div className={`agent-box${boxClass ? " " + boxClass : ""}`}>
                  <div className="phase-num">Phase {phase.num}</div>
                  <div className="phase-name">{phase.name}</div>
                  <div className={`phase-type ${phase.type}`}>
                    {phase.type === "app"
                      ? "Web Application"
                      : `${phase.agentCount} AgentCore Harness Agent${(phase.agentCount ?? 1) > 1 ? "s" : ""}`}
                  </div>

                  {/* Identity */}
                  <div className="phase-identity">
                    {phase.identity.label && (
                      <div className="id-label" style={{ textAlign: "center", height: "auto", lineHeight: "1.4" }}>
                        {phase.identity.label}
                      </div>
                    )}
                    {phase.identity.icons && (
                      <div className="id-row">
                        <div className="id-icon-col">
                          {phase.identity.icons.map((icon, i) => (
                            <img key={i} className="id-icon" src={icon.src} alt={icon.alt} />
                          ))}
                        </div>
                        {phase.identity.descriptions && (
                          <div className="id-labels">
                            {phase.identity.descriptions.map((desc, i) => (
                              <div key={i} className="id-label">{desc}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Config */}
                  <div className="config-detail">
                    {phase.config.map((cfg, i) => (
                      <div key={i} className="cfg-row">
                        <span className="cfg-key">{cfg.key}</span>
                        <span className="cfg-val">{cfg.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Work area */}
                <div className="work-area">
                  {phase.sections.map((section, si) => (
                    <div key={si}>
                      <div className="sec-label">{section.label}</div>
                      {section.items.map((item) => {
                        const itemClass = getAgentItemClass(item.agentId, agentTasks, phaseState);
                        return (
                          <div
                            key={item.id}
                            className={`pipeline-item${itemClass ? " " + itemClass : ""}`}
                            onClick={() => handleItemClick(phase.id, item.id, item.agentId)}
                            style={{ cursor: item.agentId ? "pointer" : undefined }}
                          >
                            {item.icon && (
                              <img
                                className="svc-icon"
                                src={awsIcons[item.icon as keyof typeof awsIcons]}
                                alt={item.icon}
                              />
                            )}
                            {item.dot && <span className={`item-dot ${item.dot}`} />}
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

      {/* Status bar */}
      <div className="pipeline-status">
        <div className="status-phase-label">{status.label}</div>
        <div className="status-text">{status.text}</div>
      </div>

      {/* Expanded agent output panel */}
      {expandedAgent && agentTasks[expandedAgent] && (
        <div
          style={{
            marginTop: 16,
            background: "#1a2332",
            border: "1px solid #1e293b",
            borderRadius: 8,
            padding: 16,
            maxWidth: 800,
            width: "100%",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>
              {expandedAgent} — Output
            </span>
            <button
              onClick={() => setExpandedAgent(null)}
              style={{
                background: "transparent",
                border: "1px solid #475569",
                color: "#94a3b8",
                borderRadius: 4,
                padding: "2px 8px",
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 8, fontSize: 10, color: "#64748b" }}>
            <span>Status: {agentTasks[expandedAgent].status}</span>
            {agentTasks[expandedAgent].branch && <span>Branch: {agentTasks[expandedAgent].branch}</span>}
            {agentTasks[expandedAgent].commitSha && <span>Commit: {agentTasks[expandedAgent].commitSha?.slice(0, 7)}</span>}
          </div>
          <pre
            style={{
              fontSize: 11,
              color: "#94a3b8",
              background: "#0f1419",
              padding: 12,
              borderRadius: 4,
              maxHeight: 300,
              overflow: "auto",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {agentTasks[expandedAgent].output || "(No output yet — agent is working...)"}
          </pre>
        </div>
      )}
    </div>
  );
}
