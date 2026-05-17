"use client";

import Link from "next/link";
import { 
  ChevronRight, 
  Clock, 
  Ticket, 
  AlertCircle,
  Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { WorkflowState, AgentTask } from "@/lib/workflow/types";
import { 
  PhaseBadge, 
  TaskStatusDot, 
  timeAgo, 
  formatDuration,
} from "./WorkflowStatus";

interface WorkflowCardProps {
  workflow: WorkflowState;
  compact?: boolean;
}

export function WorkflowCard({ workflow, compact = false }: WorkflowCardProps) {
  const taskEntries = Object.entries(workflow.agentTasks);
  const completedTasks = taskEntries.filter(([, t]) => t.status === "complete").length;
  const runningTasks = taskEntries.filter(([, t]) => t.status === "running").length;
  const unreadNotifications = workflow.humanNotifications.filter(n => !n.acknowledged).length;

  if (compact) {
    return (
      <Link
        href={`/workflows/${workflow.id}`}
        className="flex items-center gap-3 p-3 bg-surface-2 border border-surface-4 rounded-lg hover:border-brand-600/40 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white truncate">
              {workflow.input.title}
            </span>
            <PhaseBadge phase={workflow.phase} size="sm" showIcon={false} />
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Ticket className="w-3 h-3" />
              {workflow.epicId}
            </span>
            <span>{timeAgo(workflow.startedAt)}</span>
          </div>
        </div>
        {runningTasks > 0 && (
          <div className="flex items-center gap-1 text-xs text-green-400">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            {runningTasks} running
          </div>
        )}
        <ChevronRight className="w-4 h-4 text-gray-600 flex-shrink-0" />
      </Link>
    );
  }

  return (
    <Link
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
            <PhaseBadge phase={workflow.phase} />
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
                    <TaskStatusDot status={task.status} size="sm" />
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
          {unreadNotifications > 0 && (
            <div className="mt-2 flex items-center gap-1 text-xs text-yellow-400">
              <AlertCircle className="w-3 h-3" />
              {unreadNotifications} unread notification{unreadNotifications !== 1 ? "s" : ""}
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
}

// Mini workflow list for dashboard
interface WorkflowMiniListProps {
  workflows: WorkflowState[];
  maxItems?: number;
}

export function WorkflowMiniList({ workflows, maxItems = 5 }: WorkflowMiniListProps) {
  const displayWorkflows = workflows
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    .slice(0, maxItems);

  if (displayWorkflows.length === 0) {
    return (
      <div className="text-center py-8">
        <Bot className="w-8 h-8 text-gray-600 mx-auto mb-2" />
        <p className="text-sm text-gray-500">No active workflows</p>
        <Link
          href="/workflows/new"
          className="text-xs text-brand-400 hover:text-brand-300 mt-1 inline-block"
        >
          Create your first workflow →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {displayWorkflows.map((workflow) => (
        <WorkflowCard key={workflow.id} workflow={workflow} compact />
      ))}
      {workflows.length > maxItems && (
        <Link
          href="/workflows"
          className="block text-center text-xs text-brand-400 hover:text-brand-300 pt-2"
        >
          View all {workflows.length} workflows →
        </Link>
      )}
    </div>
  );
}
