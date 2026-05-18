"use client";

import { useEffect, useRef } from "react";
import type { AgentTask } from "@/lib/workflow/types";

interface AgentOutputPanelProps {
  task: AgentTask | null;
  isOpen: boolean;
  onClose: () => void;
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
}: AgentOutputPanelProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when output changes (streaming)
  useEffect(() => {
    if (contentRef.current && task?.output) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [task?.output]);

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  const panelClass = `agent-output-panel ${isOpen ? "open" : ""}`;

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-[99]"
          onClick={onClose}
        />
      )}

      <div className={panelClass}>
        <div className="agent-output-header">
          <span className="agent-output-title">
            {task ? formatAgentName(task.agentId) : "Agent Output"}
          </span>
          <button
            className="agent-output-close"
            onClick={onClose}
            aria-label="Close panel"
          >
            ✕
          </button>
        </div>

        <div className="agent-output-content" ref={contentRef}>
          {task?.output ? (
            task.output
          ) : task?.status === "running" ? (
            <span className="text-[var(--pipeline-text-dim)]">
              Waiting for output...
            </span>
          ) : (
            <span className="text-[var(--pipeline-text-dim)]">
              No output yet.
            </span>
          )}
        </div>

        {task && (
          <div className="px-5 py-3 border-t border-[var(--pipeline-border)] text-[11px] text-[var(--pipeline-text-dim)]">
            <div className="flex items-center justify-between">
              <span>Status: {task.status}</span>
              {task.branch && <span>Branch: {task.branch}</span>}
            </div>
            {task.error && (
              <div className="mt-2 text-[var(--pipeline-error)]">
                Error: {task.error}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
