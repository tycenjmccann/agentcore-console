"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  History,
  ChevronLeft,
  ChevronRight,
  Search,
  Plus,
  Radio,
  Clock,
  Inbox,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { formatTimestamp } from "@/lib/utils";

// ─── Constants ──────────────────────────────────────────────────────────────

const MIN_WIDTH = 200;
const MAX_WIDTH = 400;
const DEFAULT_WIDTH = 288; // ~w-72
const COLLAPSED_WIDTH = 48;
const TRANSITION_DURATION = 250; // ms

const LS_KEY_COLLAPSED = "console_sidebar_collapsed";
const LS_KEY_WIDTH = "console_sidebar_width";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface WorkflowEntry {
  id: string;
  phase: string;
  epicId: string;
  title: string;
  startedAt: string;
  completedAt?: string;
}

interface HistorySidebarProps {
  workflows: WorkflowEntry[];
  selectedId: string | null;
  onSelectWorkflow: (id: string) => void;
  onNewWorkflow: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function HistorySidebar({
  workflows,
  selectedId,
  onSelectWorkflow,
  onNewWorkflow,
  searchQuery,
  onSearchChange,
}: HistorySidebarProps) {
  const [isCollapsed, setIsCollapsed] = useLocalStorage<boolean>(
    LS_KEY_COLLAPSED,
    false
  );
  const [sidebarWidth, setSidebarWidth] = useLocalStorage<number>(
    LS_KEY_WIDTH,
    DEFAULT_WIDTH
  );

  const [isResizing, setIsResizing] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const resizeHandleRef = useRef<HTMLDivElement>(null);

  // ─── Resize Logic ───────────────────────────────────────────────────────

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (isCollapsed) return;
      e.preventDefault();
      setIsResizing(true);
    },
    [isCollapsed]
  );

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, e.clientX));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  // ─── Collapse/Expand ────────────────────────────────────────────────────

  const toggleCollapse = useCallback(() => {
    setIsTransitioning(true);
    setIsCollapsed((prev) => !prev);
    setTimeout(() => setIsTransitioning(false), TRANSITION_DURATION);
  }, [setIsCollapsed]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleCollapse();
      }
    },
    [toggleCollapse]
  );

  // ─── Derived Data ───────────────────────────────────────────────────────

  const activeWorkflows = workflows.filter(
    (w) => w.phase !== "complete" && w.phase !== "error"
  );
  const pastWorkflows = workflows.filter(
    (w) => w.phase === "complete" || w.phase === "error"
  );

  const currentWidth = isCollapsed ? COLLAPSED_WIDTH : sidebarWidth;

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div
      ref={sidebarRef}
      className={cn(
        "relative flex flex-col flex-shrink-0 border-r border-[var(--color-border)] bg-[var(--color-bg-secondary,var(--color-surface-1))]",
        isTransitioning && "transition-[width] duration-[250ms] ease-in-out"
      )}
      style={{ width: currentWidth }}
      role="complementary"
      aria-label="Workflow history sidebar"
    >
      {/* Collapsed Icon Strip */}
      {isCollapsed ? (
        <div className="flex flex-col items-center pt-4 gap-3 h-full">
          <button
            onClick={toggleCollapse}
            onKeyDown={handleKeyDown}
            className="p-2 rounded-lg hover:bg-[var(--color-surface-3)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            aria-label="Expand sidebar"
            aria-expanded="false"
            title="Expand sidebar"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <div className="p-2 text-[var(--color-text-muted)]">
            <History className="w-4 h-4" />
          </div>
          <button
            onClick={onNewWorkflow}
            className="p-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors"
            aria-label="New workflow"
            title="New workflow"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="p-4 border-b border-[var(--color-border)]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-[var(--color-text-muted)]" />
                <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Workflows
                </h2>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={onNewWorkflow}
                  className="p-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                  title="New Workflow"
                  aria-label="Start new workflow"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={toggleCollapse}
                  onKeyDown={handleKeyDown}
                  className="p-1.5 rounded-md hover:bg-[var(--color-surface-3)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                  aria-label="Collapse sidebar"
                  aria-expanded="true"
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
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search workflows..."
                className="w-full pl-8 pr-3 py-1.5 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-md text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-blue-500"
                aria-label="Search workflow history"
              />
            </div>
          </div>

          {/* Workflow List */}
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {/* Active Runs */}
            {activeWorkflows.length > 0 && (
              <div className="p-2">
                <p className="px-2 py-1 text-[10px] font-semibold text-green-400 uppercase tracking-wider">
                  Active
                </p>
                {activeWorkflows.map((w) => (
                  <SidebarItem
                    key={w.id}
                    workflow={w}
                    isSelected={selectedId === w.id}
                    isActive
                    onClick={() => onSelectWorkflow(w.id)}
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
                  <SidebarItem
                    key={w.id}
                    workflow={w}
                    isSelected={selectedId === w.id}
                    onClick={() => onSelectWorkflow(w.id)}
                  />
                ))}
              </div>
            )}

            {/* Empty State */}
            {workflows.length === 0 && (
              <EmptyState hasSearch={!!searchQuery} />
            )}

            {/* No results for search */}
            {workflows.length > 0 &&
              activeWorkflows.length === 0 &&
              pastWorkflows.length === 0 && (
                <div className="p-4 text-center text-xs text-[var(--color-text-muted)]">
                  No matching workflows
                </div>
              )}
          </div>
        </>
      )}

      {/* Resize Handle */}
      {!isCollapsed && (
        <div
          ref={resizeHandleRef}
          onMouseDown={handleMouseDown}
          className={cn(
            "absolute top-0 right-0 w-1 h-full cursor-col-resize z-10",
            "hover:bg-blue-500/40 active:bg-blue-500/60",
            "transition-colors duration-150",
            isResizing && "bg-blue-500/60"
          )}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          aria-valuenow={sidebarWidth}
          aria-valuemin={MIN_WIDTH}
          aria-valuemax={MAX_WIDTH}
        />
      )}
    </div>
  );
}

// ─── Sidebar Item ─────────────────────────────────────────────────────────────

function SidebarItem({
  workflow,
  isSelected,
  isActive,
  onClick,
}: {
  workflow: WorkflowEntry;
  isSelected: boolean;
  isActive?: boolean;
  onClick: () => void;
}) {
  const isRunning = workflow.phase !== "complete" && workflow.phase !== "error";
  const timeStr = formatTimestamp(workflow.startedAt);

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-3 py-2.5 rounded-lg mb-1 transition-all",
        isSelected
          ? "bg-blue-600/15 border border-blue-500/30"
          : "hover:bg-[var(--color-surface-3)] border border-transparent"
      )}
      aria-label={`${workflow.title} - ${timeStr}`}
      aria-current={isSelected ? "true" : undefined}
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
            {workflow.title}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-blue-400 font-mono">
              {workflow.epicId}
            </span>
            <span className="text-[10px] text-[var(--color-text-muted)] flex items-center gap-0.5">
              <Clock className="w-2.5 h-2.5" />
              {timeStr}
            </span>
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

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ hasSearch }: { hasSearch: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center p-6 text-center">
      <div className="w-12 h-12 rounded-full bg-[var(--color-surface-3)] flex items-center justify-center mb-3">
        <Inbox className="w-5 h-5 text-[var(--color-text-muted)]" />
      </div>
      <p className="text-xs font-medium text-[var(--color-text-primary)] mb-1">
        {hasSearch ? "No matching workflows" : "No workflows yet"}
      </p>
      <p className="text-[10px] text-[var(--color-text-muted)]">
        {hasSearch
          ? "Try adjusting your search terms"
          : "Start a new workflow to see it appear here"}
      </p>
    </div>
  );
}
