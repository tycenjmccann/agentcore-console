"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  GitBranch,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  Layers,
  FileCode,
  Users,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { WorkflowState, WorkflowPhase } from "@/lib/workflow/types";

interface WorkflowListItem extends WorkflowState {
  taskCount: number;
  completedTasks: number;
}

function getPhaseColor(phase: WorkflowPhase): string {
  switch (phase) {
    case "intake":
      return "text-blue-400 bg-blue-400/10 border-blue-400/30";
    case "requirements":
      return "text-purple-400 bg-purple-400/10 border-purple-400/30";
    case "design":
      return "text-cyan-400 bg-cyan-400/10 border-cyan-400/30";
    case "development":
      return "text-green-400 bg-green-400/10 border-green-400/30";
    case "review":
      return "text-yellow-400 bg-yellow-400/10 border-yellow-400/30";
    case "complete":
      return "text-green-400 bg-green-400/10 border-green-400/30";
    case "error":
      return "text-red-400 bg-red-400/10 border-red-400/30";
    default:
      return "text-gray-400 bg-gray-400/10 border-gray-400/30";
  }
}

function getPhaseIcon(phase: WorkflowPhase) {
  switch (phase) {
    case "intake":
      return FileCode;
    case "requirements":
      return Layers;
    case "design":
      return GitBranch;
    case "development":
      return FileCode;
    case "review":
      return Users;
    case "complete":
      return CheckCircle2;
    case "error":
      return AlertCircle;
    default:
      return Clock;
  }
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<WorkflowListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<WorkflowPhase | "all">("all");

  useEffect(() => {
    fetchWorkflows();
  }, []);

  async function fetchWorkflows() {
    try {
      const res = await fetch("/api/workflow");
      const data = await res.json();
      const workflowsWithCounts = (data.workflows || []).map((w: WorkflowState) => {
        const tasks = Object.values(w.agentTasks);
        return {
          ...w,
          taskCount: tasks.length,
          completedTasks: tasks.filter((t) => t.status === "complete").length,
        };
      });
      setWorkflows(workflowsWithCounts);
    } catch (error) {
      console.error("Failed to fetch workflows:", error);
    } finally {
      setLoading(false);
    }
  }

  const filteredWorkflows =
    filter === "all" ? workflows : workflows.filter((w) => w.phase === filter);

  const stats = {
    total: workflows.length,
    active: workflows.filter((w) => !["complete", "error"].includes(w.phase)).length,
    complete: workflows.filter((w) => w.phase === "complete").length,
    error: workflows.filter((w) => w.phase === "error").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Workflows</h1>
          <p className="text-gray-400 mt-1">
            Manage agentic workflows from intake to deployment
          </p>
        </div>
        <Link
          href="/workflow/new"
          className="btn-primary flex items-center gap-2 px-4 py-2"
        >
          <Plus className="w-4 h-4" />
          New Workflow
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-brand-600/20 flex items-center justify-center">
              <GitBranch className="w-5 h-5 text-brand-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.total}</p>
              <p className="text-xs text-gray-500">Total Workflows</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.active}</p>
              <p className="text-xs text-gray-500">Active</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-600/20 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.complete}</p>
              <p className="text-xs text-gray-500">Complete</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-600/20 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.error}</p>
              <p className="text-xs text-gray-500">Errors</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {["all", "intake", "requirements", "design", "development", "review", "complete", "error"].map(
          (phase) => (
            <button
              key={phase}
              onClick={() => setFilter(phase as WorkflowPhase | "all")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap",
                filter === phase
                  ? "bg-brand-600/20 text-brand-400 border border-brand-600/30"
                  : "bg-surface-2 text-gray-400 border border-surface-4 hover:border-gray-600"
              )}
            >
              {phase.charAt(0).toUpperCase() + phase.slice(1)}
            </button>
          )
        )}
      </div>

      {/* Workflows List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 text-brand-400 animate-spin" />
        </div>
      ) : filteredWorkflows.length === 0 ? (
        <div className="card text-center py-12">
          <GitBranch className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">
            {filter === "all"
              ? "No workflows yet. Create your first workflow to get started."
              : `No workflows in ${filter} phase.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredWorkflows.map((workflow) => {
            const PhaseIcon = getPhaseIcon(workflow.phase);
            const progress =
              workflow.taskCount > 0
                ? (workflow.completedTasks / workflow.taskCount) * 100
                : 0;

            return (
              <Link
                key={workflow.id}
                href={`/workflow/${workflow.id}`}
                className="card hover:border-brand-600/30 transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center",
                      workflow.phase === "error"
                        ? "bg-red-600/20"
                        : workflow.phase === "complete"
                        ? "bg-green-600/20"
                        : "bg-brand-600/20"
                    )}
                  >
                    <PhaseIcon
                      className={cn(
                        "w-6 h-6",
                        workflow.phase === "error"
                          ? "text-red-400"
                          : workflow.phase === "complete"
                          ? "text-green-400"
                          : "text-brand-400"
                      )}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-white font-semibold truncate">
                        {workflow.input.title}
                      </h3>
                      <span
                        className={cn(
                          "text-xs px-2 py-0.5 rounded-full border font-medium",
                          getPhaseColor(workflow.phase)
                        )}
                      >
                        {workflow.phase}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {timeAgo(workflow.startedAt)}
                      </span>
                      <span>Epic: {workflow.epicId}</span>
                      {workflow.taskCount > 0 && (
                        <span>
                          {workflow.completedTasks}/{workflow.taskCount} tasks complete
                        </span>
                      )}
                    </div>

                    {workflow.taskCount > 0 && (
                      <div className="mt-2">
                        <div className="h-1.5 bg-surface-3 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-brand-500 rounded-full transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <ArrowRight className="w-5 h-5 text-gray-600 group-hover:text-brand-400 transition-colors" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
