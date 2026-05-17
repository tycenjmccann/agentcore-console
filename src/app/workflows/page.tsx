"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  GitBranch, Clock, CheckCircle2, AlertCircle,
  Loader2, Plus, ArrowRight, Layers, Users
} from "lucide-react";
import { WorkflowPhase } from "@/lib/workflow/types";

interface WorkflowSummary {
  id: string;
  phase: WorkflowPhase;
  title: string;
  startedAt: string;
  completedAt?: string;
  epicId: string;
}

function getPhaseColor(phase: WorkflowPhase): string {
  switch (phase) {
    case "complete": return "text-green-400 bg-green-400/10 border-green-400/30";
    case "error": return "text-red-400 bg-red-400/10 border-red-400/30";
    case "intake": return "text-blue-400 bg-blue-400/10 border-blue-400/30";
    case "requirements": return "text-cyan-400 bg-cyan-400/10 border-cyan-400/30";
    case "design": return "text-purple-400 bg-purple-400/10 border-purple-400/30";
    case "development": return "text-yellow-400 bg-yellow-400/10 border-yellow-400/30";
    case "review": return "text-orange-400 bg-orange-400/10 border-orange-400/30";
    default: return "text-gray-400 bg-gray-400/10 border-gray-400/30";
  }
}

function getPhaseIcon(phase: WorkflowPhase) {
  switch (phase) {
    case "complete": return CheckCircle2;
    case "error": return AlertCircle;
    case "development": return GitBranch;
    default: return Loader2;
  }
}

function formatDuration(startedAt: string, completedAt?: string): string {
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const seconds = Math.floor((end - start) / 1000);
  
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const hours = Math.floor(seconds / 3600);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    fetch("/api/workflows")
      .then(res => res.json())
      .then(data => {
        setWorkflows(data.workflows || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Workflows</h1>
          <p className="text-sm text-gray-400 mt-1">
            Agentic development workflows orchestrating your team
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Workflow
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Total Workflows"
          value={workflows.length.toString()}
          icon={Layers}
          color="text-brand-400"
        />
        <StatCard
          label="Active"
          value={workflows.filter(w => !["complete", "error"].includes(w.phase)).length.toString()}
          icon={Loader2}
          color="text-yellow-400"
        />
        <StatCard
          label="Completed"
          value={workflows.filter(w => w.phase === "complete").length.toString()}
          icon={CheckCircle2}
          color="text-green-400"
        />
        <StatCard
          label="Failed"
          value={workflows.filter(w => w.phase === "error").length.toString()}
          icon={AlertCircle}
          color="text-red-400"
        />
      </div>

      {/* Workflows List */}
      <div className="card">
        {loading ? (
          <div className="py-12 text-center text-gray-500">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" />
            <p>Loading workflows...</p>
          </div>
        ) : workflows.length === 0 ? (
          <div className="py-12 text-center">
            <Layers className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 mb-4">No workflows yet</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create your first workflow
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {workflows.map(workflow => {
              const PhaseIcon = getPhaseIcon(workflow.phase);
              return (
                <Link
                  key={workflow.id}
                  href={`/workflows/${workflow.id}`}
                  className="block p-4 rounded-lg border border-surface-4 hover:border-brand-500/50 hover:bg-surface-3/30 transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-base font-semibold text-white">{workflow.title}</h3>
                        <span className={`px-2 py-0.5 rounded-full border text-xs font-medium ${getPhaseColor(workflow.phase)}`}>
                          {workflow.phase}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Layers className="w-3 h-3" />
                          {workflow.epicId}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDuration(workflow.startedAt, workflow.completedAt)}
                        </span>
                        <span className="text-gray-600">
                          Started {new Date(workflow.startedAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <PhaseIcon className={`w-5 h-5 ${workflow.phase === "complete" ? "text-green-400" : workflow.phase === "error" ? "text-red-400" : "text-brand-400 animate-spin"}`} />
                      <ArrowRight className="w-4 h-4 text-gray-600" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateWorkflowModal onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }: {
  label: string;
  value: string;
  icon: typeof Layers;
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

function CreateWorkflowModal({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [repoUrl, setRepoUrl] = useState("https://github.com/tycenjmccann/agentcore-console");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!title || !description) return;

    setCreating(true);
    try {
      const response = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          repoConfig: {
            layout: "monorepo",
            repos: [{ url: repoUrl, defaultBranch: "main", platform: "shared" }]
          }
        })
      });

      if (response.ok) {
        const { workflow } = await response.json();
        window.location.href = `/workflows/${workflow.id}`;
      }
    } catch (error) {
      console.error("Failed to create workflow:", error);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={onClose}>
      <div className="card max-w-2xl w-full mx-4" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-white mb-4">Create New Workflow</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Title</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g., Add user authentication"
              className="w-full px-3 py-2 bg-surface-3 border border-surface-4 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe what you want to build..."
              rows={4}
              className="w-full px-3 py-2 bg-surface-3 border border-surface-4 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Repository URL</label>
            <input
              type="text"
              value={repoUrl}
              onChange={e => setRepoUrl(e.target.value)}
              placeholder="https://github.com/org/repo"
              className="w-full px-3 py-2 bg-surface-3 border border-surface-4 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-brand-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 mt-6 pt-4 border-t border-surface-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!title || !description || creating}
            className="flex-1 px-4 py-2 bg-brand-600 hover:bg-brand-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            {creating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Create Workflow
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}