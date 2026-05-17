"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, X, GitBranch, Loader2 } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { RepoConfig, RepoTarget, RepoLayout } from "@/lib/workflow/types";

interface RepoForm extends RepoTarget {
  tempId: string;
}

export default function NewWorkflowPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [repoLayout, setRepoLayout] = useState<RepoLayout>("monorepo");
  const [repos, setRepos] = useState<RepoForm[]>([
    {
      tempId: "1",
      url: "",
      defaultBranch: "main",
      platform: "shared",
    },
  ]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  function addRepo() {
    setRepos([
      ...repos,
      {
        tempId: Date.now().toString(),
        url: "",
        defaultBranch: "main",
        platform: "shared",
      },
    ]);
  }

  function removeRepo(tempId: string) {
    if (repos.length === 1) return;
    setRepos(repos.filter((r) => r.tempId !== tempId));
  }

  function updateRepo(tempId: string, updates: Partial<RepoTarget>) {
    setRepos(
      repos.map((r) => (r.tempId === tempId ? { ...r, ...updates } : r))
    );
  }

  async function handleCreate() {
    setError("");

    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    const invalidRepos = repos.filter((r) => !r.url.trim());
    if (invalidRepos.length > 0) {
      setError("All repositories must have a URL");
      return;
    }

    setCreating(true);

    try {
      const repoConfig: RepoConfig = {
        layout: repoLayout,
        repos: repos.map((r) => ({
          url: r.url,
          defaultBranch: r.defaultBranch,
          platform: r.platform,
          pathPrefix: r.pathPrefix,
        })),
      };

      const res = await fetch("/api/workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: {
            title,
            description,
            repoConfig,
            sources: [],
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create workflow");
      }

      const data = await res.json();
      router.push(`/workflow/${data.workflowId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create workflow");
      setCreating(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/workflow"
          className="w-8 h-8 rounded-lg bg-surface-2 border border-surface-4 flex items-center justify-center hover:border-brand-600/30 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-gray-400" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">New Workflow</h1>
          <p className="text-gray-400 mt-1">
            Create a new agentic workflow from requirements to deployment
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-400/10 border border-red-400/30 rounded-lg p-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Basic Info */}
      <div className="card space-y-4">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
          Basic Information
        </h3>

        <div>
          <label className="block text-sm text-gray-400 mb-2">
            Title <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Add user authentication feature"
            className="w-full bg-surface-1 border border-surface-4 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-2">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Detailed description of the feature or work to be done..."
            rows={4}
            className="w-full bg-surface-1 border border-surface-4 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 resize-none"
          />
        </div>
      </div>

      {/* Repository Configuration */}
      <div className="card space-y-4">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
          Repository Configuration
        </h3>

        <div>
          <label className="block text-sm text-gray-400 mb-2">
            Repository Layout
          </label>
          <div className="flex gap-3">
            <button
              onClick={() => setRepoLayout("monorepo")}
              className={cn(
                "flex-1 py-3 px-4 rounded-lg border transition-all text-sm font-medium",
                repoLayout === "monorepo"
                  ? "bg-brand-600/20 border-brand-600/30 text-brand-400"
                  : "bg-surface-2 border-surface-4 text-gray-400 hover:border-gray-600"
              )}
            >
              <GitBranch className="w-4 h-4 mx-auto mb-1" />
              Monorepo
            </button>
            <button
              onClick={() => setRepoLayout("multi-repo")}
              className={cn(
                "flex-1 py-3 px-4 rounded-lg border transition-all text-sm font-medium",
                repoLayout === "multi-repo"
                  ? "bg-brand-600/20 border-brand-600/30 text-brand-400"
                  : "bg-surface-2 border-surface-4 text-gray-400 hover:border-gray-600"
              )}
            >
              <GitBranch className="w-4 h-4 mx-auto mb-1" />
              Multi-repo
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-400">
              Repositories <span className="text-red-400">*</span>
            </label>
            <button
              onClick={addRepo}
              className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              Add Repository
            </button>
          </div>

          {repos.map((repo, idx) => (
            <div
              key={repo.tempId}
              className="bg-surface-2 border border-surface-4 rounded-lg p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Repository {idx + 1}</span>
                {repos.length > 1 && (
                  <button
                    onClick={() => removeRepo(repo.tempId)}
                    className="text-gray-500 hover:text-red-400 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs text-gray-500 mb-1.5">
                    Repository URL
                  </label>
                  <input
                    type="text"
                    value={repo.url}
                    onChange={(e) =>
                      updateRepo(repo.tempId, { url: e.target.value })
                    }
                    placeholder="https://github.com/org/repo"
                    className="w-full bg-surface-1 border border-surface-4 rounded px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-500/50"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">
                    Default Branch
                  </label>
                  <input
                    type="text"
                    value={repo.defaultBranch}
                    onChange={(e) =>
                      updateRepo(repo.tempId, { defaultBranch: e.target.value })
                    }
                    placeholder="main"
                    className="w-full bg-surface-1 border border-surface-4 rounded px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-500/50"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">
                    Platform
                  </label>
                  <select
                    value={repo.platform}
                    onChange={(e) =>
                      updateRepo(repo.tempId, {
                        platform: e.target.value as RepoTarget["platform"],
                      })
                    }
                    className="w-full bg-surface-1 border border-surface-4 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500/50"
                  >
                    <option value="ios">iOS</option>
                    <option value="android">Android</option>
                    <option value="backend">Backend</option>
                    <option value="shared">Shared</option>
                  </select>
                </div>

                {repoLayout === "monorepo" && (
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-500 mb-1.5">
                      Path Prefix (optional)
                    </label>
                    <input
                      type="text"
                      value={repo.pathPrefix || ""}
                      onChange={(e) =>
                        updateRepo(repo.tempId, { pathPrefix: e.target.value })
                      }
                      placeholder="ios/"
                      className="w-full bg-surface-1 border border-surface-4 rounded px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-500/50"
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Link
          href="/workflow"
          className="px-6 py-2.5 rounded-lg border border-surface-4 text-gray-400 hover:text-white hover:border-gray-600 transition-colors"
        >
          Cancel
        </Link>
        <button
          onClick={handleCreate}
          disabled={creating || !title.trim()}
          className="flex-1 btn-primary flex items-center justify-center gap-2 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
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
  );
}
