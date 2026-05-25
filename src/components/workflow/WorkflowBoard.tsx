"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import type {
  WorkflowState,
  WorkflowEvent,
} from "@/lib/workflow/types";
import awsIcons from "@/lib/aws-icons.json";
import { PIPELINE_PHASES, resolveToolIcon } from "@/lib/pipeline-config";
import AgentOutputPanel from "./AgentOutputPanel";
import S3ArtifactsModal from "./S3ArtifactsModal";

interface WorkflowBoardProps {
  workflowId: string;
}

// ─── Phase Order (derived from config) ──────────────────────────────────────

// Map WorkflowPhase / agentPhase strings to index in the pipeline
const PHASE_ORDER: Record<string, number> = (() => {
  const order: Record<string, number> = {};
  PIPELINE_PHASES.forEach((phase, idx) => {
    order[phase.id] = idx;
    // Also map agentPhase if it differs from id (e.g. qa phase has agentPhase "verification")
    if (phase.agentPhase !== phase.id) {
      order[phase.agentPhase] = idx;
    }
  });
  // Special states
  order["review"] = PIPELINE_PHASES.length - 1;
  order["complete"] = PIPELINE_PHASES.length;
  order["error"] = -1;
  return order;
})();

// ─── Replay helper: apply a single event to state (pure function) ───────────

function applyEventToState(s: WorkflowState, event: WorkflowEvent): WorkflowState {
  switch (event.type) {
    case "phase_change":
      return { ...s, phase: event.phase };
    case "agent_status": {
      const tasks = { ...s.agentTasks };
      if (tasks[event.agentId]) {
        tasks[event.agentId] = { ...tasks[event.agentId], status: event.status };
      } else {
        tasks[event.agentId] = { id: `task_${Date.now()}`, agentId: event.agentId, ticketId: event.ticketId || "", status: event.status, input: "" };
      }
      return { ...s, agentTasks: tasks };
    }
    case "agent_complete": {
      const tasks = { ...s.agentTasks };
      if (tasks[event.agentId]) {
        tasks[event.agentId] = {
          ...tasks[event.agentId],
          status: "complete",
          // Only overwrite output if the event actually has content (events often have empty/truncated output)
          output: event.output || tasks[event.agentId].output,
          branch: event.branch,
          commitSha: event.commitSha,
        };
      }
      return { ...s, agentTasks: tasks };
    }
    case "workflow_complete":
      return { ...s, phase: "complete" };
    default:
      return s;
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function WorkflowBoard({ workflowId }: WorkflowBoardProps) {
  const [state, setState] = useState<WorkflowState | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState<Record<string, string>>({});
  // Full agent output fetched directly from DDB (independent of replay scrubber)
  const [agentFullOutput, setAgentFullOutput] = useState<Record<string, string>>({});
  // Tool flash state: maps "phaseId:iconKey" to a timeout so items flash when tools fire
  const [toolFlashes, setToolFlashes] = useState<Record<string, boolean>>({});
  const toolFlashTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [activeConnector, setActiveConnector] = useState<number | null>(null);
  const [connectorPaths, setConnectorPaths] = useState<string[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);
  const pipelineRef = useRef<HTMLDivElement>(null);

  // Replay state for completed workflows
  const [replayMode, setReplayMode] = useState(false);
  const [replayEvents, setReplayEvents] = useState<WorkflowEvent[]>([]);
  const [replayIndex, setReplayIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(3); // multiplier: 3x = 3 times real-time
  const replayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // DVR: "at live edge" means scrubber follows incoming events in real-time
  const [atLiveEdge, setAtLiveEdge] = useState(true);

  // Nudge pulse effect — hot pink full-screen flash during replay
  const [nudgePulse, setNudgePulse] = useState(false);

  // Catch-up replay state for live/in-progress workflows
  const [catchingUp, setCatchingUp] = useState(false);
  const lastEventIdRef = useRef<string>("");
  const catchUpCompleteRef = useRef(false);

  // Preserve original DDB agent outputs (replay reconstructs state from events which lack full output)
  const originalOutputsRef = useRef<Record<string, string>>({});
  // Track whether the workflow was loaded as complete (from API) — survives replay reconstruction
  const wasLoadedCompleteRef = useRef(false);

  // S3 Artifacts Modal state
  const [artifactsModal, setArtifactsModal] = useState<{ phaseId: string; phaseName: string } | null>(null);

  // Fetch initial state (once for replay, poll for live)
  useEffect(() => {
    let isFirstFetch = true;
    let interval: ReturnType<typeof setInterval> | null = null;

    const fetchState = () => {
      const ts = Date.now();
      fetch(`/api/workflow/${workflowId}/state?t=${ts}`, { cache: "no-store" })
        .then((r) => r.json())
        .then((data) => {
          if (data && data.id) {
            // Re-key agentTasks from ticket IDs (DDB) to agentIds (UI expects)
            // When multiple tickets exist for the same agent, prefer the one with output
            if (data.agentTasks) {
              const reKeyed: Record<string, typeof data.agentTasks[string]> = {};
              for (const [key, task] of Object.entries(data.agentTasks) as [string, { agentId?: string; output?: string }][]) {
                const id = task.agentId || key;
                if (!reKeyed[id] || (task.output && !reKeyed[id].output)) {
                  reKeyed[id] = task;
                }
              }
              data.agentTasks = reKeyed;
            }
            // Only set state from poll if NOT in replay mode and not catching up
            if (!replayMode && !catchingUp) setState(data);
            if (isFirstFetch) {
              // Capture original DDB agent outputs before replay overwrites state
              if (data.agentTasks) {
                const outputs: Record<string, string> = {};
                for (const task of Object.values(data.agentTasks) as Array<{ agentId?: string; output?: string }>) {
                  if (task.agentId && task.output) {
                    outputs[task.agentId] = task.output;
                  }
                }
                originalOutputsRef.current = outputs;
              }
              if (data.phase === "complete") {
                // Completed workflow → show final state, replay available on demand
                wasLoadedCompleteRef.current = true;
                setReplayMode(true);
                if (interval) { clearInterval(interval); interval = null; }
                // Pre-fetch full output for all completed agents so panel opens instantly
                for (const task of Object.values(data.agentTasks) as Array<{ agentId?: string; status?: string }>) {
                  if (task.agentId && task.status === "complete") {
                    fetch(`/api/workflow/${workflowId}/agent-output?agentId=${task.agentId}`)
                      .then((r) => r.json())
                      .then((d) => { if (d.output) setAgentFullOutput((prev) => ({ ...prev, [task.agentId!]: d.output })); })
                      .catch(() => {});
                  }
                }
                fetch(`/api/workflow/${workflowId}/events`)
                  .then((r) => r.json())
                  .then((evData) => {
                    if (evData.events?.length) {
                      setReplayEvents(evData.events);
                      // Start at the END so user sees completed state immediately
                      setReplayIndex(evData.events.length - 1);
                    }
                  })
                  .catch(() => {});
              } else {
                // Live workflow → catch-up replay then transition to SSE
                setCatchingUp(true);
                if (interval) { clearInterval(interval); interval = null; }
                fetch(`/api/workflow/${workflowId}/events`)
                  .then((r) => r.json())
                  .then((evData) => {
                    if (evData.events?.length) {
                      // Store the last eventId so SSE can start from there
                      const lastEv = evData.events[evData.events.length - 1];
                      lastEventIdRef.current = lastEv.eventId || "";
                      setReplayMode(true);
                      setReplayEvents(evData.events);
                      // Dynamic speed: catch-up should take ~4s max regardless of event count/duration
                      // Calculate based on total time span of events
                      const firstTs = new Date(evData.events[0].timestamp || 0).getTime();
                      const lastTs = new Date(lastEv.timestamp || 0).getTime();
                      const totalSpanMs = Math.max(1000, lastTs - firstTs);
                      const targetDurationMs = 4000; // 4 seconds target
                      // Speed = timeSpan / target, floored at 20x, no ceiling (let it rip for long runs)
                      const dynamicSpeed = Math.max(20, totalSpanMs / targetDurationMs);
                      setPlaybackSpeed(dynamicSpeed);
                      setIsPlaying(true);
                    } else {
                      // No historical events — go straight to live
                      setCatchingUp(false);
                    }
                  })
                  .catch(() => { setCatchingUp(false); });
              }
            }
            isFirstFetch = false;
          }
        })
        .catch(() => {});
    };

    fetchState();
    // Only poll for live workflows (will be stopped if replay/catch-up kicks in)
    interval = setInterval(fetchState, 3000);
    return () => { if (interval) clearInterval(interval); };
  }, [workflowId]);

  // SSE connection — only for LIVE workflows (starts after catch-up completes or immediately if no catch-up)
  useEffect(() => {
    if (replayMode || catchingUp) return;

    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectAttempts = 0;
    let stopped = false;

    const connect = () => {
      if (stopped) return;
      // Use cursor from last replayed event to avoid re-delivering history
      const cursor = lastEventIdRef.current;
      const url = cursor
        ? `/api/workflow/${workflowId}/stream?cursor=${encodeURIComponent(cursor)}`
        : `/api/workflow/${workflowId}/stream`;
      es = new EventSource(url);
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
  }, [workflowId, replayMode, catchingUp]);

  // Live-poll agent output while panel is open and agent is running
  useEffect(() => {
    if (!expandedAgent || !state) return;
    const agentTask = Object.values(state.agentTasks).find((t) => t.agentId === expandedAgent);
    if (!agentTask || agentTask.status === "complete" || agentTask.status === "error") return;

    const poll = () => {
      fetch(`/api/workflow/${workflowId}/agent-output?agentId=${expandedAgent}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.output) {
            setAgentFullOutput((prev) => ({ ...prev, [expandedAgent]: d.output }));
          }
        })
        .catch(() => {});
    };

    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [expandedAgent, state?.agentTasks, workflowId]);

  // Replay playback timer — uses real timestamps for natural pacing
  // Only re-runs when isPlaying or playbackSpeed changes (not on every replayIndex tick)
  const replayIndexRef = useRef(replayIndex);
  replayIndexRef.current = replayIndex;

  useEffect(() => {
    if (!isPlaying || replayEvents.length === 0) return;
    let stopped = false;

    const scheduleNext = () => {
      const currentIdx = replayIndexRef.current;
      if (stopped || currentIdx >= replayEvents.length - 1) {
        if (!stopped) {
          setIsPlaying(false);
          // If catching up, transition to live SSE
          if (catchingUp) {
            catchUpCompleteRef.current = true;
            setCatchingUp(false);
            setReplayMode(false);
          }
        }
        return;
      }
      const currentTs = new Date(replayEvents[currentIdx].timestamp || 0).getTime();
      const nextTs = new Date(replayEvents[currentIdx + 1].timestamp || 0).getTime();
      // Real delay between events, compressed by playback speed
      // During catch-up: lower the floor so long runs finish in ~4s
      // Normal replay: 50ms floor for smooth visual pacing
      const minDelay = catchingUp ? Math.max(3, 4000 / replayEvents.length) : 50;
      const maxDelay = catchingUp ? 200 : 2000;
      const realDelay = Math.max(0, nextTs - currentTs);
      const delay = Math.min(maxDelay, Math.max(minDelay, realDelay / playbackSpeed));

      replayTimerRef.current = setTimeout(() => {
        if (stopped) return;
        setReplayIndex(replayIndexRef.current + 1);
        scheduleNext();
      }, delay);
    };

    scheduleNext();
    return () => {
      stopped = true;
      if (replayTimerRef.current) clearTimeout(replayTimerRef.current);
    };
  }, [isPlaying, playbackSpeed, replayEvents, catchingUp]);

  // Fire visual effects for the current replay event (without touching state)
  // Tracks the highest phase index that has been animated, to fire connectors on first entry
  const replayPhaseHighWaterRef = useRef(0);
  const fireReplayVisuals = useCallback((event: WorkflowEvent) => {
    if (event.type === "phase_change") {
      const newPhaseIndex = PHASE_ORDER[event.phase] ?? -1;
      if (newPhaseIndex > 0 && newPhaseIndex > replayPhaseHighWaterRef.current) {
        replayPhaseHighWaterRef.current = newPhaseIndex;
        setActiveConnector(newPhaseIndex - 1);
        setTimeout(() => setActiveConnector(null), 1200);
      }
    } else if (event.type === "agent_status" && event.status === "running") {
      // If an agent starts in a new phase we haven't animated yet, fire the connector
      const agentPhaseIdx = PIPELINE_PHASES.findIndex((p) =>
        p.agents.some((a) => a.id === event.agentId)
      );
      if (agentPhaseIdx > 0 && agentPhaseIdx > replayPhaseHighWaterRef.current) {
        replayPhaseHighWaterRef.current = agentPhaseIdx;
        setActiveConnector(agentPhaseIdx - 1);
        setTimeout(() => setActiveConnector(null), 1200);
      }
    } else if (event.type === "tool_use") {
      const resolved = resolveToolIcon(event.toolName);
      if (resolved) {
        const agentPhase = PIPELINE_PHASES.find((p) => p.agents.some((a) => a.id === event.agentId));
        if (agentPhase) {
          const flashKey = `${agentPhase.id}:${resolved.icon}`;
          setToolFlashes((prev) => ({ ...prev, [flashKey]: true }));
          if (toolFlashTimers.current[flashKey]) clearTimeout(toolFlashTimers.current[flashKey]);
          toolFlashTimers.current[flashKey] = setTimeout(() => {
            setToolFlashes((prev) => ({ ...prev, [flashKey]: false }));
          }, 1600);
        }
      }
    } else if (event.type === "nudge") {
      // Hot pink full-screen pulse for nudge events
      setNudgePulse(true);
      setTimeout(() => setNudgePulse(false), 1500);
    }
  }, []);

  // Apply events up to replayIndex when it changes
  // Runs in replay mode OR when user scrubs back during live (DVR)
  useEffect(() => {
    if (replayEvents.length === 0) return;
    // In live mode at the live edge, state is driven by handleEvent — skip reconstruction
    if (!replayMode && atLiveEdge) return;
    // If scrubber is at the very end, just set phase to "complete" directly
    // This avoids any reconstruction race that could flash a non-complete state
    const atEnd = replayIndex >= replayEvents.length - 1;
    // Reconstruct state from scratch up to replayIndex
    setState((baseState) => {
      if (!baseState) return baseState;
      // Intake is always "done" in replay — no events exist for it.
      // Start at "requirements" since the first DDB event is already a requirements agent.
      let s: WorkflowState = { ...baseState, phase: "requirements", agentTasks: {} };
      for (let i = 0; i <= replayIndex && i < replayEvents.length; i++) {
        s = applyEventToState(s, replayEvents[i]);
      }
      // If at end and workflow was loaded as complete, force phase to "complete"
      // (handles race conditions and missing workflow_complete events)
      if (atEnd && wasLoadedCompleteRef.current) {
        s.phase = "complete";
      }
      // Merge DDB outputs into replay state (events don't carry output text)
      const savedOutputs = originalOutputsRef.current;
      for (const [agentId, output] of Object.entries(savedOutputs)) {
        if (s.agentTasks[agentId] && !s.agentTasks[agentId].output) {
          s.agentTasks[agentId] = { ...s.agentTasks[agentId], output };
        }
      }
      return s;
    });
    // Fire visual effects for just the current event
    if (replayIndex < replayEvents.length) {
      fireReplayVisuals(replayEvents[replayIndex]);
    }
  }, [replayIndex, replayMode, replayEvents, atLiveEdge, fireReplayVisuals]);


  // Seek to a specific position
  const seekTo = useCallback((index: number) => {
    const target = Math.max(0, Math.min(index, replayEvents.length - 1));
    // Reset high-water mark when seeking backward so connectors re-fire
    if (target < replayIndexRef.current) {
      replayPhaseHighWaterRef.current = 0;
    }
    setReplayIndex(target);
    // DVR: track if user is at the live edge
    setAtLiveEdge(target >= replayEvents.length - 1);
  }, [replayEvents.length]);

  // DVR: snap to live edge
  const snapToLive = useCallback(() => {
    setReplayIndex(replayEvents.length - 1);
    setAtLiveEdge(true);
    setIsPlaying(false);
  }, [replayEvents.length]);

  // Start/stop replay
  const togglePlay = useCallback(() => {
    if (replayIndex >= replayEvents.length - 1) {
      // If at end, restart from beginning
      replayPhaseHighWaterRef.current = 0;
      setReplayIndex(0);
      setIsPlaying(true);
    } else {
      setIsPlaying((p) => !p);
    }
  }, [replayIndex, replayEvents.length]);

  // Use a ref to avoid stale closure for atLiveEdge in handleEvent
  const atLiveEdgeRef = useRef(atLiveEdge);
  atLiveEdgeRef.current = atLiveEdge;

  const handleEvent = useCallback((event: WorkflowEvent) => {
    // DVR: always append to timeline so scrubber can access history
    setReplayEvents((prev) => [...prev, event]);
    if (atLiveEdgeRef.current) {
      setReplayIndex((prev) => prev + 1);
    }

    switch (event.type) {
      case "phase_change": {
        const newPhaseIndex = PHASE_ORDER[event.phase] ?? -1;
        // Animate the connector FROM the previous phase TO the new phase
        if (newPhaseIndex > 0) {
          const connectorIndex = newPhaseIndex - 1;
          setActiveConnector(connectorIndex);
          setTimeout(() => setActiveConnector(null), 1200);
        }
        setState((s) => s ? { ...s, phase: event.phase } : s);
        break;
      }
      case "agent_status":
        // If an agent starts running in a phase beyond current, animate the connector
        if (event.status === "running") {
          const agentPhase = PIPELINE_PHASES.findIndex((p) =>
            p.agents.some((a) => a.id === event.agentId)
          );
          if (agentPhase > 0 && activeConnector === null) {
            setState((s) => {
              const curIdx = s ? (PHASE_ORDER[s.phase] ?? -1) : -1;
              if (agentPhase > curIdx) {
                setActiveConnector(agentPhase - 1);
                setTimeout(() => setActiveConnector(null), 1200);
              }
              return s;
            });
          }
        }
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
      case "tool_use": {
        // Flash the corresponding icon/item in the pipeline
        const resolved = resolveToolIcon(event.toolName);
        if (resolved) {
          // Find which phase this agent belongs to
          const agentPhase = PIPELINE_PHASES.find((p) =>
            p.agents.some((a) => a.id === event.agentId)
          );
          if (agentPhase) {
            const flashKey = `${agentPhase.id}:${resolved.icon}`;
            // Set flash active
            setToolFlashes((prev) => ({ ...prev, [flashKey]: true }));
            // Clear any existing timer for this key
            if (toolFlashTimers.current[flashKey]) {
              clearTimeout(toolFlashTimers.current[flashKey]);
            }
            // Auto-clear after 1600ms
            toolFlashTimers.current[flashKey] = setTimeout(() => {
              setToolFlashes((prev) => ({ ...prev, [flashKey]: false }));
            }, 1600);
          }
        }
        break;
      }
      case "agent_complete":
        setState((s) => {
          if (!s) return s;
          const tasks = { ...s.agentTasks };
          const key = tasks[event.agentId]
            ? event.agentId
            : Object.keys(tasks).find((k) => tasks[k].agentId === event.agentId);
          if (key) {
            // Preserve accumulated streaming text — only use event.output if it's longer
            const existingOutput = tasks[key].output || "";
            const newOutput = event.output || "";
            tasks[key] = {
              ...tasks[key],
              status: "complete",
              output: newOutput.length > existingOutput.length ? newOutput : existingOutput,
              branch: event.branch,
              commitSha: event.commitSha,
            };
          }
          return { ...s, agentTasks: tasks };
        });
        // Don't delete streamingText — it may be the best source until API fetch completes
        break;
      case "workflow_complete":
        setState((s) => s ? { ...s, phase: "complete" } : s);
        setCelebrating(true);
        setTimeout(() => setCelebrating(false), 1300);
        break;
      default:
        break;
    }
  }, [activeConnector]);

  // Animate connector dot — exact same logic as demo HTML animateConnector()
  const animateConnectorDot = useCallback((connectorIndex: number, duration = 900) => {
    const svg = pipelineRef.current?.querySelector(".pipeline-connectors") as SVGSVGElement | null;
    if (!svg) return;
    const path = svg.querySelector(`#connector-path-${connectorIndex}`) as SVGPathElement | null;
    const dot = svg.querySelector(`circle[data-connector="${connectorIndex}"]`) as SVGCircleElement | null;
    if (!path || !dot) return;
    const pathLen = path.getTotalLength();
    if (pathLen === 0) return;
    path.classList.add("active");
    const startT = performance.now();
    dot.style.opacity = "1";
    function tick(now: number) {
      const t = Math.min((now - startT) / duration, 1);
      // Ease-in-out quadratic (same as demo)
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      const pt = path!.getPointAtLength(ease * pathLen);
      dot!.setAttribute("cx", String(pt.x));
      dot!.setAttribute("cy", String(pt.y));
      // Fade in first 5%, fade out last 10% (same as demo)
      dot!.style.opacity = t < 0.05 ? String(t / 0.05) : t > 0.9 ? String((1 - t) / 0.1) : "1";
      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        dot!.style.opacity = "0";
        path!.classList.remove("active");
      }
    }
    requestAnimationFrame(tick);
  }, []);

  // Derive visual states from workflow state
  const currentPhaseIndex = state ? (PHASE_ORDER[state.phase] ?? -1) : -1;
  const isComplete = state?.phase === "complete";
  const isSettled = isComplete && !celebrating;

  // Trigger connector animation when activeConnector changes
  useEffect(() => {
    if (activeConnector !== null) {
      animateConnectorDot(activeConnector, 900);
    }
  }, [activeConnector, animateConnectorDot]);

  // On initial load of a live workflow, animate completed connectors
  const hasAnimatedRef = useRef(false);
  useEffect(() => {
    if (replayMode || hasAnimatedRef.current || currentPhaseIndex <= 0 || connectorPaths.length === 0) return;
    hasAnimatedRef.current = true;
    for (let i = 0; i < currentPhaseIndex && i < connectorPaths.length; i++) {
      setTimeout(() => animateConnectorDot(i, 800), i * 400);
    }
  }, [replayMode, currentPhaseIndex, connectorPaths, animateConnectorDot]);

  // On replay start, animate the intake→requirements connector (hardcoded since intake has no DDB events)
  const hasPlayedIntakeRef = useRef(false);
  useEffect(() => {
    if (!replayMode || replayEvents.length === 0 || hasPlayedIntakeRef.current) return;
    if (connectorPaths.length > 0) {
      hasPlayedIntakeRef.current = true;
      setTimeout(() => animateConnectorDot(0, 700), 300);
    }
  }, [replayMode, replayEvents, connectorPaths, animateConnectorDot]);

  // ─── Auto-Nudge: if workflow active, no agent running, idle >60s → auto-fix stuck tickets ───
  const lastActivityRef = useRef<number>(Date.now());
  const nudgeFiredRef = useRef<string>(""); // tracks workflowId+phase to avoid repeat nudges
  const [isStale, setIsStale] = useState(false);
  // Track total streaming length to detect NEW content (not just presence of old keys)
  const prevStreamingLenRef = useRef(0);
  // Update activity timestamp only on ACTUAL new streaming (not just status="running" in DDB)
  // A dead agent still has status="running" and stale keys in streamingText.
  useEffect(() => {
    if (!state || state.phase === "complete" || state.phase === "error") return;
    const totalLen = Object.values(streamingText).reduce((sum, t) => sum + t.length, 0);
    if (totalLen > prevStreamingLenRef.current) {
      prevStreamingLenRef.current = totalLen;
      lastActivityRef.current = Date.now();
      // Reset nudge flag when activity resumes (new phase or agent started)
      nudgeFiredRef.current = "";
      if (isStale) setIsStale(false);
    }
  }, [state, streamingText, isStale]);

  useEffect(() => {
    if (!state || state.phase === "complete" || state.phase === "error" || replayMode) return;
    const check = setInterval(() => {
      const idle = Date.now() - lastActivityRef.current;
      const hasRunning = Object.values(state.agentTasks || {}).some(
        (t) => t.status === "running" || t.status === "waiting_response"
      );
      const nudgeKey = `${workflowId}:${state.phase}`;

      // Mark stale after 6 min of no streaming while agents are "running"
      if (hasRunning && idle > 360_000 && !isStale) {
        setIsStale(true);
      }

      // Fire nudge if:
      // 1. No agent is currently running (impossible stuck state — e.g. blocked with no blockers)
      // 2. OR idle for >90s (agent accepted but timed out / crashed without completing)
      const shouldNudge = (!hasRunning || idle > 90_000) && nudgeFiredRef.current !== nudgeKey;

      if (shouldNudge) {
        nudgeFiredRef.current = nudgeKey;
        fetch(`/api/workflow/${workflowId}/nudge`, { method: "POST" })
          .then((r) => r.json())
          .then((data) => {
            if (data.nudged?.length > 0) {
              console.log(`[auto-nudge] Fixed ${data.nudged.length} ticket(s):`, data.nudged);
              setNudgePulse(true);
              setTimeout(() => setNudgePulse(false), 1500);
            }
          })
          .catch(() => {});
      }
    }, 15_000); // check every 15s
    return () => clearInterval(check);
  }, [workflowId, state?.phase, replayMode, isStale]);

  // Measure element positions and compute connector paths:
  // FROM: last output/trigger item (right edge) of phase[i]
  // TO: agent-box (left edge) of phase[i+1]
  useEffect(() => {
    const canvas = pipelineRef.current;
    if (!canvas) return;
    const timer = setTimeout(() => {
      const canvasRect = canvas.getBoundingClientRect();
      const phases = canvas.querySelectorAll(".phase");
      const paths: string[] = [];
      for (let i = 0; i < phases.length - 1; i++) {
        const fromPhase = phases[i];
        const toPhase = phases[i + 1];
        if (!fromPhase || !toPhase) { paths.push(""); continue; }
        // FROM: last .item in the phase's work-area (the output/trigger item)
        const fromItems = fromPhase.querySelectorAll(".work-area .item");
        const fromEl = fromItems[fromItems.length - 1];
        // TO: the agent-box header of the next phase
        const toEl = toPhase.querySelector(".agent-box");
        if (!fromEl || !toEl) { paths.push(""); continue; }
        const fromRect = fromEl.getBoundingClientRect();
        const toRect = toEl.getBoundingClientRect();
        // Start: right-center of last output item
        const fromX = fromRect.right - canvasRect.left;
        const fromY = fromRect.top + fromRect.height / 2 - canvasRect.top;
        // End: left-center of next agent-box
        const toX = toRect.left - canvasRect.left;
        const toY = toRect.top + toRect.height / 2 - canvasRect.top;
        // Bezier curve — control points adapt to whether path goes mostly horizontal or vertical
        const dx = toX - fromX;
        const dy = toY - fromY;
        let d: string;
        if (Math.abs(dx) > Math.abs(dy) * 0.8) {
          // Mostly horizontal — horizontal S-curve
          const cpx = dx * 0.4;
          d = `M ${fromX} ${fromY} C ${fromX + cpx} ${fromY}, ${toX - cpx} ${toY}, ${toX} ${toY}`;
        } else {
          // Mostly vertical — vertical S-curve
          const cpy = dy * 0.4;
          d = `M ${fromX} ${fromY} C ${fromX} ${fromY + cpy}, ${toX} ${toY - cpy}, ${toX} ${toY}`;
        }
        paths.push(d);
      }
      setConnectorPaths(paths);
    }, 150);
    return () => clearTimeout(timer);
  }, [state?.phase, celebrating]);

  // Check if a pipeline phase still has running agents (for parallel execution across phases)
  const phaseHasRunningAgents = (phaseIndex: number): boolean => {
    if (!state) return false;
    const phase = PIPELINE_PHASES[phaseIndex];
    if (!phase) return false;
    return phase.agents.some((a) => {
      const task = state.agentTasks[a.id];
      return task && (task.status === "running" || task.status === "waiting_response");
    });
  };

  const getPhaseClass = (phaseIndex: number) => {
    if (currentPhaseIndex === -1) return "";
    if (isSettled) return "active done settled";
    if (isComplete) return "active done";
    if (phaseIndex < currentPhaseIndex && phaseHasRunningAgents(phaseIndex)) return "active";
    if (phaseIndex < currentPhaseIndex) return "active done";
    if (phaseIndex === currentPhaseIndex) return "active";
    return "";
  };

  const getBoxClass = (phaseIndex: number) => {
    if (currentPhaseIndex === -1) return "";
    if (isSettled) return "done settled";
    if (isComplete) return "done";
    if (phaseIndex < currentPhaseIndex && phaseHasRunningAgents(phaseIndex)) return "awake";
    if (phaseIndex < currentPhaseIndex) return "done";
    if (phaseIndex === currentPhaseIndex) return "awake";
    return "";
  };

  const getItemClass = (phaseIndex: number): string => {
    if (!state) return "";
    if (isSettled) return "done settled";
    if (isComplete) return "done";
    // Phase still has running agents — steady glow (not pulsating)
    if (phaseIndex < currentPhaseIndex && phaseHasRunningAgents(phaseIndex)) return "active-glow";
    if (phaseIndex < currentPhaseIndex) return "done";
    if (phaseIndex === currentPhaseIndex) {
      const hasRunning = Object.values(state.agentTasks).some(
        (t) => t.status === "running" || t.status === "waiting_response"
      );
      if (hasRunning) return "active-glow";
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

      {/* Nudge pulse overlay — hot pink full-screen flash during replay */}
      {nudgePulse && (
        <div className="nudge-pulse-overlay" />
      )}

      <div className="pipeline-viz">
        {/* Top bar: scrubber left, status right */}
        <div className="pipeline-top-bar">
          {replayEvents.length > 0 && (
            <div className="replay-bar">
              {catchingUp ? (
                <>
                  <span className="catching-up-indicator">Catching up...</span>
                  <input
                    type="range"
                    className="replay-scrubber"
                    min={0}
                    max={replayEvents.length - 1}
                    value={replayIndex}
                    readOnly
                  />
                  <span className="replay-counter">{replayIndex + 1} / {replayEvents.length}</span>
                </>
              ) : (
                <>
                  <button className="replay-btn" onClick={togglePlay} title={isPlaying ? "Pause" : "Replay"}>
                    {isPlaying ? "⏸" : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-9-9"/><polyline points="21 3 21 9 15 9"/><polygon points="10 8 16 12 10 16" fill="currentColor" stroke="none"/></svg>}
                  </button>
                  <input
                    type="range"
                    className="replay-scrubber"
                    min={0}
                    max={replayEvents.length - 1}
                    value={replayIndex}
                    onChange={(e) => seekTo(Number(e.target.value))}
                  />
                  <span className="replay-counter">{replayIndex + 1} / {replayEvents.length}</span>
                  {!atLiveEdge && !isComplete && (
                    <button className="live-btn" onClick={snapToLive} title="Jump to live">LIVE</button>
                  )}
                  <select
                    className="replay-speed"
                    value={playbackSpeed}
                    onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                  >
                    <option value={1}>1x (real-time)</option>
                    <option value={3}>3x</option>
                    <option value={5}>5x</option>
                    <option value={10}>10x</option>
                    <option value={20}>20x</option>
                    <option value={50}>50x</option>
                  </select>
                </>
              )}
            </div>
          )}

          <div className={`pipeline-status-header ${isComplete ? "settled" : ""}`}>
            {isComplete ? "Complete" : state.phase === "error" ? "Error" : `In Progress: ${PIPELINE_PHASES[currentPhaseIndex]?.name || state.phase}`}
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
              <filter id="pathGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="dotGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            {connectorPaths.map((d, i) => {
              if (!d) return null;
              const showConnector = i < currentPhaseIndex || isComplete;
              const isActiveConnector = i === currentPhaseIndex - 1 && !isComplete;
              const pathId = `connector-path-${i}`;
              return (
                <g key={`connector-${i}`}>
                  <path
                    id={pathId}
                    className={`flow-path ${showConnector ? "show" : ""} ${isActiveConnector ? "active" : ""} ${isSettled ? "settled" : ""}`}
                    d={d}
                  />
                  <circle className="flow-dot" r="5" data-connector={i} style={{ opacity: 0 }} />
                </g>
              );
            })}
          </svg>

          {/* Pipeline phases */}
          <div className="pipeline-phases">
            {PIPELINE_PHASES.map((phase, idx) => (
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
                  {/* Agents */}
                  {phase.type === "agent" && phase.agents.length > 0 && (() => {
                    return (
                      <>
                        <div className="sec-label">Agents ({phase.agents.length})</div>
                        {phase.agents.map((agent) => {
                          const agentTask = state?.agentTasks[agent.id];
                          const isAgentStale = isStale && agentTask && (agentTask.status === "running" || agentTask.status === "waiting_response");
                          const agentItemClass = agentTask
                            ? isAgentStale
                              ? "error"
                              : agentTask.status === "running" || agentTask.status === "waiting_response"
                              ? "working"
                              : agentTask.status === "complete"
                              ? "done"
                              : agentTask.status === "error"
                              ? "error"
                              : getItemClass(idx)
                            : getItemClass(idx);
                          return (
                            <div
                              key={agent.id}
                              className={`item ${isSettled ? "done settled" : agentItemClass} cursor-pointer`}
                              onClick={() => {
                                const targetAgent = expandedAgent === agent.id ? null : agent.id;
                                setExpandedAgent(targetAgent);
                                if (targetAgent) {
                                  fetch(`/api/workflow/${workflowId}/agent-output?agentId=${targetAgent}`)
                                    .then((r) => r.json())
                                    .then((data) => {
                                      if (data.output) {
                                        setAgentFullOutput((prev) => ({ ...prev, [targetAgent]: data.output }));
                                      }
                                    })
                                    .catch(() => {});
                                }
                              }}
                            >
                              <img className="svc-icon" src={awsIcons.agentcore} alt="AC" />
                              <span className="item-label">{agent.displayName}</span>
                              <span className="item-status" />
                            </div>
                          );
                        })}
                      </>
                    );
                  })()}

                  {/* Tools */}
                  {phase.tools.length > 0 && (
                    <>
                      <div className="sec-label">{phase.id === "intake" ? "User Actions" : "Tools"}</div>
                      {phase.tools.map((tool, i) => {
                        const iconKey = tool.icon || tool.dot || "ext";
                        const isFlashing = toolFlashes[`${phase.id}:${iconKey}`];
                        const itemClass = isFlashing ? "trigger" : getItemClass(idx);
                        return (
                          <div key={i} className={`item ${itemClass}`}>
                            {tool.icon ? (
                              <img className="svc-icon" src={(awsIcons as Record<string, string>)[tool.icon]} alt={tool.icon} />
                            ) : (
                              <span className={`item-dot ${tool.dot || "ext"}`} />
                            )}
                            <span className="item-label">{tool.label}</span>
                            <span className="item-status" />
                          </div>
                        );
                      })}
                    </>
                  )}

                  {/* Skills */}
                  {phase.skills.length > 0 && (
                    <>
                      <div className="sec-label">Skills</div>
                      {phase.skills.map((skill, i) => {
                        const isSkillFlashing = toolFlashes[`${phase.id}:skill`];
                        const itemClass = isSkillFlashing ? "trigger" : getItemClass(idx);
                        return (
                          <div key={i} className={`item ${itemClass}`}>
                            <span className="item-dot skill" />
                            <span className="item-label">{skill}</span>
                            <span className="item-status" />
                          </div>
                        );
                      })}
                    </>
                  )}

                  {/* Outputs */}
                  {phase.outputs.length > 0 && (
                    <>
                      <div className="sec-label">{phase.id === "intake" ? "Trigger" : "Output"}</div>
                      {phase.outputs.map((out, i) => {
                        const outIconKey = out.icon || out.dot || "ext";
                        const isOutFlashing = toolFlashes[`${phase.id}:${outIconKey}`];
                        const itemClass = isOutFlashing ? "trigger" : getItemClass(idx);
                        const isS3Output = out.icon === "s3";
                        return (
                          <div
                            key={i}
                            className={`item ${itemClass}${isS3Output ? " clickable" : ""}`}
                            onClick={isS3Output ? () => setArtifactsModal({ phaseId: phase.id, phaseName: phase.name }) : undefined}
                            style={isS3Output ? { cursor: "pointer" } : undefined}
                            title={isS3Output ? "View S3 artifacts" : undefined}
                          >
                            {out.icon ? (
                              <img className="svc-icon" src={(awsIcons as Record<string, string>)[out.icon]} alt={out.icon} />
                            ) : (
                              <span className={`item-dot ${out.dot || "ext"}`} />
                            )}
                            <span className="item-label">{out.label}</span>
                            <span className="item-status" />
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>


        {/* Agent Output Pop-Out Card */}
        <AgentOutputPanel
          isOpen={!!expandedAgent}
          onClose={() => setExpandedAgent(null)}
          isStale={isStale && !!expandedAgent && (Object.values(state.agentTasks).find((t) => t.agentId === expandedAgent)?.status === "running")}
          workflowId={workflowId}
          task={expandedAgent ? {
            id: `task_${expandedAgent}`,
            agentId: expandedAgent,
            ticketId: Object.values(state.agentTasks).find((t) => t.agentId === expandedAgent)?.ticketId || "",
            status: Object.values(state.agentTasks).find((t) => t.agentId === expandedAgent)?.status || "running",
            input: "",
            output: agentFullOutput[expandedAgent] || streamingText[expandedAgent] || Object.values(state.agentTasks).find((t) => t.agentId === expandedAgent)?.output || originalOutputsRef.current[expandedAgent] || "",
            branch: Object.values(state.agentTasks).find((t) => t.agentId === expandedAgent)?.branch,
          } : null}
        />

        {/* S3 Artifacts Modal — phase click shows all workflow artifacts */}
        <S3ArtifactsModal
          isOpen={!!artifactsModal}
          onClose={() => setArtifactsModal(null)}
          agentId=""
          agentName="Workflow"
          workflowId={workflowId}
        />
      </div>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const PIPELINE_STYLES = `
.pipeline-viz{display:flex;flex-direction:column;align-items:center;min-height:100vh;overflow-x:auto;padding:14px 20px;background:#0f1419;color:#e2e8f0;font-family:"Segoe UI",system-ui,sans-serif}
.pipeline-title{display:none}
.pipeline-subtitle{display:none}
@keyframes shimmer{to{background-position:200% center}}

.pipeline-top-bar{display:flex;align-items:center;width:1720px;margin-bottom:10px;position:relative}
.pipeline-status-header{position:absolute;left:50%;transform:translateX(-50%);font-size:16px;font-weight:700;color:#e2e8f0;letter-spacing:0.5px;text-transform:capitalize;transition:color .4s;white-space:nowrap}
.pipeline-status-header.settled{color:#f97316;animation:settledHeaderGlow 6s ease-in-out infinite}

.pipeline-canvas{position:relative;width:1720px;min-height:840px}
.pipeline-connectors{position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:10}
.flow-path{fill:none;stroke:#1e293b;stroke-width:2;stroke-linecap:round;opacity:0;transition:opacity .5s,stroke .5s}
.flow-path.show{opacity:1;stroke:#0ea5e9;stroke-width:2.5;filter:url(#pathGlow)}
.flow-path.active{stroke:#0ea5e9;stroke-width:3;filter:url(#pathGlow);opacity:1}
.flow-path.animating{stroke:#0ea5e9;stroke-width:3;opacity:1;filter:url(#pathGlow)}
.flow-dot{fill:#0ea5e9;filter:url(#dotGlow)}

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
.item.clickable:hover{border-color:#0ea5e960;background:#0ea5e918;transform:translateY(-1px)}
.item.active{border-color:#0ea5e940;background:#0ea5e910}
.item.active .item-label{color:#e2e8f0}
.item.done{border-color:#22c55e20;opacity:0.7}
.item.done .item-status{background:#22c55e}
.item.trigger{border-color:#f97316;background:#f9731610;animation:pulse .6s}
@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.02)}}
@keyframes agentPulse{0%{border-color:#0ea5e960;box-shadow:0 0 8px rgba(14,165,233,.3)}50%{border-color:#0ea5e9;box-shadow:0 0 16px rgba(14,165,233,.5)}100%{border-color:#0ea5e960;box-shadow:0 0 8px rgba(14,165,233,.3)}}
.item.active-glow{border-color:#0ea5e940;background:#0ea5e906;box-shadow:0 0 6px rgba(14,165,233,.15)}
.item.active-glow .item-label{color:#cbd5e1}
.item.active-glow .item-status{background:#0ea5e980}
.item.working{border-color:#0ea5e960;background:#0ea5e908;animation:agentPulse 1s ease-in-out infinite}
.item.working .item-label{color:#e2e8f0}
.item.working .item-status{background:#0ea5e9;box-shadow:0 0 5px #0ea5e9}

@keyframes errorPulse{0%{border-color:#ef444460;box-shadow:0 0 8px rgba(239,68,68,.3)}50%{border-color:#ef4444;box-shadow:0 0 16px rgba(239,68,68,.5)}100%{border-color:#ef444460;box-shadow:0 0 8px rgba(239,68,68,.3)}}
.item.error{border-color:#ef444460;background:#ef444408;animation:errorPulse 2s ease-in-out infinite}
.item.error .item-label{color:#fca5a5}
.item.error .item-status{background:#ef4444;box-shadow:0 0 5px #ef4444}

.svc-icon{width:16px;height:16px;border-radius:2px;object-fit:contain;flex-shrink:0}
.item-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
.item-dot.skill{background:#a855f7}
.item-dot.ext{background:#64748b}

.item-label{font-size:10px;font-weight:500;color:#94a3b8;line-height:1.15;transition:color .3s}
.item.active .item-label{color:#e2e8f0}
.item-status{width:6px;height:6px;border-radius:50%;background:#1e293b;margin-left:auto;flex-shrink:0;transition:background .3s}
.item.active .item-status{background:#0ea5e9;box-shadow:0 0 5px #0ea5e9}


@keyframes celebrateBurst{0%{border-color:#f97316;box-shadow:0 0 30px rgba(255,255,255,.6)}100%{border-color:#22c55e50;box-shadow:0 0 8px rgba(34,197,94,.1)}}
@keyframes celebrateItemBurst{0%{border-color:#f97316;background:#f9731618}100%{border-color:#f9731640;background:#f9731608}}
@keyframes celebrateStatusBurst{0%{background:#f97316;box-shadow:0 0 8px #fbbf24}100%{background:#22c55e;box-shadow:0 0 4px rgba(34,197,94,.3)}}
@keyframes celebrateConnector{0%{stroke:#f97316;opacity:.8}100%{stroke:#22c55e80;opacity:.4}}
.celebrate-wrapper .agent-box.done{animation:celebrateBurst 1.2s ease-out forwards}
.celebrate-wrapper .item.done{animation:celebrateItemBurst 1.2s ease-out forwards}
.celebrate-wrapper .item.done .item-status{animation:celebrateStatusBurst 1.2s ease-out forwards}
.celebrate-wrapper .flow-path.show{animation:celebrateConnector 1.2s ease-out forwards}
.celebrate-wrapper .pipeline-status-header{color:#f97316}
.celebrate-wrapper .pipeline-title{background:linear-gradient(90deg,#f97316,#fbbf24,#f97316);background-size:200% auto;-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.celebrate-wrapper .phase.done{opacity:1}

/* Settled state — completed workflow loaded from history */
@keyframes settledGlow{0%,100%{border-color:#f97316;box-shadow:0 0 14px rgba(249,115,22,.25)}50%{border-color:#fb923c;box-shadow:0 0 24px rgba(249,115,22,.45)}}
@keyframes settledItemGlow{0%,100%{border-color:#f9731640;background:#f9731610;box-shadow:0 0 4px rgba(249,115,22,.1)}50%{border-color:#f9731670;background:#f9731618;box-shadow:0 0 8px rgba(249,115,22,.2)}}
@keyframes settledDotGlow{0%,100%{box-shadow:0 0 4px #f97316}50%{box-shadow:0 0 8px #f97316,0 0 12px rgba(249,115,22,.4)}}
@keyframes settledPathGlow{0%,100%{opacity:.6;filter:url(#pathGlow)}50%{opacity:.9;filter:url(#pathGlow) brightness(1.2)}}
@keyframes settledHeaderGlow{0%,100%{text-shadow:0 0 8px rgba(249,115,22,.2)}50%{text-shadow:0 0 16px rgba(249,115,22,.4)}}
.phase.settled{opacity:1}
.agent-box.done.settled{animation:settledGlow 6s ease-in-out infinite;border-color:#f97316}
.item.done.settled{animation:settledItemGlow 6s ease-in-out infinite;opacity:1;border-color:#f9731650}
.item.done.settled .item-status{background:#f97316;animation:settledDotGlow 6s ease-in-out infinite}
.item.done.settled .item-label{color:#e2e8f0}
.item.done.settled .item-dot{background:#f97316;animation:settledDotGlow 6s ease-in-out infinite}
.item.done.settled .svc-icon{filter:drop-shadow(0 0 3px rgba(249,115,22,.3))}
.flow-path.settled{stroke:#f97316;opacity:.7;stroke-width:2.5;animation:settledPathGlow 6s ease-in-out infinite}

.replay-bar{display:flex;align-items:center;gap:10px;padding:6px 12px;background:#1a2332;border:1px solid #1e293b;border-radius:8px;position:relative;z-index:20}
.replay-btn{background:none;border:1px solid #334155;color:#e2e8f0;font-size:14px;width:32px;height:32px;border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s}
.replay-btn:hover{border-color:#0ea5e9;background:#0ea5e920}
.replay-scrubber{flex:1;height:4px;-webkit-appearance:none;appearance:none;background:#334155;border-radius:2px;cursor:pointer;outline:none}
.replay-scrubber::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:#0ea5e9;cursor:pointer;box-shadow:0 0 6px rgba(14,165,233,.5)}
.replay-scrubber::-moz-range-thumb{width:14px;height:14px;border-radius:50%;background:#0ea5e9;cursor:pointer;border:none}
.replay-counter{font-size:11px;color:#64748b;font-family:"JetBrains Mono",monospace;min-width:80px;text-align:center}
.replay-speed{background:#0f1419;border:1px solid #334155;color:#e2e8f0;font-size:11px;padding:4px 8px;border-radius:4px;cursor:pointer}
.replay-speed:hover{border-color:#0ea5e9}
.live-btn{display:flex;align-items:center;gap:4px;background:#ef4444;color:#fff;font-size:10px;font-weight:700;letter-spacing:0.5px;padding:4px 10px;border-radius:4px;border:none;cursor:pointer;animation:livePulse 1.5s ease-in-out infinite}
.live-btn::before{content:"";width:6px;height:6px;border-radius:50%;background:#fff;animation:liveDot 1.5s ease-in-out infinite}
@keyframes livePulse{0%,100%{opacity:1}50%{opacity:0.7}}
@keyframes liveDot{0%,100%{opacity:1}50%{opacity:0.4}}
.catching-up-indicator{font-size:12px;color:#0ea5e9;font-weight:500;letter-spacing:0.5px;animation:catchUpPulse 1.2s ease-in-out infinite}
@keyframes catchUpPulse{0%,100%{opacity:1}50%{opacity:0.5}}

.agent-output-panel{margin-top:16px;width:100%;max-width:1720px;background:#1a2332;border:1px solid #1e293b;border-radius:8px;overflow:hidden}
.agent-output-header{display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:#0f1419;border-bottom:1px solid #1e293b;font-size:11px;color:#94a3b8;letter-spacing:1px;text-transform:uppercase}
.agent-output-close{background:none;border:none;color:#64748b;font-size:14px;cursor:pointer;padding:2px 6px}
.agent-output-close:hover{color:#e2e8f0}
.agent-output-body{padding:12px;font-size:12px;color:#94a3b8;white-space:pre-wrap;max-height:300px;overflow-y:auto;font-family:"JetBrains Mono",monospace;line-height:1.5}

.nudge-pulse-overlay{position:fixed;inset:0;z-index:9999;pointer-events:none;animation:nudgePulse 1.5s ease-out forwards}
@keyframes nudgePulse{0%{background:rgba(236,72,153,0.35);box-shadow:inset 0 0 120px rgba(236,72,153,0.6)}30%{background:rgba(236,72,153,0.15);box-shadow:inset 0 0 60px rgba(236,72,153,0.3)}100%{background:transparent;box-shadow:none}}
`;
