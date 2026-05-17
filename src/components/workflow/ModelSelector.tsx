"use client";

import { useState, useEffect } from "react";
import type { ModelConfig } from "@/lib/workflow/types";
import type { AvailableModel } from "@/app/api/models/route";

interface ModelSelectorProps {
  value?: ModelConfig;
  onChange: (model: ModelConfig | undefined) => void;
  className?: string;
}

/**
 * ModelSelector Component
 *
 * Fetches available AI models from /api/models and displays them in a dropdown.
 * Handles loading states, errors, and accessibility.
 *
 * Features:
 * - Fetches models on mount
 * - Shows loading spinner during fetch
 * - Displays error state with helpful message
 * - Keyboard navigation (Tab, Enter, Arrow keys)
 * - Screen reader support (ARIA labels)
 * - Default model (Claude Sonnet 4.5) shown first
 */
export default function ModelSelector({ value, onChange, className = "" }: ModelSelectorProps) {
  const [models, setModels] = useState<AvailableModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch models on mount
  useEffect(() => {
    const fetchModels = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch("/api/models");
        if (!response.ok) {
          throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        // Validate response
        if (!Array.isArray(data)) {
          throw new Error("Invalid response format: expected array of models");
        }

        setModels(data);
      } catch (err) {
        console.error("[ModelSelector] Error fetching models:", err);
        setError(err instanceof Error ? err.message : "Failed to load models");
      } finally {
        setLoading(false);
      }
    };

    fetchModels();
  }, []);

  // Handle selection change
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = e.target.value;

    if (selectedValue === "default" || selectedValue === "") {
      // Use default (no override)
      onChange(undefined);
      return;
    }

    // Parse the selected value (format: "provider:modelId")
    const [provider, modelId] = selectedValue.split(":");

    if (!provider || !modelId) {
      console.warn("[ModelSelector] Invalid selection format:", selectedValue);
      onChange(undefined);
      return;
    }

    // Create ModelConfig based on provider
    const modelConfig: ModelConfig = {
      provider: provider as ModelConfig["provider"],
      modelId,
    };

    onChange(modelConfig);
  };

  // Generate value for select element
  const selectValue = value ? `${value.provider}:${value.modelId}` : "default";

  // Loading state
  if (loading) {
    return (
      <div className={className}>
        <label className="block text-sm font-medium text-zinc-300 mb-1">
          AI Model
        </label>
        <div className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-400 flex items-center gap-2">
          <svg
            className="animate-spin h-4 w-4 text-zinc-400"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
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
          <span className="text-sm">Loading models...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={className}>
        <label className="block text-sm font-medium text-zinc-300 mb-1">
          AI Model
        </label>
        <div
          className="w-full px-3 py-2 bg-red-900/20 border border-red-700/50 rounded-lg text-red-400 text-sm"
          role="alert"
          aria-live="polite"
        >
          <p className="font-medium">Failed to load models</p>
          <p className="text-xs mt-1 text-red-300">{error}</p>
          <p className="text-xs mt-1 text-red-300">Will use default model (Claude Sonnet 4.5)</p>
        </div>
      </div>
    );
  }

  // Empty model list (disable dropdown)
  if (models.length === 0) {
    return (
      <div className={className}>
        <label className="block text-sm font-medium text-zinc-300 mb-1">
          AI Model
        </label>
        <select
          disabled
          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-500 cursor-not-allowed"
          aria-label="AI model selection (no models available)"
        >
          <option>No models available</option>
        </select>
        <p className="text-xs text-zinc-500 mt-1">
          Configure AWS_REGION, OPENAI_API_KEY, or GOOGLE_API_KEY to enable model selection
        </p>
      </div>
    );
  }

  // Sort models: default first, then by provider and name
  const sortedModels = [...models].sort((a, b) => {
    if (a.isDefault) return -1;
    if (b.isDefault) return 1;
    if (a.provider !== b.provider) return a.provider.localeCompare(b.provider);
    return a.displayName.localeCompare(b.displayName);
  });

  return (
    <div className={className}>
      <label htmlFor="model-selector" className="block text-sm font-medium text-zinc-300 mb-1">
        AI Model
      </label>
      <select
        id="model-selector"
        value={selectValue}
        onChange={handleChange}
        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-zinc-500 cursor-pointer"
        aria-label="Select AI model for workflow agents"
        aria-describedby="model-selector-description"
      >
        <option value="default">Use Default Model</option>
        {sortedModels.map((model) => (
          <option
            key={`${model.provider}:${model.modelId}`}
            value={`${model.provider}:${model.modelId}`}
          >
            {model.displayName}
            {model.description && ` — ${model.description}`}
          </option>
        ))}
      </select>
      <p id="model-selector-description" className="text-xs text-zinc-500 mt-1">
        Choose which AI model to use for design and development agents.
        {value && (
          <span className="text-zinc-400">
            {" "}
            Selected: <span className="font-medium">{value.provider}</span> /{" "}
            <span className="font-mono text-[11px]">{value.modelId}</span>
          </span>
        )}
      </p>
    </div>
  );
}
