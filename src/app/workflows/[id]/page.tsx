"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Clock,
  Bot,
  GitBranch,
  Ticket,
  MessageSquare,
  Loader2,
  RefreshCw,
  FileText,
  Code,
  GitPullRequest,
  ChevronDown,
  ChevronRight,
  Bell,
  User,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getClientRegion } from "@/lib/client-cache";
import type {
  WorkflowState,
  WorkflowPhase,
  AgentTask,
  AgentTaskStatus,
  JiraTicket,
  AgentMessage,
  HumanNotification,
  Artifact,
} from "@/lib/workflow/types";

// Phase configuration
const phaseConfig: Record<WorkflowPhase, { label: string; color: string }> = {
  intake: { label: "Intake", color: "bg-blue-500" },
  requirements: { label: "Requirements", color: "bg-purple-500" },
  design: { label: "Design", color: "bg-cyan-500" },
  development: { label: "Development", color: "bg-green-500" },
  review: { label: "Review", color: "bg-yellow-500" },
  complete: { label: "Complete", color: "bg-emerald-500" },
  error: { label: "Error", color: "bg-red-500" },
};

const phases: WorkflowPhase[] = ["intake", "requirements", "design", "development", "review", "complete"];

// Status indicator component
function TaskStatusBadge({ status }: { status: AgentTaskStatus }) {
  const config: Record<AgentTaskStatus, { label: string; color: string }> = {
    pending: { label: "Pending", color: "bg-gray-500/10 text-gray-400 border-gray-500/30" },
    running: { label: "Running", color: "bg-green-500/10 text-green-400 border-green-500/30" },
    waiting_response: { label: "Waiting", color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30" },
    complete: { label: "Complete", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
    error: { label: "Error", color: "bg-red-500/10 text-red-400 border-red-500/30" },
  };
  
  return (
    <span className={cn("px-2 py-0.5 text-xs font-medium rounded border", config[status].color)}>
      {config[status].label}
    </span>
  );
}

// Time formatter
function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString();
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// Copy button component
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded hover:bg-surface-3 transition-colors"
      title="Copy"
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-green-400" />
      ) : (
        <Copy className="w-3.5 h-3.5 text-gray-500" />
      )}
    </button>
  );
}

// Agent Task Card
function AgentTaskCard({ task, agentId }: { task: AgentTask; agentId: string }) {
  const [expanded, setExpanded] = useState(task.status === "running");
  
  return (
    <div className="bg-surface-2 border border-surface-4 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 hover:bg-surface-3/50 transition-colors text-left"
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
        )}
        <div className="w-8 h-8 rounded-lg bg-brand-600/20 flex items-center justify-center flex-shrink-0">
          <Bot className="w-4 h-4 text-brand-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">{agentId}</span>
            <TaskStatusBadge status={task.status} />
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            Ticket: {task.ticketId}
            {task.startedAt && <span className="ml-3">Started: {timeAgo(task.startedAt)}</span>}
          </div>
        </div>
        {task.status === "running" && (
          <Loader2 className="w-4 h-4 text-green-400 animate-spin flex-shrink-0" />
        )}
      </button>
      
      {expanded && (
        <div className="border-t border-surface-4 p-4 space-y-4">
          {/* Input */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Input</span>
              <CopyButton text={task.input} />
            </div>
            <pre className="text-xs text-gray-400 bg-surface-1 rounded-lg p-3 overflow-auto max-h-48 whitespace-pre-wrap">
              {task.input}
            </pre>
          </div>
          
          {/* Output */}
          {task.output && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Output</span>
                <CopyButton text={task.output} />
              </div>
              <pre className="text-xs text-gray-400 bg-surface-1 rounded-lg p-3 overflow-auto max-h-64 whitespace-pre-wrap">
                {task.output}
              </pre>
            </div>
          )}
          
          {/* Branch & Commit */}
          {(task.branch || task.commitSha) && (
            <div className="flex items-center gap-4 text-xs">
              {task.branch && (
                <span className="flex items-center gap-1 text-brand-400">
                  <GitBranch className="w-3 h-3" />
                  {task.branch}
                </span>
              )}
              {task.commitSha && (
                <span className="flex items-center gap-1 text-gray-400 font-mono">
                  <Code className="w-3 h-3" />
                  {task.commitSha.slice(0, 7)}
                </span>
              )}
            </div>
          )}
          
          {/* Error */}
          {task.error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              <p className="text-xs text-red-400">{task.error}</p>
            </div>
          )}
          
          {/* Timestamps */}
          <div className="flex items-center gap-4 text-xs text-gray-500">
            {task.startedAt && <span>Started: {formatTime(task.startedAt)}</span>}
            {task.completedAt && <span>Completed: {formatTime(task.completedAt)}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// Notification Card
function NotificationCard({ notification, onAcknowledge }: { notification: HumanNotification; onAcknowledge: () => void }) {
  const iconMap: Record<string, typeof Bell> = {
    phase_complete: CheckCircle2,
    blocker: AlertCircle,
    review_needed: FileText,
    pr_ready: GitPullRequest,
    error: AlertCircle,
  };
  const Icon = iconMap[notification.type] || Bell;
  
  return (
    <div className={cn(
      "bg-surface-2 border rounded-lg p-4",
      notification.acknowledged ? "border-surface-4" : "border-yellow-500/30"
    )}>
      <div className="flex items-start gap-3">
        <div className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
          notification.type === "error" ? "bg-red-500/20" : "bg-yellow-500/20"
        )}>
          <Icon className={cn(
            "w-4 h-4",
            notification.type === "error" ? "text-red-400" : "text-yellow-400"
          )} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-white">{notification.title}</h4>
            <span className="text-xs text-gray-500">{timeAgo(notification.timestamp)}</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">{notification.details}</p>
          {!notification.acknowledged && (
            <button
              onClick={onAcknowledge}
              className="mt-2 text-xs text-brand-400 hover:text-brand-300"
            >
              Acknowledge
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Message Card
function MessageCard({ message }: { message: AgentMessage }) {
  return (
    <div className="bg-surface-2 border border-surface-4 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
          <MessageSquare className="w-4 h-4 text-purple-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
            <span className="font-medium text-gray-300">{message.from}</span>
            <span>→</span>
            <span className="font-medium text-gray-300">{message.to}</span>
            <span className="ml-auto">{timeAgo(message.timestamp)}</span>
          </div>
          <p className="text-sm text-gray-300">{message.content}</p>
          {message.resolved && (
            <span className="inline-flex items-center gap-1 mt-2 text-xs text-emerald-400">
              <CheckCircle2 className="w-3 h-3" />
              Resolved
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// Props type for the page
interface WorkflowDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function WorkflowDetailPage({ params }: WorkflowDetailPageProps) {
  const resolvedParams = use(params);
  const workflowId = resolvedParams.id;
  
  const [workflow, setWorkflow] = useState<WorkflowState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"tasks" | "tickets" | "messages" | "notifications">("tasks");

  const fetchWorkflow = useCallback(async () => {
    try {
      const region = getClientRegion();
      const res = await fetch(`/api/workflows/${workflowId}`, {
        headers: { "x-aws-region": region },
      });
      
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error("Workflow not found");
        }
        throw new Error("Failed to fetch workflow");
      }
      
      const data = await res.json();
      setWorkflow(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [workflowId]);

  useEffect(() => {
    fetchWorkflow();
    
    // Poll for updates if workflow is active
    const interval = setInterval(() => {
      if (workflow && workflow.phase !== "complete" && workflow.phase !== "error") {
        fetchWorkflow();
      }
    }, 3000);
    
    return () => clearInterval(interval);
  }, [fetchWorkflow, workflow?.phase]);

  const handleAcknowledgeNotification = async (notificationId: string) => {
    try {
      const region = getClientRegion();
      await fetch(`/api/workflows/${workflowId}/notifications/${notificationId}/acknowledge`, {
        method: "POST",
        headers: { "x-aws-region": region },
      });
      fetchWorkflow();
    } catch {
      // Ignore errors for now
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-brand-400 animate-spin" />
        <span className="ml-2 text-sm text-gray-500">Loading workflow...</span>
      </div>
    );
  }

  if (error || !workflow) {
    return (
      <div className="space-y-6">
        <Link
          href="/workflows"
          className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Workflows
        </Link>
        
        <div className="card border-red-500/20 text-center py-12">
          <AlertCircle className="w-10 h-10 text-red-400/60 mx-auto mb-3" />
          <p className="text-sm text-red-400">{error || "Workflow not found"}</p>
          <button
            onClick={fetchWorkflow}
            className="mt-4 btn-secondary text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const taskEntries = Object.entries(workflow.agentTasks);
  const unreadNotifications = workflow.humanNotifications.filter(n => !n.acknowledged);

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/workflows"
        className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Workflows
      </Link>

      {/* Header */}
      <div className="card">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-white">{workflow.input.title}</h1>
            <p className="text-sm text-gray-500 font-mono mt-1">{workflow.id}</p>
          </div>
          <button
            onClick={fetchWorkflow}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            Refresh
          </button>
        </div>

        {/* Phase Progress */}
        <div className="mb-6">
          <div className="flex items-center gap-1">
            {phases.map((phase, idx) => {
              const isActive = phase === workflow.phase;
              const isPast = phases.indexOf(workflow.phase) > idx || workflow.phase === "complete";
              const isError = workflow.phase === "error" && phases.indexOf(phase) >= phases.indexOf("intake");
              
              return (
                <div key={phase} className="flex-1 flex items-center">
                  <div className={cn(
                    "h-2 flex-1 rounded-full transition-colors",
                    isPast ? phaseConfig[phase].color : "bg-surface-3",
                    isActive && "animate-pulse",
                    isError && idx === phases.indexOf(workflow.phase) && "bg-red-500"
                  )} />
                  {idx < phases.length - 1 && <div className="w-1" />}
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-500">
            {phases.map((phase) => (
              <span key={phase} className={cn(
                phase === workflow.phase && "text-white font-medium"
              )}>
                {phaseConfig[phase].label}
              </span>
            ))}
          </div>
        </div>

        {/* Meta Info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-surface-4">
          <div>
            <p className="text-xs text-gray-500 mb-1">Epic</p>
            <p className="text-sm text-white flex items-center gap-1">
              <Ticket className="w-3 h-3 text-brand-400" />
              {workflow.epicId}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Started</p>
            <p className="text-sm text-white">{formatTime(workflow.startedAt)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Repository</p>
            <p className="text-sm text-white flex items-center gap-1">
              <GitBranch className="w-3 h-3 text-cyan-400" />
              {workflow.repoConfig.layout}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Status</p>
            <p className={cn(
              "text-sm font-medium",
              workflow.phase === "complete" && "text-emerald-400",
              workflow.phase === "error" && "text-red-400",
              workflow.phase !== "complete" && workflow.phase !== "error" && "text-green-400"
            )}>
              {workflow.phase === "error" ? "Error" : workflow.completedAt ? "Completed" : "In Progress"}
            </p>
          </div>
        </div>

        {/* Error Display */}
        {workflow.error && (
          <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-400 mb-1">
              <AlertCircle className="w-4 h-4" />
              <span className="font-medium text-sm">Error</span>
            </div>
            <p className="text-sm text-red-300">{workflow.error}</p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-surface-4">
        <nav className="flex gap-6">
          {[
            { key: "tasks", label: "Agent Tasks", count: taskEntries.length },
            { key: "messages", label: "Messages", count: workflow.messages.length },
            { key: "notifications", label: "Notifications", count: unreadNotifications.length },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={cn(
                "pb-3 text-sm font-medium border-b-2 transition-colors",
                activeTab === tab.key
                  ? "border-brand-500 text-white"
                  : "border-transparent text-gray-500 hover:text-gray-300"
              )}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={cn(
                  "ml-2 px-1.5 py-0.5 rounded text-xs",
                  activeTab === tab.key
                    ? "bg-brand-500/20 text-brand-400"
                    : "bg-surface-3 text-gray-400"
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === "tasks" && (
          <div className="space-y-3">
            {taskEntries.length === 0 ? (
              <div className="card text-center py-12">
                <Bot className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                <p className="text-sm text-gray-400">No agent tasks yet.</p>
              </div>
            ) : (
              taskEntries.map(([agentId, task]) => (
                <AgentTaskCard key={agentId} task={task} agentId={agentId} />
              ))
            )}
          </div>
        )}

        {activeTab === "messages" && (
          <div className="space-y-3">
            {workflow.messages.length === 0 ? (
              <div className="card text-center py-12">
                <MessageSquare className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                <p className="text-sm text-gray-400">No agent messages yet.</p>
              </div>
            ) : (
              workflow.messages.map((message) => (
                <MessageCard key={message.id} message={message} />
              ))
            )}
          </div>
        )}

        {activeTab === "notifications" && (
          <div className="space-y-3">
            {workflow.humanNotifications.length === 0 ? (
              <div className="card text-center py-12">
                <Bell className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                <p className="text-sm text-gray-400">No notifications yet.</p>
              </div>
            ) : (
              workflow.humanNotifications.map((notification) => (
                <NotificationCard
                  key={notification.id}
                  notification={notification}
                  onAcknowledge={() => handleAcknowledgeNotification(notification.id)}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
