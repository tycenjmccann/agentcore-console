"use client";

import { useState, useEffect, useCallback } from "react";
import type { 
  WorkflowInput, 
  IntakeSource, 
  RepoConfig, 
  RepoLayout,
  ModelConfig,
  AvailableModel,
  ModelProvider 
} from "@/lib/workflow/types";
import { ChevronDown, Loader2, AlertCircle, RefreshCw, Star } from "lucide-react";

interface IntakeFormProps {
  onSubmit: (input: WorkflowInput) => void;
  isLoading?: boolean;
}

/**
 * Grouped models by provider for display in the dropdown.
 */
interface GroupedModels {
  provider: ModelProvider;
  displayName: string;
  models: AvailableModel[];
}

/**
 * Provider display names for the dropdown groups.
 */
const PROVIDER_DISPLAY_NAMES: Record<ModelProvider, string> = {
  bedrock: "AWS Bedrock",
  openai: "OpenAI",
  gemini: "Google Gemini",
};

/**
 * Provider order for consistent display.
 */
const PROVIDER_ORDER: ModelProvider[] = ["bedrock", "openai", "gemini"];

export default function IntakeForm({ onSubmit, isLoading }: IntakeFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sources, setSources] = useState<IntakeSource[]>([]);
  const [newSourceUrl, setNewSourceUrl] = useState("");
  const [repoLayout, setRepoLayout] = useState<RepoLayout>("monorepo");
  const [repoUrl, setRepoUrl] = useState("");
  const [defaultBranch, setDefaultBranch] = useState("main");
  
  // Model selector state
  const [models, setModels] = useState<AvailableModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<ModelConfig | null>(null);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  /**
   * Fetch available models from the API.
   */
  const fetchModels = useCallback(async () => {
    setModelsLoading(true);
    setModelsError(null);
    
    try {
      const response = await fetch("/api/models");
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to load models (${response.status})`);
      }
      
      const data = await response.json();
      const fetchedModels: AvailableModel[] = data.models || [];
      
      setModels(fetchedModels);
      
      // Set default model if none selected
      if (!selectedModel) {
        const defaultModel = fetchedModels.find(m => m.isDefault);
        if (defaultModel) {
          setSelectedModel({
            provider: defaultModel.provider,
            modelId: defaultModel.modelId,
          } as ModelConfig);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load models";
      setModelsError(message);
      console.error("Error fetching models:", error);
    } finally {
      setModelsLoading(false);
    }
  }, [selectedModel]);

  // Fetch models on component mount
  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest("[data-model-selector]")) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isDropdownOpen]);

  /**
   * Group models by provider for display.
   */
  const groupedModels: GroupedModels[] = PROVIDER_ORDER
    .map(provider => ({
      provider,
      displayName: PROVIDER_DISPLAY_NAMES[provider],
      models: models.filter(m => m.provider === provider),
    }))
    .filter(group => group.models.length > 0);

  /**
   * Get the currently selected model info for display.
   */
  const selectedModelInfo = selectedModel 
    ? models.find(m => m.provider === selectedModel.provider && m.modelId === selectedModel.modelId)
    : null;

  /**
   * Handle model selection.
   */
  const handleModelSelect = (model: AvailableModel) => {
    setSelectedModel({
      provider: model.provider,
      modelId: model.modelId,
    } as ModelConfig);
    setIsDropdownOpen(false);
  };

  /**
   * Handle keyboard navigation in dropdown.
   */
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      setIsDropdownOpen(false);
    } else if (event.key === "Enter" && !isDropdownOpen) {
      event.preventDefault();
      setIsDropdownOpen(true);
    }
  };

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

    // Build WorkflowInput with optional modelOverride
    const workflowInput: WorkflowInput = {
      title: title.trim(),
      description: description.trim(),
      repoConfig,
      sources,
    };

    // Only include modelOverride if a model is selected and it's not the default
    // (to avoid unnecessary override when using default)
    if (selectedModel) {
      workflowInput.modelOverride = selectedModel;
    }

    onSubmit(workflowInput);
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

      {/* AI Model Selector */}
      <div>
        <label 
          id="model-selector-label"
          className="block text-sm font-medium text-zinc-300 mb-1"
        >
          AI Model
        </label>
        <p 
          id="model-selector-description"
          className="text-xs text-zinc-500 mb-2"
        >
          Select the AI model for development agents (default: Claude Sonnet 4.5)
        </p>

        {/* Loading State */}
        {modelsLoading && (
          <div className="flex items-center gap-2 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Loading models...</span>
          </div>
        )}

        {/* Error State */}
        {modelsError && !modelsLoading && (
          <div className="flex items-center justify-between px-3 py-2 bg-red-900/20 border border-red-700/50 rounded-lg">
            <div className="flex items-center gap-2 text-red-400">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">{modelsError}</span>
            </div>
            <button
              type="button"
              onClick={fetchModels}
              className="flex items-center gap-1 px-2 py-1 text-xs text-zinc-300 hover:text-white bg-zinc-700 hover:bg-zinc-600 rounded transition-colors"
              aria-label="Retry loading models"
            >
              <RefreshCw className="w-3 h-3" />
              Retry
            </button>
          </div>
        )}

        {/* Model Selector Dropdown */}
        {!modelsLoading && !modelsError && (
          <div className="relative" data-model-selector>
            <button
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              onKeyDown={handleKeyDown}
              className="w-full flex items-center justify-between px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-left focus:outline-none focus:border-zinc-500 hover:border-zinc-600 transition-colors"
              aria-haspopup="listbox"
              aria-expanded={isDropdownOpen}
              aria-labelledby="model-selector-label"
              aria-describedby="model-selector-description"
            >
              <div className="flex items-center gap-2">
                {selectedModelInfo ? (
                  <>
                    <span className="text-zinc-100">{selectedModelInfo.displayName}</span>
                    {selectedModelInfo.isDefault && (
                      <span className="flex items-center gap-1 px-1.5 py-0.5 bg-amber-600/20 text-amber-400 rounded text-xs font-medium">
                        <Star className="w-3 h-3" />
                        Default
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-zinc-500">Select a model...</span>
                )}
              </div>
              <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`} />
            </button>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <div 
                className="absolute z-50 w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl max-h-64 overflow-y-auto"
                role="listbox"
                aria-labelledby="model-selector-label"
              >
                {groupedModels.map((group) => (
                  <div key={group.provider}>
                    {/* Group Header */}
                    <div className="px-3 py-1.5 bg-zinc-900/50 text-xs font-semibold text-zinc-500 uppercase tracking-wide sticky top-0">
                      {group.displayName}
                    </div>
                    {/* Group Items */}
                    {group.models.map((model) => {
                      const isSelected = selectedModel?.provider === model.provider && 
                                        selectedModel?.modelId === model.modelId;
                      return (
                        <button
                          key={`${model.provider}-${model.modelId}`}
                          type="button"
                          onClick={() => handleModelSelect(model)}
                          className={`w-full px-3 py-2 text-left hover:bg-zinc-700/50 focus:bg-zinc-700/50 focus:outline-none transition-colors ${
                            isSelected ? "bg-zinc-700/30" : ""
                          }`}
                          role="option"
                          aria-selected={isSelected}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`text-sm ${isSelected ? "text-white font-medium" : "text-zinc-200"}`}>
                              {model.displayName}
                            </span>
                            {model.isDefault && (
                              <span className="flex items-center gap-1 px-1.5 py-0.5 bg-amber-600/20 text-amber-400 rounded text-xs font-medium">
                                <Star className="w-3 h-3" />
                                Default
                              </span>
                            )}
                          </div>
                          {model.description && (
                            <p className="text-xs text-zinc-500 mt-0.5">
                              {model.description}
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
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
