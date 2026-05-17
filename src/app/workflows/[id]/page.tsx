"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, GitBranch, Clock, CheckCircle2, AlertCircle,
  Loader2, Users, MessageSquare, Bell, ExternalLink, Layers
} from "lucide-react";
import { WorkflowState, AgentTask, AgentTaskStatus } from "@/lib/workflow/types";

function getStatusColor(status: AgentTaskStatus): string {
  switch (status) {
    case "complete": return "text-green-400 bg-green-400/10 border-green-400/30";
    case "error": return "text-red-400 bg-red-400/10 border-red-400/30";
    case "running": return "text-yellow-400 bg-yellow-400/10 border-yellow-400/30";
    case "waiting_response": return "text-blue-400 bg-blue-400/10 border-blue-400/30";
    default: return "text-gray-400 bg-gray-400/10 border-gray-400/30";
  }
}

function formatDuration(startedAt?: string, completedAt?: string): string {
  if (!startedAt) return "—";
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const seconds = Math.floor((end - start) / 1000);
  
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours < 24) return `${hours}h ${mins}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

export default function WorkflowDetailPage() {
  const params = useParams();
  const workflowId = params.id as string;
  const [workflow, setWorkflow] = useState<WorkflowState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workflowId) return;
    
    fetch(`/api/workflows?id=${workflowId}`)
      .then(res => res.json())
      .then(data => {
        setWorkflow(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [workflowId]);

  if (loading) {
    return (
      <div className="py-12 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-brand-400" />
        <p className="text-gray-500">Loading workflow...</p>
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="py-12 text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <p className="text-gray-400">Workflow not found</p>
        <Link href="/workflows" className="text-brand-400 hover:text-brand-300 mt-2 inline-block">
          ← Back to workflows
        </Link>
      </div>
    );
  }

  const agentTasks = Object.values(workflow.agentTasks);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link href="/workflows" className="text-sm text-gray-400 hover:text-white flex items-center gap-1 mb-3">
          <ArrowLeft className="w-4 h-4" />
          Back to workflows
        </Link>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white mb-2">{workflow.input.title}</h1>
            <p className="text-sm text-gray-400">{workflow.input.description}</p>
            <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <Layers className="w-3 h-3" />
                {workflow.epicId}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDuration(workflow.startedAt, workflow.completedAt)}
              </span>
              <span>Started {new Date(workflow.startedAt).toLocaleString()}</span>
            </div>
          </div>
          <div className={`px-3 py-1.5 rounded-lg border text-sm font-medium ${
            workflow.phase === "complete" ? "text-green-400 bg-green-400/10 border-green-400/30" :
            workflow.phase === "error" ? "text-red-400 bg-red-400/10 border-red-400/30" :
            "text-yellow-400 bg-yellow-400/10 border-yellow-400/30"
          }`}>
            {workflow.phase}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Total Tasks"
          value={agentTasks.length.toString()}
          icon={Users}
          color="text-brand-400"
        />
        <StatCard
          label="Running"
          value={agentTasks.filter(t => t.status === "running").length.toString()}
          icon={Loader2}
          color="text-yellow-400"
        />
        <StatCard
          label="Complete"
          value={agentTasks.filter(t => t.status === "complete").length.toString()}
          icon={CheckCircle2}
          color="text-green-400"
        />
        <StatCard
          label="Messages"
          value={workflow.messages.length.toString()}
          icon={MessageSquare}
          color="text-blue-400"
        />
      </div>

      {/* Agent Tasks */}
      <div className="card">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Agent Tasks</h2>
        {agentTasks.length === 0 ? (
          <div className="py-8 text-center text-gray-500">
            <Users className="w-8 h-8 mx-auto mb-2" />
            <p>No agent tasks yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {agentTasks.map(task => (
              <div key={task.id} className="p-4 rounded-lg border border-surface-4 bg-surface-3/30">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-white">{task.agentId}</h3>
                      <span className={`px-2 py-0.5 rounded-full border text-xs font-medium ${getStatusColor(task.status)}`}>
                        {task.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mb-2">{task.input}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-600">
                      {task.ticketId && (
                        <span className="flex items-center gap-1">
                          <Layers className="w-3 h-3" />
                          {task.ticketId}
                        </span>
                      )}
                      {task.startedAt && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDuration(task.startedAt, task.completedAt)}
                        </span>
                      )}
                      {task.branch && (
                        <span className="flex items-center gap-1">
                          <GitBranch className="w-3 h-3" />
                          {task.branch}
                        </span>
                      )}
                    </div>
                  </div>
                  {task.status === "running" && (
                    <Loader2 className="w-5 h-5 text-yellow-400 animate-spin ml-4" />
                  )}
                  {task.status === "complete" && (
                    <CheckCircle2 className="w-5 h-5 text-green-400 ml-4" />
                  )}
                  {task.status === "error" && (
                    <AlertCircle className="w-5 h-5 text-red-400 ml-4" />
                  )}
                </div>
                
                {task.output && (
                  <div className="mt-3 pt-3 border-t border-surface-4">
                    <p className="text-xs text-gray-500 mb-1">Output:</p>
                    <p className="text-xs text-gray-300">{task.output}</p>
                  </div>
                )}
                
                {task.error && (
                  <div className="mt-3 pt-3 border-t border-surface-4">
                    <p className="text-xs text-red-400">Error: {task.error}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Repository Config */}
      <div className="card">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Repository</h2>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Layout</span>
            <span className="text-white">{workflow.repoConfig.layout}</span>
          </div>
          {workflow.repoConfig.repos.map((repo, idx) => (
            <div key={idx} className="p-3 rounded-lg bg-surface-3/30 border border-surface-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Platform: {repo.platform}</p>
                  <p className="text-sm text-white font-mono">{repo.url}</p>
                </div>
                <a
                  href={repo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-400 hover:text-brand-300"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Notifications */}
      {workflow.humanNotifications.length > 0 && (
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4 flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Notifications
          </h2>
          <div className="space-y-2">
            {workflow.humanNotifications.map(notif => (
              <div
                key={notif.id}
                className={`p-3 rounded-lg border ${
                  notif.type === "error" ? "bg-red-400/10 border-red-400/30" :
                  notif.type === "pr_ready" ? "bg-green-400/10 border-green-400/30" :
                  "bg-blue-400/10 border-blue-400/30"
                }`}
              >
                <p className="text-sm font-medium text-white mb-1">{notif.title}</p>
                <p className="text-xs text-gray-400">{notif.details}</p>
                <p className="text-xs text-gray-600 mt-2">{new Date(notif.timestamp).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }: {
  label: string;
  value: string;
  icon: typeof Users;
  color: string;
}) {
  return (
    <div className="card">
      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 ${color} opacity-60 mt-1`} />
        <div>
          <p className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold text-white mt-0.5">{value}</p>
        </div>
      </div>
    </div>
  );
}