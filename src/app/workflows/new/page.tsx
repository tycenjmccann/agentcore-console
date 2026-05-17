"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  X,
  Upload,
  Link as LinkIcon,
  FileText,
  Loader2,
  GitBranch,
  Play,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getClientRegion } from "@/lib/client-cache";
import type { IntakeSource, RepoLayout } from "@/lib/workflow/types";

export default function NewWorkflowPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [repoLayout, setRepoLayout] = useState<RepoLayout>("monorepo");
  const [repoUrl, setRepoUrl] = useState("");
  const [sources, setSources] = useState<IntakeSource[]>([]);
  const [newSourceUrl, setNewSourceUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addSource = useCallback((type: IntakeSource["type"], value: string, label?: string) => {
    if (!value.trim()) return;
    setSources((prev) => [
      ...prev,
      { type, value: value.trim(), label: label || value.trim() },
    ]);
    setNewSourceUrl("");
  }, []);

  const removeSource = useCallback((index: number) => {
    setSources((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      const region = getClientRegion();
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-aws-region": region,
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          repoConfig: {
            layout: repoLayout,
            repos: repoUrl ? [
              {
                url: repoUrl,
                defaultBranch: "main",
                platform: "shared",
              },
            ] : [],
          },
          sources,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create workflow");
      }

      const data = await res.json();
      router.push(`/workflows/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  };

  const sourceIcons: Record<IntakeSource["type"], typeof FileText> = {
    url: LinkIcon,
    upload: Upload,
    s3: FileText,
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back link */}
      <Link
        href="/workflows"
        className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Workflows
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">New Workflow</h1>
        <p className="text-sm text-gray-500 mt-1">
          Create a new workflow to process a feature request through the agent pipeline.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title */}
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
            Basic Information
          </h2>
          
          <div>
            <label className="block text-sm text-gray-300 mb-2">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Add push notification support for iOS"
              className="w-full bg-surface-1 border border-surface-4 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-brand-500/50"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-2">
              Description <span className="text-red-400">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the feature request in detail..."
              rows={4}
              className="w-full bg-surface-1 border border-surface-4 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-brand-500/50 resize-none"
              required
            />
          </div>
        </div>

        {/* Repository */}
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <GitBranch className="w-4 h-4" />
            Repository Configuration
          </h2>

          <div>
            <label className="block text-sm text-gray-300 mb-2">Layout</label>
            <div className="flex gap-3">
              {(["monorepo", "multi-repo"] as const).map((layout) => (
                <button
                  key={layout}
                  type="button"
                  onClick={() => setRepoLayout(layout)}
                  className={cn(
                    "flex-1 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors",
                    repoLayout === layout
                      ? "bg-brand-600/20 border-brand-500/50 text-brand-400"
                      : "bg-surface-1 border-surface-4 text-gray-400 hover:border-gray-600"
                  )}
                >
                  {layout === "monorepo" ? "Monorepo" : "Multi-repo"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-2">
              Repository URL
            </label>
            <input
              type="url"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/org/repo"
              className="w-full bg-surface-1 border border-surface-4 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-brand-500/50"
            />
          </div>
        </div>

        {/* Sources */}
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
            Input Sources (Optional)
          </h2>
          <p className="text-xs text-gray-500">
            Add PRDs, mockups, or other reference materials for the agents to analyze.
          </p>

          {/* Existing sources */}
          {sources.length > 0 && (
            <div className="space-y-2">
              {sources.map((source, idx) => {
                const Icon = sourceIcons[source.type];
                return (
                  <div
                    key={idx}
                    className="flex items-center gap-3 bg-surface-1 border border-surface-4 rounded-lg px-3 py-2"
                  >
                    <Icon className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-300 truncate">{source.label || source.value}</p>
                      <p className="text-xs text-gray-600 truncate">{source.value}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSource(idx)}
                      className="p-1 rounded hover:bg-surface-3 text-gray-500 hover:text-red-400 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add source */}
          <div className="flex gap-2">
            <input
              type="url"
              value={newSourceUrl}
              onChange={(e) => setNewSourceUrl(e.target.value)}
              placeholder="Enter URL to PRD, Figma, or other source..."
              className="flex-1 bg-surface-1 border border-surface-4 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-brand-500/50"
            />
            <button
              type="button"
              onClick={() => addSource("url", newSourceUrl)}
              disabled={!newSourceUrl.trim()}
              className="btn-secondary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Submit */}
        <div className="flex items-center justify-end gap-3">
          <Link
            href="/workflows"
            className="btn-secondary"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting || !title.trim() || !description.trim()}
            className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Start Workflow
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
