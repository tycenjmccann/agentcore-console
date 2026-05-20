"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Plus, Play, Radio, Workflow, GitBranch } from "lucide-react";
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

          {/* Sidebar Empty State */}
          {filtered.length === 0 && (
            <div className="p-4 flex flex-col items-center text-center">
              {searchQuery ? (
                /* Search active but no results */
                <div className="py-4">
                  <Search className="w-8 h-8 text-[var(--color-text-muted)] mx-auto mb-2 opacity-50" />
                  <p className="text-xs text-[var(--color-text-muted)]">
                    No workflows matching &ldquo;{searchQuery}&rdquo;
                  </p>
                </div>
              ) : (
                /* No workflows exist — product-contextual empty state */
                <div className="py-6 px-2">
                  <div className="w-12 h-12 rounded-full bg-blue-600/10 flex items-center justify-center mx-auto mb-3">
                    <Workflow className="w-6 h-6 text-blue-400" />
                  </div>
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1.5">
                    Autonomous Development Pipeline
                  </h3>
                  <p className="text-[11px] leading-relaxed text-[var(--color-text-muted)] mb-4">
                    Submit a feature request and watch 13 AI agents deliver requirements, design, code, and QA — autonomously.
                  </p>
                  <button
                    onClick={handleNewWorkflow}
                    className="w-full px-3 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-500 transition-colors"
                  >
                    New Workflow
                  </button>
                </div>
              )}
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
          <WorkflowBoard workflowId={selectedId} />
        ) : (
          /* Main Area Empty State — No Workflow Selected */
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="w-16 h-16 rounded-full bg-blue-600/10 flex items-center justify-center mb-4">
              <GitBranch className="w-7 h-7 text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
              Select a workflow to view its pipeline
            </h3>
            <p className="text-sm text-[var(--color-text-muted)] max-w-md mb-6">
              Watch agents work through requirements, design, development, and QA in real-time
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
    </div>
  );
}

// ─── Sidebar List Item ──────────────────────────────────────────────────────

function WorkflowListItem({
  workflow,
  isSelected,
  isActive,
  onClick,
}: {
  workflow: WorkflowSummary;
  isSelected: boolean;
  isActive?: boolean;
  onClick: () => void;
}) {
  const isRunning = workflow.phase !== "complete" && workflow.phase !== "error";
  const timeStr = formatRelativeTime(workflow.startedAt);

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 rounded-lg mb-1 transition-all ${
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
            <span className="inline-block mt-1 text-[9px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20 font-medium uppercase tracking-wider">
              {workflow.phase}
            </span>
          )}
        </div>
      </div>
    </button>
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
