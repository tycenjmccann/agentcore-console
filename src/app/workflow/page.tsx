"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Search, Plus, Play, Radio, ChevronLeft, ChevronRight, GripVertical } from "lucide-react";
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

  // Sidebar collapse/resize state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(320);

  const SIDEBAR_MIN = 220;
  const SIDEBAR_MAX = 480;

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

  // Check URL for pre-selected workflow — auto-collapse sidebar if workflow ID present
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (id) {
      setSelectedId(id);
      setShowIntake(false);
      setSidebarCollapsed(true);
    }
  }, []);

  // Handle resize via mouse drag
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - resizeStartX.current;
      const newWidth = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, resizeStartWidth.current + delta));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = sidebarWidth;
    setIsResizing(true);
  };

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
        setSidebarCollapsed(true);
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
    setSidebarCollapsed(true);
    window.history.pushState({}, "", `/workflow?id=${id}`);
  };

  const handleNewWorkflow = () => {
    setSelectedId(null);
    setShowIntake(true);
    setSidebarCollapsed(false);
    window.history.pushState({}, "", "/workflow");
  };

  return (
    <div className="flex h-[calc(100vh-64px)] -m-6">
      {/* Collapsed state — expand chevron */}
      {sidebarCollapsed && (
        <button
          onClick={() => setSidebarCollapsed(false)}
          className="fixed left-[64px] top-1/2 -translate-y-1/2 z-50 w-6 h-12 flex items-center justify-center bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-r-md hover:bg-[var(--color-bg-secondary)] transition-colors shadow-lg"
          title="Expand sidebar"
        >
          <ChevronRight className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
        </button>
      )}

      {/* Left Sidebar — Epic History */}
      <div
        ref={sidebarRef}
        className="border-r border-[var(--color-border)] bg-[var(--color-bg-secondary)] flex flex-col flex-shrink-0 relative overflow-hidden"
        style={{
          width: sidebarCollapsed ? 0 : sidebarWidth,
          minWidth: sidebarCollapsed ? 0 : SIDEBAR_MIN,
          maxWidth: sidebarCollapsed ? 0 : SIDEBAR_MAX,
          opacity: sidebarCollapsed ? 0 : 1,
          transition: isResizing ? "none" : "width 300ms ease, min-width 300ms ease, max-width 300ms ease, opacity 300ms ease",
        }}
      >
        {/* Header */}
        <div className="p-4 border-b border-[var(--color-border)]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Workflows</h2>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleNewWorkflow}
                className="p-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                title="New Workflow"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setSidebarCollapsed(true)}
                className="p-1.5 rounded-md hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] transition-colors"
                title="Collapse sidebar"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            </div>
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

          {filtered.length === 0 && (
            <div className="p-4 text-center text-xs text-[var(--color-text-muted)]">
              {searchQuery ? "No matching workflows" : "No workflows yet"}
            </div>
          )}
        </div>

        {/* Resize Handle */}
        <div
          onMouseDown={handleResizeStart}
          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-500/30 transition-colors z-10 flex items-center justify-center group"
        >
          <GripVertical className="w-3 h-3 text-transparent group-hover:text-[var(--color-text-muted)] transition-colors" />
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
          {/* Epic title wraps instead of truncating */}
          <p className="text-xs font-medium text-[var(--color-text-primary)] break-words leading-snug">
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
