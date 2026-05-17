"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Play,
  Pause,
  CheckCircle2,
  AlertCircle,
  Clock,
  Bot,
  GitBranch,
  Ticket,
  MessageSquare,
  ChevronRight,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getClientRegion } from "@/lib/client-cache";
import type {
  WorkflowState,
  WorkflowPhase,
  AgentTaskStatus,
} from "@/lib/workflow/types";

// Phase configuration for display
const phaseConfig: Record<WorkflowPhase, { label: string; color: string; icon: typeof Play }> = {
  intake: { label: "Intake", color: "text-blue-400", icon: Clock },
  requirements: { label: "Requirements", color: "text-purple-400", icon: MessageSquare },
  design: { label: "Design", color: "text-cyan-400", icon: GitBranch },
  development: { label: "Development", color: "text-green-400", icon: Bot },
  review: { label: "Review", color: "text-yellow-400", icon: CheckCircle2 },
  complete: { label: "Complete", color: "text-emerald-400", icon: CheckCircle2 },
  error: { label: "Error", color: "text-red-400", icon: AlertCircle },
};

// Status badge component
function StatusBadge({ phase }: { phase: WorkflowPhase }) {
  const config = phaseConfig[phase];
  const Icon = config.icon;
  
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
      phase === "complete" && "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
      phase === "error" && "bg-red-500/10 text-red-400 border-red-500/30",
      phase === "development" && "bg-green-500/10 text-green-400 border-green-500/30",
      phase === "design" && "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
      phase === "requirements" && "bg-purple-500/10 text-purple-400 border-purple-500/30",
      phase === "intake" && "bg-blue-500/10 text-blue-400 border-blue-500/30",
      phase === "review" && "bg-yellow-500/10 text-yellow-400 border-yellow-500/30"
    )}>
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}

// Task status indicator
function TaskStatusIndicator({ status }: { status: AgentTaskStatus }) {
  switch (status) {
    case "running":
      return <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />;
    case "waiting_response":
      return <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />;
    case "complete":
      return <div className="w-2 h-2 rounded-full bg-emerald-400" />;
    case "error":
      return <div className="w-2 h-2 rounded-full bg-red-400" />;
    default:
      return <div className="w-2 h-2 rounded-full bg-gray-600" />;
  }
}

// Time ago helper
function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// Duration formatter
function formatDuration(startedAt: string, completedAt?: string): string {
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const seconds = Math.floor((end - start) / 1000);
  
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<WorkflowState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPhase, setFilterPhase] = useState<WorkflowPhase | "all">("all");

  const fetchWorkflows = useCallback(async () => {
    try {
      const region = getClientRegion();
      const res = await fetch("/api/workflows", {
        headers: { "x-aws-region": region },
      });
      
      if (!res.ok) {
        throw new Error("Failed to fetch workflows");
      }
      
      const data = await res.json();
      setWorkflows(data.workflows || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkflows();
    
    // Poll for updates every 5 seconds for active workflows
    const interval = setInterval(fetchWorkflows, 5000);
    return () => clearInterval(interval);
  }, [fetchWorkflows]);

  // Filter workflows
  const filteredWorkflows = workflows.filter((wf) => {
    const matchesSearch = 
      wf.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      wf.input.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      wf.epicId.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesPhase = filterPhase === "all" || wf.phase === filterPhase;
    
    return matchesSearch && matchesPhase;
  });

  // Count active tasks across all workflows
  const activeTaskCount = workflows.reduce((count, wf) => {
    return count + Object.values(wf.agentTasks).filter(t => t.status === "running").length;
  }, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Workflows</h1>
          <p className="text-sm text-gray-500 mt-1">
            {workflows.length} workflow{workflows.length !== 1 ? "s" : ""} 
            {activeTaskCount > 0 && (
              <span className="ml-2 text-green-400">• {activeTaskCount} active task{activeTaskCount !== 1 ? "s" : ""}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchWorkflows()}
            className="btn-secondary flex items-center gap-2"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            Refresh
          </button>
          <Link
            href="/workflows/new"
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Workflow
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search workflows..."
            className="w-full bg-surface-2 border border-surface-4 rounded-lg pl-10 pr-4 py-2.5 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-brand-500/50"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <select
            value={filterPhase}
            onChange={(e) => setFilterPhase(e.target.value as WorkflowPhase | "all")}
            className="bg-surface-2 border border-surface-4 rounded-lg px-3 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-brand-500/50"
          >
            <option value="all">All Phases</option>
            <option value="intake">Intake</option>
            <option value="requirements">Requirements</option>
            <option value="design">Design</option>
            <option value="development">Development</option>
            <option value="review">Review</option>
            <option value="complete">Complete</option>
            <option value="error">Error</option>
          </select>
        </div>
      </div>

      {/* Content */}
      {loading && workflows.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 text-brand-400 animate-spin" />
          <span className="ml-2 text-sm text-gray-500">Loading workflows...</span>
        </div>
      ) : error ? (
        <div className="card border-red-500/20 text-center py-12">
          <AlertCircle className="w-10 h-10 text-red-400/60 mx-auto mb-3" />
          <p className="text-sm text-red-400">Failed to load workflows</p>
          <p className="text-xs text-gray-500 mt-2">{error}</p>
          <button
            onClick={fetchWorkflows}
            className="mt-4 btn-secondary text-sm"
          >
            Retry
          </button>
        </div>
      ) : filteredWorkflows.length === 0 ? (
        <div className="card text-center py-12">
          <GitBranch className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-400">
            {searchQuery || filterPhase !== "all" 
              ? "No workflows match your filters." 
              : "No workflows found."}
          </p>
          <p className="text-xs text-gray-600 mt-1">
            Create a new workflow to get started.
          </p>
          <Link
            href="/workflows/new"
            className="mt-4 btn-primary inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Workflow
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredWorkflows.map((workflow) => {
            const taskEntries = Object.entries(workflow.agentTasks);
            const completedTasks = taskEntries.filter(([, t]) => t.status === "complete").length;
            const runningTasks = taskEntries.filter(([, t]) => t.status === "running").length;
            
            return (
              <Link
                key={workflow.id}
                href={`/workflows/${workflow.id}`}
                className="card hover:border-brand-600/40 transition-colors block"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    {/* Title row */}
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-base font-semibold text-white truncate">
                        {workflow.input.title}
                      </h3>
                      <StatusBadge phase={workflow.phase} />
                    </div>

                    {/* Meta row */}
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="font-mono">{workflow.id}</span>
                      <span className="flex items-center gap-1">
                        <Ticket className="w-3 h-3" />
                        {workflow.epicId}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {timeAgo(workflow.startedAt)}
                      </span>
                      {workflow.completedAt ? (
                        <span className="text-emerald-400">
                          Duration: {formatDuration(workflow.startedAt, workflow.completedAt)}
                        </span>
                      ) : (
                        <span className="text-gray-400">
                          Running: {formatDuration(workflow.startedAt)}
                        </span>
                      )}
                    </div>

                    {/* Task progress */}
                    {taskEntries.length > 0 && (
                      <div className="mt-3 flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          {taskEntries.slice(0, 6).map(([agentId, task]) => (
                            <div
                              key={agentId}
                              className="flex items-center gap-1 px-2 py-1 bg-surface-3 rounded text-xs"
                              title={`${agentId}: ${task.status}`}
                            >
                              <TaskStatusIndicator status={task.status} />
                              <span className="text-gray-400 max-w-[80px] truncate">
                                {agentId.replace("team-", "")}
                              </span>
                            </div>
                          ))}
                          {taskEntries.length > 6 && (
                            <span className="text-xs text-gray-500">
                              +{taskEntries.length - 6} more
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-500">
                          {completedTasks}/{taskEntries.length} complete
                          {runningTasks > 0 && (
                            <span className="text-green-400 ml-1">
                              ({runningTasks} running)
                            </span>
                          )}
                        </span>
                      </div>
                    )}

                    {/* Notifications count */}
                    {workflow.humanNotifications.filter(n => !n.acknowledged).length > 0 && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-yellow-400">
                        <AlertCircle className="w-3 h-3" />
                        {workflow.humanNotifications.filter(n => !n.acknowledged).length} unread notification{workflow.humanNotifications.filter(n => !n.acknowledged).length !== 1 ? "s" : ""}
                      </div>
                    )}

                    {/* Error message */}
                    {workflow.error && (
                      <div className="mt-2 text-xs text-red-400 bg-red-500/10 px-2 py-1 rounded">
                        {workflow.error}
                      </div>
                    )}
                  </div>

                  <ChevronRight className="w-5 h-5 text-gray-600 flex-shrink-0 mt-1" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
