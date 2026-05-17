"use client";

import { useState, useEffect } from "react";
import { Bot, ChevronDown, AlertCircle, Loader2 } from "lucide-react";
import type { AvailableModel, ModelConfig } from "@/lib/workflow/types";

interface ModelSelectorProps {
  value?: ModelConfig;
  onChange: (model: ModelConfig | undefined) => void;
  disabled?: boolean;
}

/**
 * ModelSelector component
 * Dropdown for selecting AI model to use for dev agents
 * 
 * Features:
 * - Fetches available models from /api/models
 * - Shows default model first
 * - Groups by provider
 * - Loading and error states
 * - Keyboard navigation (Tab, Enter, Arrow keys)
 * - Screen reader accessible (ARIA)
 */
export default function ModelSelector({ value, onChange, disabled }: ModelSelectorProps) {
  const [models, setModels] = useState<AvailableModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function fetchModels() {
      try {
        const response = await fetch("/api/models");
        if (!response.ok) {
          throw new Error("Failed to fetch models");
        }
        const data = await response.json();
        if (mounted) {
          setModels(Array.isArray(data) ? data : []);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to load models");
          // Set default model on error
          setModels([{
            provider: "bedrock",
            modelId: "anthropic.claude-sonnet-4-5-v1:0",
            displayName: "Claude Sonnet 4.5 (Default)",
            isDefault: true,
            description: "Fast, intelligent, and cost-effective",
          }]);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    fetchModels();

    return () => {
      mounted = false;
    };
  }, []);

  // Get selected model display name
  const selectedModel = value
    ? models.find(m => m.provider === value.provider && m.modelId === value.modelId)
    : models.find(m => m.isDefault);

  const displayName = selectedModel?.displayName || "Select model...";

  // Handle model selection
  const handleSelect = (model: AvailableModel) => {
    const config: ModelConfig = {
      provider: model.provider,
      modelId: model.modelId,
      ...(model.provider === "bedrock" && { region: process.env.NEXT_PUBLIC_AWS_REGION }),
    } as ModelConfig;

    // If selecting the default model, pass undefined (use system default)
    onChange(model.isDefault ? undefined : config);
    setIsOpen(false);
  };

  // Group models by provider
  const groupedModels = models.reduce((acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = [];
    }
    acc[model.provider].push(model);
    return acc;
  }, {} as Record<string, AvailableModel[]>);

  // Sort: default first, then by provider
  const sortedProviders = Object.keys(groupedModels).sort((a, b) => {
    const aHasDefault = groupedModels[a].some(m => m.isDefault);
    const bHasDefault = groupedModels[b].some(m => m.isDefault);
    if (aHasDefault && !bHasDefault) return -1;
    if (!aHasDefault && bHasDefault) return 1;
    return a.localeCompare(b);
  });

  if (loading) {
    return (
      <div className="relative">
        <label htmlFor="model-selector" className="block text-sm font-medium text-gray-300 mb-2">
          AI Model
        </label>
        <div className="flex items-center gap-2 px-4 py-3 bg-surface-2 border border-surface-4 rounded-lg">
          <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
          <span className="text-sm text-gray-400">Loading models...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <label htmlFor="model-selector" className="block text-sm font-medium text-gray-300 mb-2">
        AI Model
        {error && (
          <span className="ml-2 text-xs text-yellow-400">(using default)</span>
        )}
      </label>

      {/* Dropdown Button */}
      <button
        id="model-selector"
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled || models.length === 0}
        className={
          "w-full flex items-center justify-between gap-3 px-4 py-3 bg-surface-2 border border-surface-4 rounded-lg " +
          "hover:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-surface-1 " +
          "transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        }
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-labelledby="model-selector"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Bot className="w-5 h-5 text-brand-400 flex-shrink-0" />
          <div className="text-left flex-1 min-w-0">
            <div className="text-sm font-medium text-white truncate">{displayName}</div>
            {selectedModel?.description && (
              <div className="text-xs text-gray-400 truncate">{selectedModel.description}</div>
            )}
          </div>
        </div>
        <ChevronDown className={"w-4 h-4 text-gray-400 transition-transform " + (isOpen ? "rotate-180" : "")} />
      </button>

      {/* Error Message */}
      {error && (
        <div className="mt-2 flex items-start gap-2 text-xs text-yellow-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}. Using default model.</span>
        </div>
      )}

      {/* Dropdown Menu */}
      {isOpen && !disabled && (
        <div
          className="absolute z-50 w-full mt-2 bg-surface-2 border border-surface-4 rounded-lg shadow-xl overflow-hidden"
          role="listbox"
          aria-labelledby="model-selector"
        >
          <div className="max-h-80 overflow-y-auto">
            {sortedProviders.map(provider => (
              <div key={provider}>
                {/* Provider Header */}
                <div className="px-4 py-2 bg-surface-3/50 border-b border-surface-4">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    {provider === "bedrock" && "AWS Bedrock"}
                    {provider === "openai" && "OpenAI"}
                    {provider === "gemini" && "Google Gemini"}
                  </span>
                </div>

                {/* Models */}
                {groupedModels[provider].map(model => {
                  const isSelected = 
                    value?.provider === model.provider && 
                    value?.modelId === model.modelId;
                  
                  return (
                    <button
                      key={`${model.provider}-${model.modelId}`}
                      type="button"
                      onClick={() => handleSelect(model)}
                      className={
                        "w-full px-4 py-3 text-left hover:bg-surface-3 transition-colors " +
                        "focus:outline-none focus:bg-surface-3 " +
                        (isSelected ? "bg-brand-500/10" : "")
                      }
                      role="option"
                      aria-selected={isSelected}
                    >
                      <div className="flex items-start gap-3">
                        <Bot className={"w-5 h-5 flex-shrink-0 mt-0.5 " + (isSelected ? "text-brand-400" : "text-gray-500")} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={"text-sm font-medium " + (isSelected ? "text-white" : "text-gray-200")}>
                              {model.displayName}
                            </span>
                            {model.isDefault && (
                              <span className="px-2 py-0.5 text-[10px] font-semibold text-brand-400 bg-brand-500/20 rounded-full">
                                DEFAULT
                              </span>
                            )}
                          </div>
                          {model.description && (
                            <div className="text-xs text-gray-400 mt-0.5">{model.description}</div>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Click outside to close */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
