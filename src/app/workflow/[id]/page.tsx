"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  GitBranch,
  Bot,
  MessageSquare,
  FileCode,
  Ticket,
  Circle,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type {
  WorkflowState,
  JiraTicket,
  AgentTask,
  AgentTaskStatus,
  TicketStatus,
} from "@/lib/workflow/types";

function getTaskStatusColor(status: AgentTaskStatus): string {
  switch (status) {
    case "pending":
      return "text-gray-400 bg-gray-400/10 border-gray-400/30";
    case "running":
      return "text-blue-400 bg-blue-400/10 border-blue-400/30";
    case "waiting_response":
      return "text-yellow-400 bg-yellow-400/10 border-yellow-400/30";
    case "complete":
      return "text-green-400 bg-green-400/10 border-green-400/30";
    case "error":
      return "text-red-400 bg-red-400/10 border-red-400/30";
    default:
      return "text-gray-400 bg-gray-400/10 border-gray-400/30";
  }
}

function getTaskStatusIcon(status: AgentTaskStatus) {
  switch (status) {
    case "pending":
      return Circle;
    case "running":
      return Loader2;
    case "waiting_response":
      return Clock;
    case "complete":
      return CheckCircle2;
    case "error":
      return AlertCircle;
    default:
      return Circle;
  }
}

function getTicketStatusColor(status: TicketStatus): string {
  switch (status) {
    case "backlog":
      return "text-gray-400 bg-gray-400/10 border-gray-400/30";
    case "todo":
      return "text-blue-400 bg-blue-400/10 border-blue-400/30";
    case "ready":
      return "text-cyan-400 bg-cyan-400/10 border-cyan-400/30";
    case "in_progress":
      return "text-yellow-400 bg-yellow-400/10 border-yellow-400/30";
    case "in_review":
      return "text-purple-400 bg-purple-400/10 border-purple-400/30";
    case "done":
      return "text-green-400 bg-green-400/10 border-green-400/30";
    case "blocked":
      return "text-red-400 bg-red-400/10 border-red-400/30";
    default:
      return "text-gray-400 bg-gray-400/10 border-gray-400/30";
  }
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function WorkflowDetailPage() {
  const params = useParams();
  const router = useRouter();
  const workflowId = params.id as string;

  const [workflow, setWorkflow] = useState<WorkflowState | null>(null);
  const [tickets, setTickets] = useState<JiraTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<"tasks" | "tickets" | "messages">("tasks");

  useEffect(() => {
    fetchWorkflow();
  }, [workflowId]);

  async function fetchWorkflow() {
    try {
      const res = await fetch(`/api/workflow?id=${workflowId}`);
      if (!res.ok) {
        router.push("/workflow");
        return;
      }
      const data = await res.json();
      setWorkflow(data.workflow);
      setTickets(data.tickets || []);
    } catch (error) {
      console.error("Failed to fetch workflow:", error);
      router.push("/workflow");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-brand-400 animate-spin" />
      </div>
    );
  }

  if (!workflow) {
    return null;
  }

  const tasks = Object.entries(workflow.agentTasks);
  const epic = tickets.find((t) => t.id === workflow.epicId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/workflow"
          className="w-8 h-8 rounded-lg bg-surface-2 border border-surface-4 flex items-center justify-center hover:border-brand-600/30 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-gray-400" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">{workflow.input.title}</h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-gray-400">
            <span>ID: {workflow.id}</span>
            <span>•</span>
            <span>Epic: {workflow.epicId}</span>
            <span>•</span>
            <span>Started {timeAgo(workflow.startedAt)}</span>
          </div>
        </div>
        <div
          className={cn(
            "px-3 py-1.5 rounded-lg border text-sm font-medium",
            workflow.phase === "complete"
              ? "bg-green-400/10 text-green-400 border-green-400/30"
              : workflow.phase === "error"
              ? "bg-red-400/10 text-red-400 border-red-400/30"
              : "bg-brand-400/10 text-brand-400 border-brand-400/30"
          )}
        >
          {workflow.phase}
        </div>
      </div>

      {/* Description */}
      {workflow.input.description && (
        <div className="card">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Description
          </h3>
          <p className="text-gray-300 text-sm">{workflow.input.description}</p>
        </div>
      )}

      {/* Repo Config */}
      <div className="card">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Repository Configuration
        </h3>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <GitBranch className="w-4 h-4 text-gray-500" />
            <span className="text-gray-400">Layout:</span>
            <span className="text-white font-mono">{workflow.repoConfig.layout}</span>
          </div>
          {workflow.repoConfig.repos.map((repo, idx) => (
            <div key={idx} className="ml-6 text-sm text-gray-400">
              <div className="flex items-center gap-2">
                <FileCode className="w-3 h-3" />
                <span className="text-white font-mono">{repo.url}</span>
                <span className="text-xs text-gray-600">({repo.platform})</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-surface-4">
        <button
          onClick={() => setSelectedTab("tasks")}
          className={cn(
            "px-4 py-2 text-sm font-medium transition-colors",
            selectedTab === "tasks"
              ? "text-brand-400 border-b-2 border-brand-400"
              : "text-gray-500 hover:text-gray-300"
          )}
        >
          Agent Tasks ({tasks.length})
        </button>
        <button
          onClick={() => setSelectedTab("tickets")}
          className={cn(
            "px-4 py-2 text-sm font-medium transition-colors",
            selectedTab === "tickets"
              ? "text-brand-400 border-b-2 border-brand-400"
              : "text-gray-500 hover:text-gray-300"
          )}
        >
          Tickets ({tickets.length})
        </button>
        <button
          onClick={() => setSelectedTab("messages")}
          className={cn(
            "px-4 py-2 text-sm font-medium transition-colors",
            selectedTab === "messages"
              ? "text-brand-400 border-b-2 border-brand-400"
              : "text-gray-500 hover:text-gray-300"
          )}
        >
          Messages ({workflow.messages.length})
        </button>
      </div>

      {/* Tab Content */}
      {selectedTab === "tasks" && (
        <div className="space-y-3">
          {tasks.length === 0 ? (
            <div className="card text-center py-8">
              <Bot className="w-8 h-8 text-gray-600 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">No agent tasks yet</p>
            </div>
          ) : (
            tasks.map(([agentId, task]) => {
              const StatusIcon = getTaskStatusIcon(task.status);
              return (
                <div key={task.id} className="card">
                  <div className="flex items-center gap-4">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center",
                        task.status === "complete"
                          ? "bg-green-600/20"
                          : task.status === "error"
                          ? "bg-red-600/20"
                          : "bg-brand-600/20"
                      )}
                    >
                      <Bot
                        className={cn(
                          "w-5 h-5",
                          task.status === "complete"
                            ? "text-green-400"
                            : task.status === "error"
                            ? "text-red-400"
                            : "text-brand-400"
                        )}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-white font-medium">{agentId}</h4>
                        <span
                          className={cn(
                            "text-xs px-2 py-0.5 rounded-full border font-medium flex items-center gap-1",
                            getTaskStatusColor(task.status)
                          )}
                        >
                          <StatusIcon
                            className={cn(
                              "w-3 h-3",
                              task.status === "running" && "animate-spin"
                            )}
                          />
                          {task.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">Ticket: {task.ticketId}</p>
                      {task.branch && (
                        <p className="text-xs text-gray-500 mt-1">
                          Branch: <span className="font-mono">{task.branch}</span>
                        </p>
                      )}
                    </div>
                  </div>
                  {task.output && (
                    <div className="mt-3 pt-3 border-t border-surface-4">
                      <pre className="text-xs text-gray-400 whitespace-pre-wrap max-h-32 overflow-y-auto">
                        {task.output}
                      </pre>
                    </div>
                  )}
                  {task.error && (
                    <div className="mt-3 pt-3 border-t border-surface-4">
                      <p className="text-xs text-red-400">{task.error}</p>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {selectedTab === "tickets" && (
        <div className="space-y-3">
          {tickets.length === 0 ? (
            <div className="card text-center py-8">
              <Ticket className="w-8 h-8 text-gray-600 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">No tickets yet</p>
            </div>
          ) : (
            tickets.map((ticket) => (
              <div key={ticket.id} className="card">
                <div className="flex items-center gap-4">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center",
                      ticket.type === "epic"
                        ? "bg-purple-600/20"
                        : "bg-blue-600/20"
                    )}
                  >
                    <Ticket
                      className={cn(
                        "w-5 h-5",
                        ticket.type === "epic" ? "text-purple-400" : "text-blue-400"
                      )}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-white font-medium">{ticket.title}</h4>
                      <span className="text-xs px-2 py-0.5 rounded bg-surface-3 text-gray-400 border border-surface-4">
                        {ticket.type}
                      </span>
                      <span
                        className={cn(
                          "text-xs px-2 py-0.5 rounded-full border font-medium",
                          getTicketStatusColor(ticket.status)
                        )}
                      >
                        {ticket.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">ID: {ticket.id}</p>
                    {ticket.assignee && (
                      <p className="text-xs text-gray-500 mt-1">
                        Assignee: {ticket.assignee}
                      </p>
                    )}
                  </div>
                </div>
                {ticket.description && (
                  <p className="mt-3 text-sm text-gray-400">{ticket.description}</p>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {selectedTab === "messages" && (
        <div className="space-y-3">
          {workflow.messages.length === 0 ? (
            <div className="card text-center py-8">
              <MessageSquare className="w-8 h-8 text-gray-600 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">No agent messages yet</p>
            </div>
          ) : (
            workflow.messages.map((msg) => (
              <div key={msg.id} className="card">
                <div className="flex items-center gap-3 mb-2">
                  <Bot className="w-4 h-4 text-brand-400" />
                  <span className="text-sm font-medium text-white">{msg.from}</span>
                  <span className="text-gray-600">→</span>
                  <span className="text-sm text-gray-400">{msg.to}</span>
                  <span className="text-xs text-gray-600 ml-auto">
                    {timeAgo(msg.timestamp)}
                  </span>
                </div>
                <p className="text-sm text-gray-300 whitespace-pre-wrap">{msg.content}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
