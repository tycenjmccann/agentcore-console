"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, AlertCircle, FileText } from "lucide-react";
import type { AgentTask } from "@/lib/workflow/types";
import { MarkdownRenderer } from "./MarkdownRenderer";
import "./pipeline.css";

interface AgentOutputPanelProps {
  task: AgentTask | null;
  isOpen: boolean;
  onClose: () => void;
  isLoading?: boolean;
  isStale?: boolean;
  workflowId?: string;
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
  isLoading,
  isStale,
  workflowId,
  triggerRef,
}: AgentOutputPanelProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Clear restarting state when agent comes back to life (isStale clears)
  // or after 30s timeout (so button isn't stuck disabled forever if agent never starts)
  useEffect(() => {
    if (!isStale && isRestarting) {
      setIsRestarting(false);
    }
  }, [isStale, isRestarting]);

  useEffect(() => {
    if (!isRestarting) return;
    const timeout = setTimeout(() => setIsRestarting(false), 30_000);
    return () => clearTimeout(timeout);
  }, [isRestarting]);

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

  // Scroll to summary section when panel opens OR when output loads (async fetch)
  const hasScrolledRef = useRef(false);
  useEffect(() => {
    if (!isOpen) {
      hasScrolledRef.current = false;
      return;
    }
    if (hasScrolledRef.current || !contentRef.current || !task?.output) return;
    // Wait a frame for the DOM to render the summary ref
    requestAnimationFrame(() => {
      if (summaryRef.current && contentRef.current) {
        hasScrolledRef.current = true;
        contentRef.current.scrollTop = summaryRef.current.offsetTop - contentRef.current.offsetTop;
      } else if (contentRef.current && task?.status !== "running") {
        // No summary section and not streaming — scroll to bottom
        hasScrolledRef.current = true;
        contentRef.current.scrollTop = contentRef.current.scrollHeight;
      }
    });
  }, [isOpen, task?.output, task?.status]);

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

  const handleClose = useCallback(() => {
    setIsAnimatingOut(true);
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isAnimatingOut) {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, isAnimatingOut, handleClose]);

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
          {isLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center" style={{ background: "rgba(15, 15, 20, 0.85)", backdropFilter: "blur(2px)" }}>
              <div className="flex flex-col items-center gap-3">
                <div className="w-6 h-6 border-2 border-zinc-600 border-t-zinc-200 rounded-full animate-spin" />
                <span className="text-xs text-zinc-400">Loading output...</span>
              </div>
            </div>
          )}
          {task?.output ? (
            <>
              {(() => {
                // Try our explicit divider first (new format)
                const SUMMARY_DIVIDER = "\n\n---\n\n## Summary\n\n";
                let dividerIdx = task.output.indexOf(SUMMARY_DIVIDER);
                let dividerLen = SUMMARY_DIVIDER.length;

                // Fallback: detect "## Summary" in raw concatenated text (old format)
                if (dividerIdx === -1) {
                  const fallbackMatch = task.output.match(/(:|\.)?\s*#{1,3}\s*Summary\s*\n?/);
                  if (fallbackMatch && fallbackMatch.index !== undefined) {
                    dividerIdx = fallbackMatch.index;
                    dividerLen = fallbackMatch[0].length;
                  }
                }

                if (dividerIdx === -1) {
                  // Insert paragraph breaks between jammed statements (e.g. "...implementation:Let me")
                  const cleaned = task.output.replace(/(:)([A-Z])/g, "$1\n\n$2");
                  return <MarkdownRenderer content={cleaned} />;
                }

                // Insert paragraph breaks in the stream portion only
                const rawStream = task.output.slice(0, dividerIdx);
                const streamPart = rawStream.replace(/(:)([A-Z])/g, "$1\n\n$2");
                const summaryPart = task.output.slice(dividerIdx + dividerLen);
                return (
                  <>
                    {streamPart && <MarkdownRenderer content={streamPart} />}
                    <div ref={summaryRef} className="mt-4 pt-4 border-t border-zinc-700/50">
                      <h3 className="text-lg font-semibold text-zinc-200 mb-2">Summary</h3>
                      <MarkdownRenderer content={summaryPart} />
                    </div>
                  </>
                );
              })()}
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
              <span>Status: {isStale ? "Stale (no activity for 6 min)" : task.status}</span>
              {task.branch && <span>Branch: {task.branch}</span>}
            </div>
            <div className="flex items-center gap-3">
              {task.error && (
                <div className="flex items-center gap-1.5">
                  <AlertCircle size={14} style={{ color: "var(--pipeline-error)" }} aria-hidden="true" />
                  <span className="modal-footer-error truncate max-w-[400px]">
                    {task.error}
                  </span>
                </div>
              )}
              {(isStale || task.status === "error") && workflowId && (
                <button
                  onClick={async () => {
                    if (isRestarting) return;
                    setIsRestarting(true);
                    try {
                      await fetch(`/api/workflow/${workflowId}/retry`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ agentId: task.agentId }),
                      });
                      // Don't reset isRestarting — keep showing "Starting..." until isStale clears
                    } catch { setIsRestarting(false); }
                  }}
                  disabled={isRestarting}
                  className="px-3 py-1.5 text-xs font-medium rounded bg-amber-600/80 text-white hover:bg-amber-500 disabled:opacity-50 transition-colors"
                >
                  {isRestarting ? "Starting session..." : "Restart Agent"}
                </button>
              )}
            </div>
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
