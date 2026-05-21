"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { Play, Pause, RotateCcw } from "lucide-react";
import type { StoredEvent } from "@/lib/workflow/types";
import { useReplayState } from "./useReplayState";
import "./replay-scrubber.css";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ReplayScrubberProps {
  eventLog: StoredEvent[];
  /** Called whenever the replay position changes with the event index */
  onSeek?: (eventIndex: number) => void;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function ReplayScrubber({ eventLog, onSeek }: ReplayScrubberProps) {
  const { state, actions, eventIndex, currentPhase } = useReplayState(eventLog);
  const trackRef = useRef<HTMLDivElement>(null);
  const [announcement, setAnnouncement] = useState("");
  const [isSnapping, setIsSnapping] = useState(false);
  const prevProgressRef = useRef(state.progress);

  // Notify parent of position changes (guarded to prevent infinite loops if onSeek isn't memoized)
  const prevEventIndexRef = useRef(eventIndex);
  useEffect(() => {
    if (prevEventIndexRef.current !== eventIndex) {
      prevEventIndexRef.current = eventIndex;
      onSeek?.(eventIndex);
    }
  }, [eventIndex, onSeek]);

  // Detect snap for visual feedback
  useEffect(() => {
    const prev = prevProgressRef.current;
    prevProgressRef.current = state.progress;
    // Check if we snapped to a marker
    for (const marker of state.phaseMarkers) {
      if (state.progress === marker.position && prev !== marker.position) {
        setIsSnapping(true);
        setTimeout(() => setIsSnapping(false), 200);
        break;
      }
    }
  }, [state.progress, state.phaseMarkers]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if not in an input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }

      switch (e.key) {
        case " ":
          e.preventDefault();
          actions.togglePlayPause();
          setAnnouncement(state.status === "playing" ? "Paused replay" : "Playing replay");
          break;
        case "ArrowLeft":
          e.preventDefault();
          actions.stepBackward();
          setAnnouncement(`Stepped backward`);
          break;
        case "ArrowRight":
          e.preventDefault();
          actions.stepForward();
          setAnnouncement(`Stepped forward`);
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [actions, state.status]);

  // Track click/drag handlers
  const getProgressFromEvent = useCallback(
    (clientX: number): number => {
      if (!trackRef.current) return 0;
      const rect = trackRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      return Math.max(0, Math.min(1, x / rect.width));
    },
    []
  );

  const handleTrackPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Skip if clicking on a phase marker (marker has its own onClick handler)
      if ((e.target as HTMLElement).closest('.scrubber-marker')) return;
      e.preventDefault();
      const progress = getProgressFromEvent(e.clientX);
      actions.dragStart();
      actions.seek(progress);

      const handlePointerMove = (ev: PointerEvent) => {
        const p = getProgressFromEvent(ev.clientX);
        actions.seek(p);
      };

      const handlePointerUp = (ev: PointerEvent) => {
        const p = getProgressFromEvent(ev.clientX);
        actions.dragEnd(p);
        document.removeEventListener("pointermove", handlePointerMove);
        document.removeEventListener("pointerup", handlePointerUp);
      };

      document.addEventListener("pointermove", handlePointerMove);
      document.addEventListener("pointerup", handlePointerUp);
    },
    [actions, getProgressFromEvent]
  );

  const handleTrackPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!state.isDragging) {
        const progress = getProgressFromEvent(e.clientX);
        actions.setHover(progress);
      }
    },
    [state.isDragging, actions, getProgressFromEvent]
  );

  const handleTrackPointerLeave = useCallback(() => {
    actions.setHover(null);
  }, [actions]);

  // Play/Pause button handler
  const handlePlayPause = useCallback(() => {
    if (state.status === "at-end") {
      actions.seek(0);
      actions.play();
      setAnnouncement("Restarting replay");
    } else if (state.status === "playing") {
      actions.pause();
      setAnnouncement("Paused replay");
    } else {
      actions.play();
      setAnnouncement("Playing replay");
    }
  }, [state.status, actions]);

  // Speed change handler
  const handleSpeedChange = useCallback(
    (speed: 1 | 2 | 4) => {
      actions.setSpeed(speed);
      setAnnouncement(`Playback speed set to ${speed}x`);
    },
    [actions]
  );

  // Phase marker click handler
  const handleMarkerClick = useCallback(
    (position: number) => {
      actions.seek(position);
      setAnnouncement(`Seeked to phase marker`);
    },
    [actions]
  );

  // Determine play button state/icon
  const playBtnClass =
    state.status === "playing"
      ? "scrubber-play-btn playing"
      : state.status === "at-end"
      ? "scrubber-play-btn at-end"
      : "scrubber-play-btn";

  const playBtnLabel =
    state.status === "playing"
      ? "Pause replay"
      : state.status === "at-end"
      ? "Restart replay"
      : "Play replay";

  const PlayIcon =
    state.status === "playing" ? Pause : state.status === "at-end" ? RotateCcw : Play;

  // Compute aria-valuetext
  const progressPercent = Math.round(state.progress * 100);
  const elapsedFormatted = formatTimestamp(state.currentTime);
  const totalFormatted = formatTimestamp(state.totalDuration);
  const ariaValueText = `${elapsedFormatted} of ${totalFormatted}, ${currentPhase} phase`;

  // Tooltip content
  const tooltipTime =
    state.hoverProgress !== null
      ? formatTimestamp(state.hoverProgress * state.totalDuration)
      : "";
  const tooltipLeft =
    state.hoverProgress !== null ? `${state.hoverProgress * 100}%` : "0%";

  return (
    <section className="replay-scrubber" aria-label="Workflow replay controls" role="toolbar">
      {/* Screen reader announcements */}
      <div className="scrubber-sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>

      {/* Play/Pause Button */}
      <button
        className={playBtnClass}
        onClick={handlePlayPause}
        aria-label={playBtnLabel}
        type="button"
      >
        <PlayIcon size={16} />
      </button>

      {/* Timeline Track */}
      <div
        ref={trackRef}
        className="scrubber-track"
        role="slider"
        aria-label="Replay timeline"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progressPercent}
        aria-valuetext={ariaValueText}
        tabIndex={0}
        onPointerDown={handleTrackPointerDown}
        onPointerMove={handleTrackPointerMove}
        onPointerLeave={handleTrackPointerLeave}
        onKeyDown={(e) => {
          switch (e.key) {
            case "ArrowRight":
              e.preventDefault();
              actions.stepForward();
              break;
            case "ArrowLeft":
              e.preventDefault();
              actions.stepBackward();
              break;
            case "ArrowUp":
              e.preventDefault();
              actions.seek(Math.min(1, state.progress + 0.1));
              break;
            case "ArrowDown":
              e.preventDefault();
              actions.seek(Math.max(0, state.progress - 0.1));
              break;
            case "Home":
              e.preventDefault();
              actions.seek(0);
              break;
            case "End":
              e.preventDefault();
              actions.seek(1);
              break;
          }
        }}
      >
        {/* Track background rail */}
        <div className="scrubber-track-rail">
          {/* Filled portion */}
          <div
            className="scrubber-track-filled"
            style={{ width: `${state.progress * 100}%` }}
            aria-hidden="true"
          />
        </div>

        {/* Phase markers */}
        <div className="scrubber-markers" aria-hidden="true">
          {state.phaseMarkers.map((marker) => {
            const isActive = Math.abs(state.progress - marker.position) < 0.05;
            return (
              <div
                key={marker.phase}
                className={`scrubber-marker${isActive ? " active" : ""}`}
                style={{ left: `${marker.position * 100}%` }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleMarkerClick(marker.position);
                }}
              >
                <div className="scrubber-marker-tick" />
                <span className="scrubber-marker-label">
                  {/* Show short label on tablets, full label on desktop */}
                  <span className="hidden sm:inline md:hidden">{marker.shortLabel}</span>
                  <span className="sm:hidden md:inline">{marker.label}</span>
                </span>
              </div>
            );
          })}
        </div>

        {/* Playhead */}
        <div
          className={`scrubber-playhead${state.isDragging ? " dragging" : ""}${isSnapping ? " snapping" : ""}`}
          style={{ left: `${state.progress * 100}%` }}
          aria-hidden="true"
        />

        {/* Hover tooltip */}
        {state.hoverProgress !== null && (
          <div
            className="scrubber-tooltip"
            style={{ left: tooltipLeft }}
            aria-hidden="true"
          >
            {tooltipTime}
          </div>
        )}
      </div>

      {/* Speed Controls */}
      <div className="scrubber-speed-group" role="radiogroup" aria-label="Playback speed">
        {([1, 2, 4] as const).map((speed) => (
          <button
            key={speed}
            className={`scrubber-speed-pill${state.speed === speed ? " active" : ""}`}
            onClick={() => handleSpeedChange(speed)}
            role="radio"
            aria-checked={state.speed === speed}
            aria-label={`${speed}x speed`}
            type="button"
          >
            {speed}x
          </button>
        ))}
      </div>
    </section>
  );
}

export default ReplayScrubber;
