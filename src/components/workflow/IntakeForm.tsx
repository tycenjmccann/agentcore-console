"use client";

import { useState, useEffect } from "react";
import { FileText, GitBranch, Link2, Sparkles } from "lucide-react";
import type {
  WorkflowInput,
  IntakeSource,
  RepoConfig,
  RepoLayout,
} from "@/lib/workflow/types";
import type {
  ModelOption,
  ModelsApiResponse,
} from "@/lib/workflow/model-config";
import { modelOptionToOverride } from "@/lib/workflow/model-config";

interface IntakeFormProps {
  onSubmit: (input: WorkflowInput) => void;
  isLoading?: boolean;
}

export default function IntakeForm({ onSubmit, isLoading }: IntakeFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sources, setSources] = useState<IntakeSource[]>([]);
  const [newSourceUrl, setNewSourceUrl] = useState("");
  const [repoLayout, setRepoLayout] = useState<RepoLayout>("monorepo");
  const [repoUrl, setRepoUrl] = useState(
    "https://github.com/tycenjmccann/agentcore-console"
  );
  const [defaultBranch, setDefaultBranch] = useState("main");

  // Model selection state
  const [models, setModels] = useState<ModelOption[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>("");
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsError, setModelsError] = useState<string | null>(null);

  // Fetch available models on mount
  useEffect(() => {
    const fetchModels = async () => {
      try {
        setModelsLoading(true);
        setModelsError(null);

        const response = await fetch("/api/models");
        if (!response.ok) {
          throw new Error(`Failed to fetch models: ${response.status}`);
        }

        const data: ModelsApiResponse = await response.json();
        setModels(data.models);

        // Pre-select the default model
        const defaultModel = data.models.find((m) => m.isDefault);
        if (defaultModel) {
          setSelectedModelId(defaultModel.id);
        } else if (data.models.length > 0) {
          setSelectedModelId(data.models[0].id);
        }
      } catch (err) {
        console.error("[IntakeForm] Failed to load models:", err);
        setModelsError(
          err instanceof Error ? err.message : "Failed to load models"
        );
      } finally {
        setModelsLoading(false);
      }
    };

    fetchModels();
  }, []);

  const addUrlSource = () => {
    if (!newSourceUrl.trim()) return;
    setSources([...sources, { type: "url", value: newSourceUrl.trim() }]);
    setNewSourceUrl("");
  };

  const removeSource = (index: number) => {
    setSources(sources.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const repoConfig: RepoConfig = {
      layout: repoLayout,
      repos: repoUrl
        ? [{ url: repoUrl, defaultBranch, platform: "shared" }]
        : [],
    };

    const selectedModel = models.find((m) => m.id === selectedModelId);
    const modelOverride = modelOptionToOverride(selectedModel);

    onSubmit({
      title: title.trim(),
      description: description.trim(),
      repoConfig,
      sources,
      ...(modelOverride && { modelOverride }),
    });
  };

  const selectedModel = models.find((m) => m.id === selectedModelId);

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
      {/* ─── Card Header: Strong visual hierarchy ──────────────────────── */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-blue-600/15 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
              Start Team Workflow
            </h2>
            <p className="text-sm text-[var(--color-text-muted)]">
              Provide product input and the agent team will handle
              requirements, design, and implementation.
            </p>
          </div>
        </div>
      </div>

      {/* ─── Form Sections ─────────────────────────────────────────────── */}
      <div className="space-y-6">
        {/* Section: Core Info */}
        <fieldset className="space-y-4">
          <legend className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3 flex items-center gap-2">
            <FileText className="w-3.5 h-3.5" />
            Core Details
          </legend>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
              Feature Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Add profile photo carousel"
              className="w-full px-3 py-2.5 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-colors"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
              Description / PRD
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the feature, user stories, or paste your PRD content..."
              rows={6}
              className="w-full px-3 py-2.5 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 resize-y transition-colors"
            />
          </div>
        </fieldset>

        {/* Section: Input Sources */}
        <fieldset className="space-y-3">
          <legend className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3 flex items-center gap-2">
            <Link2 className="w-3.5 h-3.5" />
            Input Sources
          </legend>
          <p className="text-xs text-[var(--color-text-muted)] -mt-1">
            Add URLs to mockups, one-pagers, demo sites, or S3 locations
          </p>

          <div className="flex gap-2">
            <input
              type="text"
              value={newSourceUrl}
              onChange={(e) => setNewSourceUrl(e.target.value)}
              placeholder="https://... or s3://bucket/key"
              className="flex-1 px-3 py-2 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-colors"
              onKeyDown={(e) =>
                e.key === "Enter" && (e.preventDefault(), addUrlSource())
              }
            />
            <button
              type="button"
              onClick={addUrlSource}
              className="px-3 py-2 bg-[var(--color-surface-3)] text-[var(--color-text-secondary)] rounded-lg text-sm hover:bg-[var(--color-surface-4)] border border-[var(--color-border)] transition-colors"
            >
              Add
            </button>
          </div>

          {sources.length > 0 && (
            <div className="space-y-1">
              {sources.map((source, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 px-3 py-2 bg-[var(--color-surface-2)] rounded-lg text-xs border border-[var(--color-border)]"
                >
                  <span className="text-[var(--color-text-muted)] uppercase w-8 font-mono text-[10px]">
                    {source.type}
                  </span>
                  <span className="text-[var(--color-text-secondary)] truncate flex-1">
                    {source.value}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeSource(i)}
                    className="text-[var(--color-text-muted)] hover:text-red-400 transition-colors"
                    aria-label={`Remove source ${source.value}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </fieldset>

        {/* Section: Repository Config */}
        <fieldset className="space-y-3">
          <legend className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3 flex items-center gap-2">
            <GitBranch className="w-3.5 h-3.5" />
            Target Repository
          </legend>

          <div className="flex gap-4 mb-2">
            <label className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] cursor-pointer">
              <input
                type="radio"
                name="repo-layout"
                value="monorepo"
                checked={repoLayout === "monorepo"}
                onChange={(e) =>
                  setRepoLayout(e.target.value as RepoLayout)
                }
                className="accent-blue-500"
              />
              Monorepo
            </label>
            <label className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] cursor-pointer">
              <input
                type="radio"
                name="repo-layout"
                value="multi-repo"
                checked={repoLayout === "multi-repo"}
                onChange={(e) =>
                  setRepoLayout(e.target.value as RepoLayout)
                }
                className="accent-blue-500"
              />
              Multi-repo
            </label>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/org/repo.git"
              className="flex-1 px-3 py-2 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-colors"
            />
            <input
              type="text"
              value={defaultBranch}
              onChange={(e) => setDefaultBranch(e.target.value)}
              placeholder="main"
              className="w-24 px-3 py-2 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-colors"
            />
          </div>
        </fieldset>

        {/* Section: Model Selection */}
        {!modelsError && (
          <fieldset className="space-y-3">
            <legend className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5" />
              Model Selection
              <span className="text-[10px] font-normal normal-case tracking-normal text-[var(--color-text-muted)]">
                (optional)
              </span>
            </legend>
            <p className="text-xs text-[var(--color-text-muted)] -mt-1">
              Select AI model for development agents. Defaults to Claude
              Sonnet 4.5.
            </p>

            {modelsLoading ? (
              <div className="w-full px-3 py-2.5 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-muted)] text-sm animate-pulse">
                Loading models...
              </div>
            ) : (
              <>
                <select
                  id="model-select"
                  value={selectedModelId}
                  onChange={(e) => setSelectedModelId(e.target.value)}
                  aria-label="Select AI model for development agents"
                  aria-describedby="model-description"
                  className="w-full px-3 py-2.5 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 cursor-pointer appearance-none transition-colors"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%239ca3af'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "right 0.75rem center",
                    backgroundSize: "1.25rem",
                    paddingRight: "2.5rem",
                  }}
                >
                  {models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.isDefault
                        ? `⭐ ${model.label}`
                        : model.label}
                    </option>
                  ))}
                </select>

                {selectedModel?.description && (
                  <p
                    id="model-description"
                    className="mt-1.5 text-xs text-[var(--color-text-muted)] flex items-center gap-1"
                  >
                    <span className="opacity-60">ℹ️</span>
                    {selectedModel.description}
                    {selectedModel.isDefault && (
                      <span className="ml-1 text-green-500 font-medium">
                        (Recommended)
                      </span>
                    )}
                  </p>
                )}
              </>
            )}
          </fieldset>
        )}

        {/* Submit Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={!title.trim() || isLoading}
            className="w-full px-4 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-600/20 hover:shadow-blue-500/30"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="animate-spin w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Starting workflow...
              </span>
            ) : (
              "Start Team Workflow"
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
