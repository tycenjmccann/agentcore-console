"use client";

import { useState, useEffect } from "react";
import type { WorkflowInput, IntakeSource, RepoConfig, RepoLayout, ModelConfig } from "@/lib/workflow/types";

interface ModelInfo {
  id: string;
  displayName: string;
  provider: "bedrock" | "openai" | "gemini";
  isDefault: boolean;
}

interface ModelsResponse {
  models: ModelInfo[];
}

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
  const [repoUrl, setRepoUrl] = useState("");
  const [defaultBranch, setDefaultBranch] = useState("main");
  
  // Model selection state
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>("");
  const [modelsLoading, setModelsLoading] = useState(true);

  // Fetch available models on mount
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const response = await fetch("/api/workflow/models");
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data: ModelsResponse = await response.json();
        setAvailableModels(data.models);
        
        // Pre-select the default model
        const defaultModel = data.models.find(m => m.isDefault);
        if (defaultModel) {
          setSelectedModelId(defaultModel.id);
        }
      } catch (error) {
        console.error("Failed to fetch models:", error);
        // Fallback: show default Sonnet 4.5 only
        const fallbackModel: ModelInfo = {
          id: "global.anthropic.claude-sonnet-4-5-20250929-v1:0",
          displayName: "Claude Sonnet 4.5 (Default)",
          provider: "bedrock",
          isDefault: true,
        };
        setAvailableModels([fallbackModel]);
        setSelectedModelId(fallbackModel.id);
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

    // Build model config from selected model
    let modelConfig: ModelConfig | undefined;
    if (selectedModelId) {
      const selectedModel = availableModels.find(m => m.id === selectedModelId);
      if (selectedModel) {
        modelConfig = {
          provider: selectedModel.provider,
          modelId: selectedModel.id,
        } as ModelConfig;
      }
    }

    onSubmit({
      title: title.trim(),
      description: description.trim(),
      repoConfig,
      sources,
      modelConfig,
    });
  };

  // Group models by provider for visual hierarchy
  const modelsByProvider = availableModels.reduce((acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = [];
    }
    acc[model.provider].push(model);
    return acc;
  }, {} as Record<string, ModelInfo[]>);

  const providerLabels: Record<string, string> = {
    bedrock: "AWS Bedrock",
    openai: "OpenAI",
    gemini: "Google Gemini",
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-zinc-100 mb-1">
          Start Team Workflow
        </h2>
        <p className="text-sm text-zinc-400">
          Provide product input and the agent team will handle requirements, design, and implementation.
        </p>
      </div>

      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-1">
          Feature Title
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., Add profile photo carousel"
          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
          required
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-1">
          Description / PRD
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the feature, user stories, or paste your PRD content..."
          rows={6}
          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 resize-y"
        />
      </div>

      {/* Input Sources */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-1">
          Input Sources
        </label>
        <p className="text-xs text-zinc-500 mb-2">
          Add URLs to mockups, one-pagers, demo sites, or S3 locations
        </p>

        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={newSourceUrl}
            onChange={(e) => setNewSourceUrl(e.target.value)}
            placeholder="https://... or s3://bucket/key"
            className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 text-sm focus:outline-none focus:border-zinc-500"
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addUrlSource())}
          />
          <button
            type="button"
            onClick={addUrlSource}
            className="px-3 py-2 bg-zinc-700 text-zinc-200 rounded-lg text-sm hover:bg-zinc-600"
          >
            Add
          </button>
        </div>

        {sources.length > 0 && (
          <div className="space-y-1">
            {sources.map((source, i) => (
              <div key={i} className="flex items-center gap-2 px-2 py-1 bg-zinc-800 rounded text-xs">
                <span className="text-zinc-500 uppercase w-8">{source.type}</span>
                <span className="text-zinc-300 truncate flex-1">{source.value}</span>
                <button
                  type="button"
                  onClick={() => removeSource(i)}
                  className="text-zinc-500 hover:text-red-400"
                >
                  x
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Repo Config */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-1">
          Target Repository
        </label>

        <div className="flex gap-4 mb-2">
          <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer">
            <input
              type="radio"
              name="repo-layout"
              value="monorepo"
              checked={repoLayout === "monorepo"}
              onChange={(e) => setRepoLayout(e.target.value as RepoLayout)}
              className="accent-blue-500"
            />
            Monorepo
          </label>
          <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer">
            <input
              type="radio"
              name="repo-layout"
              value="multi-repo"
              checked={repoLayout === "multi-repo"}
              onChange={(e) => setRepoLayout(e.target.value as RepoLayout)}
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
            className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 text-sm focus:outline-none focus:border-zinc-500"
          />
          <input
            type="text"
            value={defaultBranch}
            onChange={(e) => setDefaultBranch(e.target.value)}
            placeholder="main"
            className="w-24 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 text-sm focus:outline-none focus:border-zinc-500"
          />
        </div>
      </div>

      {/* Model Selection */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-1">
          AI Model for Development Agents
        </label>
        <p className="text-xs text-zinc-500 mb-2">
          Select which AI model to use for code generation agents. Defaults to Claude Sonnet 4.5.
        </p>

        {modelsLoading ? (
          <div className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-400 text-sm">
            Loading models...
          </div>
        ) : (
          <select
            value={selectedModelId}
            onChange={(e) => setSelectedModelId(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-zinc-500"
          >
            {Object.entries(modelsByProvider).map(([provider, models]) => (
              <optgroup key={provider} label={providerLabels[provider] || provider}>
                {models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.displayName}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        )}
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={!title.trim() || isLoading}
        className="w-full px-4 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? "Starting workflow..." : "Start Team Workflow"}
      </button>
    </form>
  );
}
