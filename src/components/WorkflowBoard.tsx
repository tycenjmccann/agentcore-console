"use client";

import { useState, useEffect } from "react";
import { WorkflowState } from "./IntakeForm";
import { Bot, Clock, CheckCircle2, AlertCircle, Cpu } from "lucide-react";

interface WorkflowBoardProps {
  workflowId: string;
}

interface AgentTask {
  id: string;
  agentId: string;
  agentName: string;
  status: "pending" | "running" | "completed" | "failed";
  startedAt?: Date;
  completedAt?: Date;
  output?: string;
}

export function WorkflowBoard({ workflowId }: WorkflowBoardProps) {
  const [workflow, setWorkflow] = useState<WorkflowState | null>(null);
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadWorkflow() {
      try {
        const response = await fetch(`/api/workflows/${workflowId}`);
        if (response.ok) {
          const data = await response.json();
          setWorkflow(data.workflow);
          setTasks(data.tasks || []);
        }
      } catch (error) {
        console.error("Failed to load workflow:", error);
      } finally {
        setLoading(false);
      }
    }

    loadWorkflow();
    
    // Poll for updates every 5 seconds
    const interval = setInterval(loadWorkflow, 5000);
    return () => clearInterval(interval);
  }, [workflowId]);

  if (loading) {
    return (
      <div className="card">
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-brand-600/30 border-t-brand-600 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="card">
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <p className="text-gray-400">Workflow not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Workflow Header */}
      <div className="card">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-white mb-2">Workflow {workflowId}</h2>
            <p className="text-sm text-gray-400">{workflow.description}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full border text-xs font-medium ${
              workflow.status === "completed"
                ? "bg-green-400/10 text-green-400 border-green-400/30"
                : workflow.status === "in_progress"
                ? "bg-blue-400/10 text-blue-400 border-blue-400/30"
                : "bg-gray-400/10 text-gray-400 border-gray-400/30"
            }`}>
              {workflow.status.toUpperCase().replace("_", " ")}
            </span>
          </div>
        </div>

        {/* Model Configuration Display */}
        {workflow.modelConfig && (
          <div className="mt-4 pt-4 border-t border-surface-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Model Configuration</p>
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-brand-400" />
              <span className="text-sm font-semibold text-gray-200">
                {getProviderDisplayName(workflow.modelConfig.provider)} - {workflow.modelConfig.displayName}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              All agents in this workflow use this model
            </p>
          </div>
        )}

        {/* Metadata */}
        <div className="mt-4 pt-4 border-t border-surface-4 grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Priority</p>
            <p className="text-sm font-semibold text-gray-200 mt-1 capitalize">{workflow.priority}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Tasks</p>
            <p className="text-sm font-semibold text-gray-200 mt-1">
              {tasks.filter((t) => t.status === "completed").length} / {tasks.length} completed
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Created</p>
            <p className="text-sm font-semibold text-gray-200 mt-1">
              {workflow.createdAt ? new Date(workflow.createdAt).toLocaleString() : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Agent Tasks */}
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-4">Agent Tasks</h3>
        
        {tasks.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No tasks yet
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((task, index) => (
              <div
                key={task.id}
                className="flex items-start gap-4 p-4 bg-surface-2 border border-surface-4 rounded-lg"
              >
                {/* Status Icon */}
                <div className="flex-shrink-0 mt-1">
                  {task.status === "completed" && (
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                  )}
                  {task.status === "running" && (
                    <div className="w-5 h-5 border-2 border-brand-600/30 border-t-brand-600 rounded-full animate-spin" />
                  )}
                  {task.status === "failed" && (
                    <AlertCircle className="w-5 h-5 text-red-400" />
                  )}
                  {task.status === "pending" && (
                    <Clock className="w-5 h-5 text-gray-500" />
                  )}
                </div>

                {/* Task Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Bot className="w-4 h-4 text-brand-400" />
                    <span className="text-sm font-semibold text-gray-200">{task.agentName}</span>
                    <span className="text-xs text-gray-500">#{index + 1}</span>
                  </div>
                  <p className="text-xs text-gray-400">
                    Status: <span className="capitalize">{task.status}</span>
                  </p>
                  {task.output && (
                    <p className="text-xs text-gray-500 mt-2 truncate">{task.output}</p>
                  )}
                </div>

                {/* Timing */}
                {(task.startedAt || task.completedAt) && (
                  <div className="flex-shrink-0 text-right">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide">Duration</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {task.startedAt && task.completedAt
                        ? formatDuration(
                            new Date(task.completedAt).getTime() - new Date(task.startedAt).getTime()
                          )
                        : task.startedAt
                        ? "Running..."
                        : "—"}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function getProviderDisplayName(provider: string): string {
  switch (provider) {
    case "bedrock":
      return "Bedrock";
    case "openai":
      return "OpenAI";
    case "gemini":
      return "Gemini";
    default:
      return provider;
  }
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}
