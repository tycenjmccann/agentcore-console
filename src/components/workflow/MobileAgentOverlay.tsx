"use client";

import { useEffect, useRef, useCallback } from "react";
import type { AgentTask } from "@/lib/workflow/types";

interface MobileAgentOverlayProps {
  agentId: string;
  agentTask: AgentTask | undefined;
  streamingText: string | undefined;
  onClose: () => void;
}

/**
 * Full-screen overlay for mobile agent detail/output.
 * Renders as a bottom sheet pattern with close button and swipe-to-dismiss.
 */
export default function MobileAgentOverlay({
  agentId,
  agentTask,
  streamingText,
  onClose,
}: MobileAgentOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<number>(0);
  const touchMoveRef = useRef<number>(0);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Prevent body scroll when overlay is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  // Swipe-to-dismiss handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartRef.current = e.touches[0].clientY;
    touchMoveRef.current = e.touches[0].clientY;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    touchMoveRef.current = e.touches[0].clientY;
    const delta = touchMoveRef.current - touchStartRef.current;
    if (delta > 0 && overlayRef.current) {
      overlayRef.current.style.transform = `translateY(${Math.min(delta, 300)}px)`;
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    const delta = touchMoveRef.current - touchStartRef.current;
    if (delta > 120) {
      onClose();
    } else if (overlayRef.current) {
      overlayRef.current.style.transform = "translateY(0)";
    }
  }, [onClose]);

  const outputText = streamingText || agentTask?.output || "No output yet...";
  const statusLabel = agentTask
    ? agentTask.status === "running" || agentTask.status === "waiting_response"
      ? "Running"
      : agentTask.status === "complete"
      ? "Complete"
      : agentTask.status === "error"
      ? "Error"
      : "Pending"
    : "Pending";

  return (
    <div className="mobile-overlay-backdrop" onClick={onClose} aria-modal="true" role="dialog" aria-label={`Agent output: ${agentId}`}>
      <div
        ref={overlayRef}
        className="mobile-overlay-sheet"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag handle */}
        <div className="mobile-overlay-handle" aria-hidden="true">
          <div className="mobile-overlay-handle-bar" />
        </div>

        {/* Header */}
        <div className="mobile-overlay-header">
          <div className="mobile-overlay-title-row">
            <h3 className="mobile-overlay-agent-name">{agentId}</h3>
            <span className={`mobile-overlay-status mobile-status-${statusLabel.toLowerCase()}`}>
              {statusLabel}
            </span>
          </div>
          <button
            onClick={onClose}
            className="mobile-overlay-close"
            aria-label="Close agent output"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="mobile-overlay-content">
          <pre className="mobile-overlay-output">{outputText}</pre>
        </div>
      </div>
    </div>
  );
}
