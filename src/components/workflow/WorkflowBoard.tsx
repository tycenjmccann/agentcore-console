"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import type {
  WorkflowState,
  WorkflowEvent,
  AgentTask,
  AgentTaskStatus,
  WorkflowPhase,
  AgentPhase,
} from "@/lib/workflow/types";
import awsIcons from "@/lib/aws-icons.json";

interface WorkflowBoardProps {
  workflowId: string;
}

// ─── Phase Configuration ─────────────────────────────────────────────────────

interface PhaseConfig {
  id: string;
  name: string;
  num: number;
  type: "app" | "agent";
  typeLabel: string;
  agentPhase: AgentPhase | "intake";
  identity: { icon: string; label: string }[];
  config: { key: string; val: string }[];
  tools: { icon?: string; dot?: "skill" | "ext"; label: string }[];
  skills: { label: string }[];
  outputs: { icon?: string; dot?: "skill" | "ext"; label: string }[];
}

const PHASE_CONFIGS: PhaseConfig[] = [
  {
    id: "intake",
    name: "Intake",
    num: 1,
    type: "app",
    typeLabel: "Web Application",
    agentPhase: "intake",
    identity: [{ icon: "", label: "Next.js 14 / App Router" }],
    config: [
      { key: "Host", val: "localhost:3000" },
      { key: "Storage", val: "S3 multipart upload" },
      { key: "Trigger", val: "EventBridge on epic create" },
    ],
    tools: [
      { dot: "ext", label: "Upload PRD / Mockup / Figma" },
      { dot: "ext", label: "Set Target Git Repo" },
      { icon: "s3", label: "S3 Artifact Storage" },
    ],
    skills: [],
    outputs: [{ icon: "eventbridge", label: "Jira Epic Created (EventBridge)" }],
  },
  {
    id: "requirements",
    name: "Requirements",
    num: 2,
    type: "agent",
    typeLabel: "1 AgentCore Harness Agent",
    agentPhase: "requirements",
    identity: [
      { icon: "agentcore", label: "AgentCore Runtime" },
      { icon: "bedrock", label: "Claude Opus 4 (via Bedrock)" },
    ],
    config: [
      { key: "Model", val: "us.anthropic.claude-opus-4-0-v1" },
      { key: "Memory", val: "built-in (short-term context)" },
      { key: "Max turns", val: "50" },
      { key: "Timeout", val: "15 min" },
    ],
    tools: [
      { icon: "s3", label: "S3 Read & Write" },
      { icon: "agentcore", label: "Memory Read/Write" },
      { dot: "ext", label: "Gateway (Figma, Browser)" },
    ],
    skills: [
      { label: "PRD Parsing & Visual Analysis" },
      { label: "Acceptance Criteria Generation" },
      { label: "Vertical-Slice Ticket Decomposition" },
    ],
    outputs: [
      { icon: "s3", label: "Write artifacts to S3" },
      { icon: "agentcore", label: "Gateway: report_completion (tickets)" },
    ],
  },
  {
    id: "design",
    name: "Design",
    num: 3,
    type: "agent",
    typeLabel: "7 AgentCore Harness Agents",
    agentPhase: "design",
    identity: [
      { icon: "agentcore", label: "AgentCore Runtime (x7 parallel)" },
      { icon: "bedrock", label: "Claude Opus 4 / Sonnet 4" },
    ],
    config: [
      { key: "Dispatch", val: "parallel fan-out, 7 runtimes" },
      { key: "Memory", val: "built-in + shared namespace" },
      { key: "A2A", val: "cross-agent query enabled" },
    ],
    tools: [
      { icon: "s3", label: "S3 Read & Write" },
      { icon: "agentcore", label: "Memory + A2A" },
      { dot: "ext", label: "Gateway (Jira, GitHub)" },
    ],
    skills: [
      { label: "iOS Architecture Design" },
      { label: "Backend Systems Design" },
      { label: "Privacy & Compliance" },
      { label: "Security Review" },
    ],
    outputs: [
      { icon: "s3", label: "Design docs to S3" },
      { icon: "agentcore", label: "Gateway: save_design_doc" },
    ],
  },
  {
    id: "development",
    name: "Development",
    num: 4,
    type: "agent",
    typeLabel: "3 AgentCore Harness Agents",
    agentPhase: "development",
    identity: [
      { icon: "agentcore", label: "AgentCore Runtime (x3 parallel)" },
      { icon: "bedrock", label: "Claude Opus 4 / Sonnet 4" },
    ],
    config: [
      { key: "Dispatch", val: "parallel fan-out, 3 runtimes" },
      { key: "Tools", val: "Git CLI + Code Interpreter" },
      { key: "Branch", val: "feature/{ticket}-{role}" },
    ],
    tools: [
      { icon: "s3", label: "S3 Read & Write" },
      { icon: "codebuild", label: "Code Interpreter" },
      { dot: "ext", label: "Git CLI (clone, commit, push)" },
      { icon: "agentcore", label: "Memory + A2A + Gateway" },
    ],
    skills: [
      { label: "Swift / iOS Development" },
      { label: "Node.js / TypeScript" },
      { label: "Full-Stack Integration" },
    ],
    outputs: [
      { dot: "ext", label: "Git commits to feature branch" },
      { icon: "agentcore", label: "Gateway: report_completion (PR)" },
    ],
  },
  {
    id: "verification",
    name: "QA & Ship",
    num: 5,
    type: "agent",
    typeLabel: "2 AgentCore Harness Agents",
    agentPhase: "verification",
    identity: [
      { icon: "agentcore", label: "AgentCore Runtime (x2 parallel)" },
      { icon: "bedrock", label: "Claude Opus 4 / Sonnet 4" },
    ],
    config: [
      { key: "Dispatch", val: "sequential then parallel" },
      { key: "Retry", val: "3x fix cycles before escalation" },
      { key: "Tools", val: "Git + Code Interpreter + A2A" },
    ],
    tools: [
      { dot: "ext", label: "Git CLI (read feature branch)" },
      { icon: "codebuild", label: "Code Interpreter (tests)" },
      { icon: "agentcore", label: "Memory + A2A + Gateway" },
    ],
    skills: [
      { label: "Visual Regression + Pixel Compare" },
      { label: "E2E Tests (Playwright)" },
      { label: "CI Failure Analysis + Auto-fix" },
      { label: "Retry Loop (A2A fix request, 3x)" },
    ],
    outputs: [
      { dot: "ext", label: "Pull Request (auto-merge ready)" },
      { icon: "agentcore", label: "Workflow Complete" },
    ],
  },
];

// Map WorkflowPhase to phase index
const PHASE_ORDER: Record<string, number> = {
  intake: 0,
  requirements: 1,
  design: 2,
  development: 3,
  verification: 4,
  review: 4,
  complete: 5,
  error: -1,
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function WorkflowBoard({ workflowId }: WorkflowBoardProps) {
  const [state, setState] = useState<WorkflowState | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState<Record<string, string>>({});
  const eventSourceRef = useRef<EventSource | null>(null);
  const pipelineRef = useRef<HTMLDivElement>(null);

  // Fetch initial state + poll every 3s
  useEffect(() => {
    const fetchState = () => {
      const ts = Date.now();
      fetch(`/api/workflow/${workflowId}/state?t=${ts}`, { cache: "no-store" })
        .then((r) => r.json())
        .then((data) => {
          if (data && data.id) {
            setState(data);
          }
        })
        .catch(() => {});
    };

    fetchState();
    const interval = setInterval(fetchState, 3000);
    return () => clearInterval(interval);
  }, [workflowId]);

  // SSE connection with auto-reconnect
  useEffect(() => {
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectAttempts = 0;
    let stopped = false;

    const connect = () => {
      if (stopped) return;
      es = new EventSource(`/api/workflow/${workflowId}/stream`);
      eventSourceRef.current = es;

      es.onopen = () => { reconnectAttempts = 0; };

      es.onmessage = (event) => {
        try {
          const data: WorkflowEvent = JSON.parse(event.data);
          handleEvent(data);
        } catch {
          // skip
        }
      };

      es.onerror = () => {
        es?.close();
        if (stopped) return;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 15000);
        reconnectAttempts++;
        fetch(`/api/workflow/${workflowId}/state`)
          .then((r) => r.json())
          .then((data) => {
            if (data && data.id) setState(data);
          })
          .catch(() => {});
        reconnectTimer = setTimeout(connect, delay);
      };
    };

    connect();
    return () => {
      stopped = true;
      es?.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [workflowId]);

  const handleEvent = useCallback((event: WorkflowEvent) => {
    switch (event.type) {
      case "phase_change":
        setState((s) => s ? { ...s, phase: event.phase } : s);
        break;
      case "agent_status":
        setState((s) => {
          if (!s) return s;
          const tasks = { ...s.agentTasks };
          if (tasks[event.agentId]) {
            tasks[event.agentId] = { ...tasks[event.agentId], status: event.status };
          } else {
            tasks[event.agentId] = {
              id: `task_${Date.now()}`,
              agentId: event.agentId,
              ticketId: event.ticketId || "",
              status: event.status,
              input: "",
            };
          }
          return { ...s, agentTasks: tasks };
        });
        break;
      case "agent_output":
        setStreamingText((prev) => ({
          ...prev,
          [event.agentId]: (prev[event.agentId] || "") + event.chunk,
        }));
        break;
      case "agent_complete":
        setState((s) => {
          if (!s) return s;
          const tasks = { ...s.agentTasks };
          if (tasks[event.agentId]) {
            tasks[event.agentId] = {
              ...tasks[event.agentId],
              status: "complete",
              output: event.output,
              branch: event.branch,
              commitSha: event.commitSha,
            };
          }
          return { ...s, agentTasks: tasks };
        });
        setStreamingText((prev) => {
          const next = { ...prev };
          delete next[event.agentId];
          return next;
        });
        break;
      case "workflow_complete":
        setState((s) => s ? { ...s, phase: "complete" } : s);
        setCelebrating(true);
        setTimeout(() => setCelebrating(false), 1300);
        break;
      default:
        break;
    }
  }, []);

  // Derive visual states from workflow state
  const currentPhaseIndex = state ? (PHASE_ORDER[state.phase] ?? -1) : -1;
  const isComplete = state?.phase === "complete";

  const getPhaseClass = (phaseIndex: number) => {
    if (currentPhaseIndex === -1) return "";
    if (phaseIndex < currentPhaseIndex || isComplete) return "active done";
    if (phaseIndex === currentPhaseIndex) return "active";
    return "";
  };

  const getBoxClass = (phaseIndex: number) => {
    if (currentPhaseIndex === -1) return "";
    if (phaseIndex < currentPhaseIndex || isComplete) return "done";
    if (phaseIndex === currentPhaseIndex) return "awake";
    return "";
  };

  const getItemClass = (phaseIndex: number): string => {
    if (!state) return "";
    if (phaseIndex < currentPhaseIndex || isComplete) return "done";
    if (phaseIndex === currentPhaseIndex) {
      const hasRunning = Object.values(state.agentTasks).some(
        (t) => t.status === "running" || t.status === "waiting_response"
      );
      if (hasRunning) return "working";
      return "active";
    }
    return "";
  };

  if (!state) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-zinc-400">Loading pipeline...</div>
      </div>
    );
  }

  return (
    <div className={celebrating ? "celebrate-wrapper" : ""}>
      <style dangerouslySetInnerHTML={{ __html: PIPELINE_STYLES }} />

      <div className="pipeline-viz">
        <div className="pipeline-title">Agentis Hub</div>
        <div className="pipeline-subtitle">Autonomous Multi-Agent Development Pipeline</div>

        {/* Legend */}
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
            <img className="aws-ico" src={awsIcons.codebuild} alt="Code Interpreter" />
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

        {/* Canvas */}
        <div className="pipeline-canvas" ref={pipelineRef}>
          {/* SVG Connectors */}
          <svg className="pipeline-connectors">
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
            </defs>
            {PHASE_CONFIGS.slice(0, -1).map((_, i) => {
              const x1 = 290 * (i + 1) + 44 * i;
              const x2 = x1 + 44;
              const y = 200;
              const showConnector = i < currentPhaseIndex || isComplete;
              const isActiveConnector = i === currentPhaseIndex - 1 && !isComplete;
              return (
                <path
                  key={`connector-${i}`}
                  className={`flow-path ${showConnector ? "show" : ""} ${isActiveConnector ? "active" : ""}`}
                  d={`M ${x1} ${y} C ${x1 + 22} ${y}, ${x2 - 22} ${y}, ${x2} ${y}`}
                />
              );
            })}
          </svg>

          {/* Pipeline phases */}
          <div className="pipeline-phases">
            {PHASE_CONFIGS.map((phase, idx) => (
              <div
                key={phase.id}
                className={`phase ${getPhaseClass(idx)}`}
              >
                <div className={`agent-box ${getBoxClass(idx)}`}>
                  <div className="phase-num">Phase {phase.num}</div>
                  <div className="phase-name">{phase.name}</div>
                  <div className={`phase-type ${phase.type}`}>{phase.typeLabel}</div>

                  {/* Identity */}
                  <div className="identity">
                    {phase.identity.length === 1 && !phase.identity[0].icon ? (
                      <div className="id-label" style={{ textAlign: "center", height: "auto", lineHeight: 1.4 }}>
                        {phase.identity[0].label}
                      </div>
                    ) : (
                      <div className="id-row">
                        <div className="id-icon-col">
                          {phase.identity.map((id, i) => (
                            id.icon && <img key={i} className="id-icon" src={(awsIcons as Record<string, string>)[id.icon]} alt={id.icon} />
                          ))}
                        </div>
                        <div className="id-labels">
                          {phase.identity.map((id, i) => (
                            <div key={i} className="id-label">{id.label}</div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Config */}
                  <div className="config-detail">
                    {phase.config.map((c, i) => (
                      <div key={i} className="cfg-row">
                        <span className="cfg-key">{c.key}</span>
                        <span className="cfg-val">{c.val}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Work area */}
                <div className="work-area">
                  {/* Tools */}
                  {phase.tools.length > 0 && (
                    <>
                      <div className="sec-label">{phase.id === "intake" ? "User Actions" : "Tools"}</div>
                      {phase.tools.map((tool, i) => (
                        <div key={i} className={`item ${getItemClass(idx)}`}>
                          {tool.icon ? (
                            <img className="svc-icon" src={(awsIcons as Record<string, string>)[tool.icon]} alt={tool.icon} />
                          ) : (
                            <span className={`item-dot ${tool.dot || "ext"}`} />
                          )}
                          <span className="item-label">{tool.label}</span>
                          <span className="item-status" />
                        </div>
                      ))}
                    </>
                  )}

                  {/* Agent item */}
                  {phase.type === "agent" && (
                    <>
                      <div className="sec-label">Agent</div>
                      <div
                        className={`item ${getItemClass(idx)} cursor-pointer`}
                        onClick={() => setExpandedAgent(expandedAgent === phase.id ? null : phase.id)}
                      >
                        <img className="svc-icon" src={awsIcons.agentcore} alt="AC" />
                        <span className="item-label">{phase.typeLabel.replace(/^\d+ AgentCore Harness /, "")}</span>
                        <span className="item-status" />
                      </div>
                    </>
                  )}

                  {/* Skills */}
                  {phase.skills.length > 0 && (
                    <>
                      <div className="sec-label">Skills</div>
                      {phase.skills.map((skill, i) => (
                        <div key={i} className={`item ${getItemClass(idx)}`}>
                          <span className="item-dot skill" />
                          <span className="item-label">{skill.label}</span>
                          <span className="item-status" />
                        </div>
                      ))}
                    </>
                  )}

                  {/* Outputs */}
                  {phase.outputs.length > 0 && (
                    <>
                      <div className="sec-label">{phase.id === "intake" ? "Trigger" : "Output"}</div>
                      {phase.outputs.map((out, i) => (
                        <div key={i} className={`item ${getItemClass(idx)}`}>
                          {out.icon ? (
                            <img className="svc-icon" src={(awsIcons as Record<string, string>)[out.icon]} alt={out.icon} />
                          ) : (
                            <span className={`item-dot ${out.dot || "ext"}`} />
                          )}
                          <span className="item-label">{out.label}</span>
                          <span className="item-status" />
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Status bar */}
        <div className="pipeline-status">
          <div className="status-phase">
            {isComplete ? "Complete" : (state.phase === "error" ? "Error" : PHASE_CONFIGS[currentPhaseIndex]?.name || state.phase)}
          </div>
          <div className="status-text">
            {isComplete
              ? "All agents have completed their work"
              : state.phase === "error"
              ? state.error || "An error occurred"
              : `Processing phase ${currentPhaseIndex + 1} of ${PHASE_CONFIGS.length}`}
          </div>
        </div>

        {/* Expanded agent output panel */}
        {expandedAgent && (
          <div className="agent-output-panel">
            <div className="agent-output-header">
              <span>Agent Output — {expandedAgent}</span>
              <button onClick={() => setExpandedAgent(null)} className="agent-output-close">✕</button>
            </div>
            <div className="agent-output-body">
              {streamingText[expandedAgent] || Object.values(state.agentTasks).find((t) => t.agentId === expandedAgent)?.output || "No output yet..."}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const PIPELINE_STYLES = `
.pipeline-viz{display:flex;flex-direction:column;align-items:center;min-height:100vh;overflow-x:auto;padding:14px 20px;background:#0f1419;color:#e2e8f0;font-family:"Segoe UI",system-ui,sans-serif}
.pipeline-title{font-size:28px;font-weight:700;background:linear-gradient(90deg,#0ea5e9,#38bdf8,#0ea5e9);background-size:200% auto;-webkit-background-clip:text;-webkit-text-fill-color:transparent;animation:shimmer 3s linear infinite;margin-bottom:3px}
.pipeline-subtitle{font-size:12px;color:#64748b;letter-spacing:2px;text-transform:uppercase;margin-bottom:16px}
@keyframes shimmer{to{background-position:200% center}}

.pipeline-legend{display:flex;gap:18px;margin-bottom:14px;font-size:10px;color:#64748b;flex-wrap:wrap;justify-content:center}
.legend-item{display:flex;align-items:center;gap:4px}
.legend-item .aws-ico{width:18px;height:18px;border-radius:3px;object-fit:contain}
.legend-item .dot{width:7px;height:7px;border-radius:50%}
.legend-item .dot.skill{background:#a855f7}
.legend-item .dot.ext{background:#64748b}

.pipeline-canvas{position:relative;width:1720px;min-height:840px}
.pipeline-connectors{position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:10}
.flow-path{fill:none;stroke:#1e293b;stroke-width:2;stroke-linecap:round;opacity:0;transition:opacity .3s}
.flow-path.show{opacity:1}
.flow-path.active{stroke:url(#flowGrad);stroke-width:2.5;filter:url(#pathGlow)}

.pipeline-phases{display:flex;align-items:flex-start;gap:44px;position:relative;z-index:2}

.phase{display:flex;flex-direction:column;align-items:center;width:290px;opacity:0.35;transition:opacity .5s,transform .4s;transform:translateY(6px)}
.phase.active{opacity:1;transform:translateY(0)}
.phase.done{opacity:0.8;transform:translateY(0)}

.agent-box{width:100%;border-radius:11px;padding:12px 14px;text-align:center;transition:all .4s;background:#1a2332;border:2px solid #1e293b}
.agent-box.awake{border-color:#0ea5e9;box-shadow:0 0 20px rgba(14,165,233,.3)}
.agent-box.done{border-color:#22c55e50;box-shadow:0 0 8px rgba(34,197,94,.1)}
.agent-box .phase-num{font-size:8px;color:#64748b;letter-spacing:2px;text-transform:uppercase}
.agent-box .phase-name{font-size:15px;font-weight:700;color:#e2e8f0;margin-top:2px}
.agent-box .phase-type{display:inline-flex;align-items:center;gap:4px;margin-top:5px;padding:3px 8px;border-radius:5px;font-size:9px;font-weight:600;letter-spacing:0.5px}
.agent-box .phase-type.app{background:#0ea5e910;color:#38bdf8;border:1px solid #0ea5e925}
.agent-box .phase-type.agent{background:#a855f710;color:#c084fc;border:1px solid #a855f725}

.identity{display:flex;flex-direction:column;gap:0;margin-top:8px;align-items:center}
.id-row{display:flex;align-items:center;gap:8px}
.id-icon-col{display:flex;flex-direction:column;align-items:center;gap:4px}
.id-labels{display:flex;flex-direction:column;gap:4px;text-align:left}
.id-icon{width:20px;height:20px;border-radius:3px;object-fit:contain}
.id-label{font-size:8.5px;color:#94a3b8;line-height:20px;height:20px;display:flex;align-items:center}

.config-detail{margin-top:6px;padding:5px 8px;background:#0f141980;border-radius:5px;border:1px solid #1e293b;text-align:left}
.config-detail .cfg-row{display:flex;align-items:center;gap:4px;font-size:8px;color:#64748b;line-height:1.6}
.config-detail .cfg-key{color:#475569;font-weight:600;min-width:52px}
.config-detail .cfg-val{color:#94a3b8}

.work-area{width:100%;margin-top:8px;display:flex;flex-direction:column;gap:3px}
.sec-label{font-size:7px;color:#475569;letter-spacing:1.5px;text-transform:uppercase;margin-top:6px;margin-bottom:2px;padding-left:3px}

.item{display:flex;align-items:center;gap:5px;padding:5px 7px;border-radius:6px;border:1px solid transparent;background:#1a233260;transition:all .3s;position:relative}
.item.active{border-color:#0ea5e940;background:#0ea5e910}
.item.active .item-label{color:#e2e8f0}
.item.done{border-color:#22c55e20;opacity:0.7}
.item.done .item-status{background:#22c55e}
.item.trigger{border-color:#f97316;background:#f9731610;animation:pulse .6s}
@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.02)}}
@keyframes agentPulse{0%{border-color:#0ea5e960;box-shadow:0 0 8px rgba(14,165,233,.3)}50%{border-color:#0ea5e9;box-shadow:0 0 16px rgba(14,165,233,.5)}100%{border-color:#0ea5e960;box-shadow:0 0 8px rgba(14,165,233,.3)}}
.item.working{border-color:#0ea5e960;background:#0ea5e908;animation:agentPulse 1s ease-in-out infinite}
.item.working .item-label{color:#e2e8f0}
.item.working .item-status{background:#0ea5e9;box-shadow:0 0 5px #0ea5e9}

.svc-icon{width:16px;height:16px;border-radius:2px;object-fit:contain;flex-shrink:0}
.item-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
.item-dot.skill{background:#a855f7}
.item-dot.ext{background:#64748b}

.item-label{font-size:10px;font-weight:500;color:#94a3b8;line-height:1.15;transition:color .3s}
.item.active .item-label{color:#e2e8f0}
.item-status{width:6px;height:6px;border-radius:50%;background:#1e293b;margin-left:auto;flex-shrink:0;transition:background .3s}
.item.active .item-status{background:#0ea5e9;box-shadow:0 0 5px #0ea5e9}

.pipeline-status{text-align:center;margin-top:16px;min-height:44px}
.status-phase{font-size:11px;color:#0ea5e9;letter-spacing:2px;text-transform:uppercase;margin-bottom:2px}
.status-text{font-size:15px;font-weight:500;color:#e2e8f0}

@keyframes celebrateBurst{0%{border-color:#f97316;box-shadow:0 0 30px rgba(255,255,255,.6)}100%{border-color:#22c55e50;box-shadow:0 0 8px rgba(34,197,94,.1)}}
@keyframes celebrateItemBurst{0%{border-color:#f97316;background:#f9731618}100%{border-color:#f9731640;background:#f9731608}}
@keyframes celebrateStatusBurst{0%{background:#f97316;box-shadow:0 0 8px #fbbf24}100%{background:#22c55e;box-shadow:0 0 4px rgba(34,197,94,.3)}}
@keyframes celebrateConnector{0%{stroke:#f97316;opacity:.8}100%{stroke:#22c55e80;opacity:.4}}
.celebrate-wrapper .agent-box.done{animation:celebrateBurst 1.2s ease-out forwards}
.celebrate-wrapper .item.done{animation:celebrateItemBurst 1.2s ease-out forwards}
.celebrate-wrapper .item.done .item-status{animation:celebrateStatusBurst 1.2s ease-out forwards}
.celebrate-wrapper .flow-path.show{animation:celebrateConnector 1.2s ease-out forwards}
.celebrate-wrapper .status-phase{color:#f97316}
.celebrate-wrapper .pipeline-title{background:linear-gradient(90deg,#f97316,#fbbf24,#f97316);background-size:200% auto;-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.celebrate-wrapper .phase.done{opacity:1}

.agent-output-panel{margin-top:16px;width:100%;max-width:1720px;background:#1a2332;border:1px solid #1e293b;border-radius:8px;overflow:hidden}
.agent-output-header{display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:#0f1419;border-bottom:1px solid #1e293b;font-size:11px;color:#94a3b8;letter-spacing:1px;text-transform:uppercase}
.agent-output-close{background:none;border:none;color:#64748b;font-size:14px;cursor:pointer;padding:2px 6px}
.agent-output-close:hover{color:#e2e8f0}
.agent-output-body{padding:12px;font-size:12px;color:#94a3b8;white-space:pre-wrap;max-height:300px;overflow-y:auto;font-family:"JetBrains Mono",monospace;line-height:1.5}
`;
