"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Plus, Play, Radio, Zap } from "lucide-react";
import WorkflowBoard from "@/components/workflow/WorkflowBoard";
import IntakeForm from "@/components/workflow/IntakeForm";
import type { WorkflowState, WorkflowInput } from "@/lib/workflow/types";

interface WorkflowSummary {
  id: string;
  phase: string;
  epicId: string;
  input: { title: string; description: string };
  startedAt: string;
  completedAt?: string;
}

export default function WorkflowPage() {
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showIntake, setShowIntake] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nudgeToast, setNudgeToast] = useState<{ message: string; type: "success" | "info" | "error" } | null>(null);

  // Load workflow list
  const fetchWorkflows = useCallback(async () => {
    try {
      const res = await fetch("/api/workflow/list");
      if (!res.ok) return;
      const data = await res.json();
      const list: WorkflowSummary[] = (data.workflows || []).map((w: WorkflowState) => ({
        id: w.id,
        phase: w.phase,
        epicId: w.epicId,
        input: { title: w.input.title, description: w.input.description },
        startedAt: w.startedAt,
        completedAt: w.completedAt,
      }));
      // Sort: active first, then by date descending
      list.sort((a, b) => {
        const aActive = a.phase !== "complete" && a.phase !== "error";
        const bActive = b.phase !== "complete" && b.phase !== "error";
        if (aActive && !bActive) return -1;
        if (!aActive && bActive) return 1;
        return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
      });
      setWorkflows(list);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchWorkflows();
    const interval = setInterval(fetchWorkflows, 5000);
    return () => clearInterval(interval);
  }, [fetchWorkflows]);

  // Check URL for pre-selected workflow
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (id) {
      setSelectedId(id);
      setShowIntake(false);
    }
  }, []);

  // Handle new workflow submission
  const handleSubmit = async (input: WorkflowInput) => {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/workflow/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error("Failed to start workflow");
      const data = await res.json();
      const newId = data.workflowId || data.id;
      if (newId) {
        setSelectedId(newId);
        setShowIntake(false);
        // Update URL without reload
        window.history.pushState({}, "", `/workflow?id=${newId}`);
        // Refresh list
        setTimeout(fetchWorkflows, 1000);
      }
    } catch (err) {
      console.error("Failed to start workflow:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter workflows by search
  const filtered = workflows.filter((w) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      w.input.title.toLowerCase().includes(q) ||
      w.epicId.toLowerCase().includes(q) ||
      w.id.toLowerCase().includes(q)
    );
  });

  const activeWorkflows = filtered.filter((w) => w.phase !== "complete" && w.phase !== "error");
  const pastWorkflows = filtered.filter((w) => w.phase === "complete" || w.phase === "error");

  const handleSelectWorkflow = (id: string) => {
    setSelectedId(id);
    setShowIntake(false);
    window.history.pushState({}, "", `/workflow?id=${id}`);
  };

  const handleNewWorkflow = () => {
    setSelectedId(null);
    setShowIntake(true);
    window.history.pushState({}, "", "/workflow");
  };

  const handleNudge = async (id: string) => {
    try {
      const res = await fetch(`/api/workflow/${id}/nudge`, { method: "POST" });
      const data = await res.json();
      if (data.nudged?.length > 0) {
        setNudgeToast({ message: `Fixed ${data.nudged.length} stuck ticket(s)`, type: "success" });
      } else {
        setNudgeToast({ message: "All tickets healthy — nothing to fix", type: "info" });
      }
    } catch {
      setNudgeToast({ message: "Nudge failed — check connection", type: "error" });
    }
    setTimeout(() => setNudgeToast(null), 4000);
  };

  return (
    <div className="flex h-[calc(100vh-64px)] -m-6">
      {/* Left Sidebar — Epic History */}
      <div className="w-72 border-r border-[var(--color-border)] bg-[var(--color-bg-secondary)] flex flex-col flex-shrink-0">
        {/* Header */}
        <div className="p-4 border-b border-[var(--color-border)]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Workflows</h2>
            <button
              onClick={handleNewWorkflow}
              className="p-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white transition-colors"
              title="New Workflow"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search epics..."
              className="w-full pl-8 pr-3 py-1.5 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-md text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Workflow List */}
        <div className="flex-1 overflow-y-auto">
          {/* Active Runs */}
          {activeWorkflows.length > 0 && (
            <div className="p-2">
              <p className="px-2 py-1 text-[10px] font-semibold text-green-400 uppercase tracking-wider">
                Active
              </p>
              {activeWorkflows.map((w) => (
                <WorkflowListItem
                  key={w.id}
                  workflow={w}
                  isSelected={selectedId === w.id}
                  isActive
                  onClick={() => handleSelectWorkflow(w.id)}
                  onNudge={handleNudge}
                />
              ))}
            </div>
          )}

          {/* Past Runs */}
          {pastWorkflows.length > 0 && (
            <div className="p-2">
              <p className="px-2 py-1 text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                Completed
              </p>
              {pastWorkflows.map((w) => (
                <WorkflowListItem
                  key={w.id}
                  workflow={w}
                  isSelected={selectedId === w.id}
                  onClick={() => handleSelectWorkflow(w.id)}
                />
              ))}
            </div>
          )}

          {filtered.length === 0 && (
            <div className="p-4 text-center text-xs text-[var(--color-text-muted)]">
              {searchQuery ? "No matching workflows" : "No workflows yet"}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {showIntake ? (
          <div className="p-8">
            <IntakeForm onSubmit={handleSubmit} isLoading={isSubmitting} />
          </div>
        ) : selectedId ? (
          <WorkflowBoard key={selectedId} workflowId={selectedId} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="w-16 h-16 rounded-full bg-blue-600/10 flex items-center justify-center mb-4">
              <Play className="w-7 h-7 text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
              Select a workflow or start a new one
            </h3>
            <p className="text-sm text-[var(--color-text-muted)] max-w-md mb-4">
              Choose a past run from the sidebar to view its pipeline state, or create a new workflow to watch agents work in real-time.
            </p>
            <button
              onClick={handleNewWorkflow}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-500 transition-colors"
            >
              New Workflow
            </button>
          </div>
        )}
      </div>

      {/* Nudge Toast — positioned in the sidebar near the nudge buttons */}
      {nudgeToast && (
        <div className={`absolute left-4 bottom-4 px-3 py-2 rounded-lg shadow-lg text-xs font-medium z-50 max-w-[260px] ${
          nudgeToast.type === "success" ? "bg-green-600 text-white" :
          nudgeToast.type === "error" ? "bg-red-600 text-white" :
          "bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] border border-[var(--color-border)]"
        }`}>
          {nudgeToast.type === "success" && "⚡ "}
          {nudgeToast.message}
        </div>
      )}
    </div>
  );
}

// ─── Sidebar List Item ──────────────────────────────────────────────────────

function WorkflowListItem({
  workflow,
  isSelected,
  isActive,
  onClick,
  onNudge,
}: {
  workflow: WorkflowSummary;
  isSelected: boolean;
  isActive?: boolean;
  onClick: () => void;
  onNudge?: (id: string) => void;
}) {
  const isRunning = workflow.phase !== "complete" && workflow.phase !== "error";
  const timeStr = formatRelativeTime(workflow.startedAt);

  return (
    <div
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 rounded-lg mb-1 transition-all cursor-pointer ${
        isSelected
          ? "bg-blue-600/15 border border-blue-500/30"
          : "hover:bg-[var(--color-bg-tertiary)] border border-transparent"
      }`}
    >
      <div className="flex items-start gap-2">
        {/* Status indicator */}
        <div className="mt-1 flex-shrink-0">
          {isRunning ? (
            <div className="relative">
              <Radio className="w-3.5 h-3.5 text-green-400" />
              <div className="absolute inset-0 animate-ping">
                <Radio className="w-3.5 h-3.5 text-green-400 opacity-30" />
              </div>
            </div>
          ) : workflow.phase === "error" ? (
            <div className="w-2 h-2 rounded-full bg-red-500 mt-0.5" />
          ) : (
            <div className="w-2 h-2 rounded-full bg-green-500/60 mt-0.5" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-[var(--color-text-primary)] truncate">
            {workflow.input.title}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-blue-400 font-mono">{workflow.epicId}</span>
            <span className="text-[10px] text-[var(--color-text-muted)]">{timeStr}</span>
          </div>
          {isRunning && (
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20 font-medium uppercase tracking-wider">
                {workflow.phase}
              </span>
              {onNudge && (
                <button
                  onClick={(e) => { e.stopPropagation(); onNudge(workflow.id); }}
                  className="p-0.5 rounded hover:bg-amber-500/20 text-[var(--color-text-muted)] hover:text-amber-400 transition-colors"
                  title="Nudge — unstick any stuck tickets"
                >
                  <Zap className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatRelativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diff = now - then;

  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return new Date(isoString).toLocaleDateString();
}
