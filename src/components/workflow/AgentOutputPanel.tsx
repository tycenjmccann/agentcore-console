"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, AlertCircle, FileText } from "lucide-react";
import type { AgentTask } from "@/lib/workflow/types";
import { MarkdownRenderer } from "./MarkdownRenderer";

interface AgentOutputPanelProps {
  task: AgentTask | null;
  isOpen: boolean;
  onClose: () => void;
  triggerRef?: React.RefObject<HTMLElement | null>;
}

/** Format agent ID to display name */
function formatAgentName(agentId: string): string {
  return agentId
    .replace(/^team-/, "")
    .split("-")
    .map((word) => {
      const upper = word.toUpperCase();
      if (["IOS", "API", "UI", "QA"].includes(upper)) return upper;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

export default function AgentOutputPanel({
  task,
  isOpen,
  onClose,
  triggerRef,
}: AgentOutputPanelProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);
  const [mounted, setMounted] = useState(false);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Portal mount (client-only)
  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto-scroll to bottom when output changes (streaming)
  useEffect(() => {
    if (contentRef.current && task?.output && isAutoScrollEnabled) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [task?.output, isAutoScrollEnabled]);

  // Focus management: trap focus, return on close
  useEffect(() => {
    if (!isOpen || !modalRef.current) return;

    // Save previous focus
    previousFocusRef.current = document.activeElement as HTMLElement;

    // Focus close button on open
    const timer = setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 50);

    return () => clearTimeout(timer);
  }, [isOpen]);

  // Focus trap
  useEffect(() => {
    if (!isOpen || !modalRef.current) return;

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !modalRef.current) return;

      const focusableSelector =
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
      const focusableEls = modalRef.current.querySelectorAll(focusableSelector);
      if (focusableEls.length === 0) return;

      const firstFocusable = focusableEls[0] as HTMLElement;
      const lastFocusable = focusableEls[focusableEls.length - 1] as HTMLElement;

      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable?.focus();
        }
      } else {
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable?.focus();
        }
      }
    };

    document.addEventListener("keydown", handleTab);
    return () => document.removeEventListener("keydown", handleTab);
  }, [isOpen]);

  // Scroll lock
  useEffect(() => {
    if (isOpen) {
      const scrollY = window.scrollY;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
        window.scrollTo(0, scrollY);
      };
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isAnimatingOut) {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, isAnimatingOut]);

  const handleClose = useCallback(() => {
    setIsAnimatingOut(true);
  }, []);

  const handleAnimationEnd = useCallback(() => {
    if (isAnimatingOut) {
      setIsAnimatingOut(false);
      onClose();
      // Return focus to trigger element
      if (triggerRef?.current) {
        triggerRef.current.focus();
      } else if (previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    }
  }, [isAnimatingOut, onClose, triggerRef]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        handleClose();
      }
    },
    [handleClose]
  );

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const isAtBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setIsAutoScrollEnabled(isAtBottom);
  }, []);

  // Don't render if not open (and not animating out)
  if ((!isOpen && !isAnimatingOut) || !mounted) return null;

  const agentName = task ? formatAgentName(task.agentId) : "Agent Output";
  const isRunning = task?.status === "running";

  const statusClass = task?.status === "running"
    ? "running"
    : task?.status === "complete"
    ? "complete"
    : task?.status === "error"
    ? "error"
    : "";

  const statusLabel = task?.status === "running"
    ? "Working"
    : task?.status === "complete"
    ? "Complete"
    : task?.status === "error"
    ? "Error"
    : task?.status || "";

  const modal = (
    <div
      className={`modal-backdrop ${isAnimatingOut ? "modal-backdrop-exit" : "modal-backdrop-enter"}`}
      onClick={handleBackdropClick}
      aria-hidden="true"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="agent-output-title"
        className={`agent-output-modal ${isAnimatingOut ? "modal-card-exit" : "modal-card-enter"}`}
        ref={modalRef}
        onAnimationEnd={handleAnimationEnd}
      >
        {/* Header */}
        <div className="modal-header">
          <div className="flex items-center min-w-0 flex-1">
            <h2
              id="agent-output-title"
              className="modal-header-title truncate"
            >
              {agentName}
            </h2>
            {statusLabel && (
              <span className={`modal-header-status ${statusClass}`}>
                {statusLabel}
              </span>
            )}
          </div>
          <button
            ref={closeButtonRef}
            className="modal-close-btn"
            onClick={handleClose}
            aria-label="Close agent output"
            type="button"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Content */}
        <div
          className="modal-content"
          ref={contentRef}
          onScroll={handleScroll}
        >
          {task?.output ? (
            <>
              <MarkdownRenderer content={task.output} />
              {isRunning && (
                <div className="streaming-indicator" aria-hidden="true">
                  <span className="streaming-cursor" />
                  <span className="streaming-dots">
                    <span className="streaming-dot" />
                    <span className="streaming-dot" />
                    <span className="streaming-dot" />
                  </span>
                </div>
              )}
            </>
          ) : isRunning ? (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <div className="streaming-indicator" aria-hidden="true">
                <span className="streaming-cursor" />
                <span className="streaming-dots">
                  <span className="streaming-dot" />
                  <span className="streaming-dot" />
                  <span className="streaming-dot" />
                </span>
              </div>
              <p className="text-sm mt-3" style={{ color: "var(--pipeline-text-muted)" }}>
                Waiting for output...
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <div className="w-8 h-8 rounded-full flex items-center justify-center mb-3" style={{ background: "rgba(100, 116, 139, 0.15)" }}>
                <FileText size={16} style={{ color: "var(--pipeline-text-muted)" }} aria-hidden="true" />
              </div>
              <p className="text-sm" style={{ color: "var(--pipeline-text-muted)" }}>
                No output yet.
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--pipeline-text-dim)" }}>
                Output will appear here when the agent starts working.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        {task && (
          <div className="modal-footer">
            <div className="flex items-center gap-3">
              <span>Status: {task.status}</span>
              {task.branch && <span>Branch: {task.branch}</span>}
            </div>
            {task.error && (
              <div className="flex items-center gap-1.5">
                <AlertCircle size={14} style={{ color: "var(--pipeline-error)" }} aria-hidden="true" />
                <span className="modal-footer-error truncate max-w-[400px]">
                  {task.error}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Screen reader live region */}
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {isRunning && "Agent is producing output..."}
          {task?.status === "complete" && "Agent output complete."}
          {task?.status === "error" && `Agent encountered an error: ${task.error}`}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
