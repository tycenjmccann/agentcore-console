"use client";

import { useReducer, useCallback, useRef, useEffect, useMemo } from "react";
import type { StoredEvent, WorkflowEvent, WorkflowPhase } from "@/lib/workflow/types";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ReplayStatus = "idle" | "playing" | "paused" | "at-end";

export interface PhaseMarkerData {
  phase: string;
  label: string;
  shortLabel: string;
  position: number; // 0..1
  timestamp: number; // ms from start
}

export interface ReplayState {
  status: ReplayStatus;
  currentTime: number; // ms elapsed in replay timeline
  totalDuration: number; // total ms of the eventLog span
  progress: number; // 0..1 (currentTime / totalDuration)
  speed: 1 | 2 | 4;
  isDragging: boolean;
  hoverProgress: number | null;
  phaseMarkers: PhaseMarkerData[];
}

type ReplayAction =
  | { type: "PLAY" }
  | { type: "PAUSE" }
  | { type: "SEEK"; progress: number }
  | { type: "SET_SPEED"; speed: 1 | 2 | 4 }
  | { type: "TICK"; deltaMs: number }
  | { type: "DRAG_START" }
  | { type: "DRAG_END"; progress: number }
  | { type: "HOVER"; progress: number | null }
  | { type: "REACHED_END" };

// ─── Phase label mapping ───────────────────────────────────────────────────────

const PHASE_LABELS: Record<string, { label: string; shortLabel: string }> = {
  requirements: { label: "Requirements", shortLabel: "Req" },
  design: { label: "Design", shortLabel: "Des" },
  development: { label: "Development", shortLabel: "Dev" },
  review: { label: "QA & Ship", shortLabel: "QA" },
  verification: { label: "QA & Ship", shortLabel: "QA" },
  complete: { label: "Complete", shortLabel: "End" },
};

// ─── Snap threshold ────────────────────────────────────────────────────────────

const SNAP_THRESHOLD = 0.05; // 5% of timeline

// ─── Helper: snap progress to nearest phase marker ─────────────────────────────

function snapProgress(progress: number, markers: PhaseMarkerData[]): number {
  for (const marker of markers) {
    if (Math.abs(progress - marker.position) < SNAP_THRESHOLD) {
      return marker.position;
    }
  }
  return progress;
}

// ─── Reducer ───────────────────────────────────────────────────────────────────

function replayReducer(state: ReplayState, action: ReplayAction): ReplayState {
  switch (action.type) {
    case "PLAY": {
      if (state.status === "at-end") {
        // Restart from beginning
        return { ...state, status: "playing", currentTime: 0, progress: 0 };
      }
      return { ...state, status: "playing" };
    }
    case "PAUSE":
      return { ...state, status: "paused" };
    case "SEEK": {
      const clamped = Math.max(0, Math.min(1, action.progress));
      const snapped = snapProgress(clamped, state.phaseMarkers);
      const time = snapped * state.totalDuration;
      const newStatus = snapped >= 1 ? "at-end" : (state.status === "playing" ? "playing" : "paused");
      return { ...state, progress: snapped, currentTime: time, status: newStatus };
    }
    case "SET_SPEED":
      return { ...state, speed: action.speed };
    case "TICK": {
      if (state.status !== "playing" || state.isDragging) return state;
      const newTime = state.currentTime + action.deltaMs;
      if (newTime >= state.totalDuration) {
        return { ...state, status: "at-end", currentTime: state.totalDuration, progress: 1 };
      }
      const newProgress = state.totalDuration > 0 ? newTime / state.totalDuration : 0;
      return { ...state, currentTime: newTime, progress: newProgress };
    }
    case "DRAG_START":
      return { ...state, isDragging: true };
    case "DRAG_END": {
      const clamped = Math.max(0, Math.min(1, action.progress));
      const snapped = snapProgress(clamped, state.phaseMarkers);
      const time = snapped * state.totalDuration;
      const newStatus = snapped >= 1 ? "at-end" : "paused";
      return { ...state, isDragging: false, progress: snapped, currentTime: time, status: newStatus };
    }
    case "HOVER":
      return { ...state, hoverProgress: action.progress };
    case "REACHED_END":
      return { ...state, status: "at-end", progress: 1, currentTime: state.totalDuration };
    default:
      return state;
  }
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useReplayState(eventLog: StoredEvent[]) {
  // Calculate total duration and phase markers from eventLog
  const { totalDuration, phaseMarkers } = useMemo(() => {
    if (!eventLog || eventLog.length === 0) {
      return { totalDuration: 0, phaseMarkers: [] };
    }

    const firstTs = new Date(eventLog[0].timestamp).getTime();
    const lastTs = new Date(eventLog[eventLog.length - 1].timestamp).getTime();
    const duration = Math.max(1, lastTs - firstTs);

    // Extract phase_change events
    const markers: PhaseMarkerData[] = [];
    for (const entry of eventLog) {
      const event = entry.event;
      if (event.type === "phase_change") {
        const phase = event.phase as string;
        const labels = PHASE_LABELS[phase];
        if (labels && phase !== "intake" && phase !== "complete") {
          const ts = new Date(entry.timestamp).getTime();
          const position = (ts - firstTs) / duration;
          // Avoid duplicate markers for same phase
          if (!markers.some((m) => m.phase === phase)) {
            markers.push({
              phase,
              label: labels.label,
              shortLabel: labels.shortLabel,
              position: Math.max(0, Math.min(1, position)),
              timestamp: ts - firstTs,
            });
          }
        }
      }
    }

    return { totalDuration: duration, phaseMarkers: markers };
  }, [eventLog]);

  const initialState: ReplayState = {
    status: "idle",
    currentTime: 0,
    totalDuration,
    progress: 0,
    speed: 1,
    isDragging: false,
    hoverProgress: null,
    phaseMarkers,
  };

  const [state, dispatch] = useReducer(replayReducer, initialState);

  // Update totalDuration and phaseMarkers when eventLog changes
  // Since useReducer doesn't auto-sync, we keep them in state via an effect workaround.
  // In practice the eventLog won't change after mount for completed workflows.
  const stateRef = useRef(state);
  stateRef.current = state;

  // RAF playback loop
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number>(0);

  const animate = useCallback((timestamp: number) => {
    if (lastFrameRef.current === 0) {
      lastFrameRef.current = timestamp;
    }
    const delta = timestamp - lastFrameRef.current;
    lastFrameRef.current = timestamp;

    const currentState = stateRef.current;
    if (currentState.status === "playing" && !currentState.isDragging) {
      dispatch({ type: "TICK", deltaMs: delta * currentState.speed });
    }

    if (stateRef.current.status === "playing") {
      rafRef.current = requestAnimationFrame(animate);
    }
  }, []);

  // Start/stop RAF based on playing status
  useEffect(() => {
    if (state.status === "playing") {
      lastFrameRef.current = 0;
      rafRef.current = requestAnimationFrame(animate);
    } else {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    }
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [state.status, animate]);

  // Pause when tab becomes hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && stateRef.current.status === "playing") {
        dispatch({ type: "PAUSE" });
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  // Actions
  const play = useCallback(() => dispatch({ type: "PLAY" }), []);
  const pause = useCallback(() => dispatch({ type: "PAUSE" }), []);
  const togglePlayPause = useCallback(() => {
    const s = stateRef.current;
    if (s.status === "playing") {
      dispatch({ type: "PAUSE" });
    } else {
      dispatch({ type: "PLAY" });
    }
  }, []);
  const seek = useCallback((progress: number) => dispatch({ type: "SEEK", progress }), []);
  const setSpeed = useCallback((speed: 1 | 2 | 4) => dispatch({ type: "SET_SPEED", speed }), []);
  const dragStart = useCallback(() => dispatch({ type: "DRAG_START" }), []);
  const dragEnd = useCallback((progress: number) => dispatch({ type: "DRAG_END", progress }), []);
  const setHover = useCallback((progress: number | null) => dispatch({ type: "HOVER", progress }), []);

  const stepForward = useCallback(() => {
    const s = stateRef.current;
    const newProgress = Math.min(1, s.progress + 0.05);
    dispatch({ type: "SEEK", progress: newProgress });
  }, []);

  const stepBackward = useCallback(() => {
    const s = stateRef.current;
    const newProgress = Math.max(0, s.progress - 0.05);
    dispatch({ type: "SEEK", progress: newProgress });
  }, []);

  // Determine event index from progress for parent component integration
  const eventIndex = useMemo(() => {
    if (!eventLog || eventLog.length === 0) return 0;
    const firstTs = new Date(eventLog[0].timestamp).getTime();
    const targetTime = firstTs + state.currentTime;
    // Find the last event at or before targetTime
    let idx = 0;
    for (let i = 0; i < eventLog.length; i++) {
      const evTs = new Date(eventLog[i].timestamp).getTime();
      if (evTs <= targetTime) {
        idx = i;
      } else {
        break;
      }
    }
    return idx;
  }, [eventLog, state.currentTime]);

  // Get current phase based on progress
  const currentPhase = useMemo((): string => {
    // Find the last phase marker at or before current progress
    let phase = "intake";
    for (const marker of phaseMarkers) {
      if (state.progress >= marker.position) {
        phase = marker.phase;
      }
    }
    return phase;
  }, [state.progress, phaseMarkers]);

  return {
    state: {
      ...state,
      totalDuration,
      phaseMarkers,
    },
    actions: {
      play,
      pause,
      togglePlayPause,
      seek,
      setSpeed,
      dragStart,
      dragEnd,
      setHover,
      stepForward,
      stepBackward,
    },
    eventIndex,
    currentPhase,
  };
}
