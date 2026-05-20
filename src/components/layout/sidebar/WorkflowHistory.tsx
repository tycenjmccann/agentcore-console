"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTimestamp } from "@/lib/utils";
import { useWorkflowHistory, WorkflowFilter } from "@/hooks/useWorkflowHistory";

interface WorkflowHistoryProps {
  collapsed: boolean;
}

const FILTER_OPTIONS: { label: string; value: WorkflowFilter }[] = [
  { label: "All", value: "all" },
  { label: "Running", value: "running" },
  { label: "Completed", value: "completed" },
  { label: "Failed", value: "failed" },
];

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case "running":
      return "bg-green-400/20 text-green-400";
    case "completed":
      return "bg-brand-400/20 text-brand-400";
    case "failed":
      return "bg-red-400/20 text-red-400";
    default:
      return "bg-surface-4 text-[var(--color-text-muted)]";
  }
}

export default function WorkflowHistory({ collapsed }: WorkflowHistoryProps) {
  const {
    filteredWorkflows,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    activeFilter,
    setActiveFilter,
  } = useWorkflowHistory();

  // Don't render in collapsed mode
  if (collapsed) return null;

  return (
    <div className="px-4 py-3 border-t border-surface-4 flex flex-col min-h-0">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
        Recent Workflows
      </h3>

      {/* Search input */}
      <div className="relative mb-2">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--color-text-muted)]" />
        <input
          type="text"
          placeholder="Search workflows..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-7 pr-2 py-1.5 text-xs bg-surface-2 border border-surface-4 rounded-md text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-brand-600/50 transition-colors"
          aria-label="Search workflows"
        />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-2 flex-wrap">
        {FILTER_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => setActiveFilter(option.value)}
            className={cn(
              "px-2 py-0.5 text-[10px] font-medium rounded-full transition-colors",
              activeFilter === option.value
                ? "bg-brand-600/20 text-brand-400 border border-brand-600/30"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-surface-3"
            )}
            aria-label={`Filter by ${option.label}`}
            aria-pressed={activeFilter === option.value}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* Workflow list */}
      <div className="flex-1 overflow-y-auto scrollbar-thin space-y-1 max-h-48">
        {loading && (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-3 bg-surface-4 rounded w-3/4 mb-1" />
                <div className="h-2 bg-surface-4 rounded w-1/2" />
              </div>
            ))}
          </div>
        )}

        {error && !loading && (
          <p className="text-xs text-[var(--color-text-muted)] italic">
            Unable to load workflows
          </p>
        )}

        {!loading && !error && filteredWorkflows.length === 0 && (
          <p className="text-xs text-[var(--color-text-muted)] italic">
            No workflows found
          </p>
        )}

        {!loading && !error && filteredWorkflows.map((workflow) => (
          <Link
            key={workflow.id}
            href={`/workflow/${workflow.id}`}
            className="block p-2 rounded-lg hover:bg-surface-3 transition-colors group"
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs font-medium text-[var(--color-text-primary)] truncate flex-1 group-hover:text-brand-400 transition-colors">
                {workflow.name || workflow.id}
              </span>
              <span
                className={cn(
                  "text-[9px] font-medium px-1.5 py-0.5 rounded-full shrink-0",
                  getStatusBadgeClass(workflow.status)
                )}
              >
                {workflow.status}
              </span>
            </div>
            <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
              {workflow.createdAt ? formatTimestamp(workflow.createdAt) : ""}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
