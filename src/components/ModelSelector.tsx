"use client";

import { useState, useEffect } from "react";
import type { AvailableModel, ModelConfig } from "@/lib/workflow/types";

interface ModelSelectorProps {
  value?: ModelConfig;
  onChange: (model: ModelConfig | undefined) => void;
  disabled?: boolean;
}

export default function ModelSelector({ value, onChange, disabled = false }: ModelSelectorProps) {
  const [models, setModels] = useState<AvailableModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchModels() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch("/api/models");
        if (!response.ok) {
          throw new Error(`Failed to fetch models: ${response.statusText}`);
        }
        const data = await response.json();
        setModels(data.models || []);
      } catch (err) {
        console.error("Error fetching models:", err);
        setError(err instanceof Error ? err.message : "Failed to load models");
      } finally {
        setLoading(false);
      }
    }

    fetchModels();
  }, []);

  const selectedValue = value
    ? `${value.provider}:${value.modelId}`
    : "";

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = e.target.value;
    if (!selectedValue) {
      onChange(undefined);
      return;
    }

    const [provider, ...modelIdParts] = selectedValue.split(":");
    const modelId = modelIdParts.join(":");

    if (provider === "bedrock") {
      onChange({ provider: "bedrock", modelId });
    } else if (provider === "openai") {
      onChange({ provider: "openai", modelId });
    } else if (provider === "gemini") {
      onChange({ provider: "gemini", modelId });
    }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-300">
          Model Selection
        </label>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
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
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Loading available models...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-300">
          Model Selection
        </label>
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-sm text-red-400">
            {error}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Will use default model (Claude Sonnet 4.5)
          </p>
        </div>
      </div>
    );
  }

  if (models.length === 0) {
    return (
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-300">
          Model Selection
        </label>
        <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <p className="text-sm text-yellow-400">
            No models available
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Will use default model (Claude Sonnet 4.5)
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label htmlFor="model-selector" className="block text-sm font-medium text-gray-300">
        Model Selection
      </label>
      <select
        id="model-selector"
        value={selectedValue}
        onChange={handleChange}
        disabled={disabled}
        className="w-full px-4 py-2.5 bg-surface-2 border border-surface-4 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Select AI model for workflow agents"
      >
        <option value="">Use Default (Claude Sonnet 4.5)</option>
        {models
          .sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0))
          .map((model) => (
            <option
              key={`${model.provider}:${model.modelId}`}
              value={`${model.provider}:${model.modelId}`}
            >
              {model.displayName}
              {model.isDefault ? " (Default)" : ""}
              {model.description ? ` - ${model.description}` : ""}
            </option>
          ))}
      </select>
      <p className="text-xs text-gray-500">
        Select which AI model to use for design and development agents. Requirements agent always uses the default.
      </p>
    </div>
  );
}
