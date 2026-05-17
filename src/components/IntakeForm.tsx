"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronDown, Loader2, AlertCircle, Bot, Sparkles, Check } from "lucide-react";
import type { ModelConfig, ModelProvider } from "@/lib/workflow/types";
import { DEFAULT_MODEL } from "@/lib/workflow/types";

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Represents an available AI model that can be selected by users.
 */
export interface AvailableModel {
  provider: ModelProvider;
  modelId: string;
  displayName: string;
  description: string;
  isDefault: boolean;
}

export interface ModelsResponse {
  models: AvailableModel[];
  defaultModel: ModelConfig;
}

export interface IntakeFormProps {
  onSubmit?: (data: IntakeFormData) => void;
  isSubmitting?: boolean;
}

export interface IntakeFormData {
  title: string;
  description: string;
  modelConfig: ModelConfig;
}

// ─── Provider Display Config ─────────────────────────────────────────────────

const PROVIDER_CONFIG: Record<ModelProvider, { label: string; color: string; bgColor: string }> = {
  bedrock: {
    label: "AWS Bedrock",
    color: "text-orange-400",
    bgColor: "bg-orange-400/10",
  },
  openai: {
    label: "OpenAI",
    color: "text-green-400",
    bgColor: "bg-green-400/10",
  },
  gemini: {
    label: "Google Gemini",
    color: "text-blue-400",
    bgColor: "bg-blue-400/10",
  },
};

// ─── Model Selector Dropdown ─────────────────────────────────────────────────

interface ModelSelectorProps {
  selectedModel: ModelConfig | null;
  availableModels: AvailableModel[];
  isLoading: boolean;
  error: string | null;
  onSelect: (model: ModelConfig) => void;
  disabled?: boolean;
}

function ModelSelector({
  selectedModel,
  availableModels,
  isLoading,
  error,
  onSelect,
  disabled = false,
}: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Group models by provider
  const groupedModels = availableModels.reduce(
    (acc, model) => {
      if (!acc[model.provider]) {
        acc[model.provider] = [];
      }
      acc[model.provider].push(model);
      return acc;
    },
    {} as Record<ModelProvider, AvailableModel[]>
  );

  // Find selected model details
  const selectedModelDetails = availableModels.find(
    (m) => m.provider === selectedModel?.provider && m.modelId === selectedModel?.modelId
  );

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;

      switch (e.key) {
        case "Enter":
        case " ":
          e.preventDefault();
          setIsOpen(!isOpen);
          break;
        case "Escape":
          setIsOpen(false);
          break;
        case "ArrowDown":
          if (!isOpen) {
            e.preventDefault();
            setIsOpen(true);
          }
          break;
      }
    },
    [isOpen, disabled]
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-model-selector]")) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div className="space-y-2" data-model-selector>
      <label
        htmlFor="model-selector"
        className="block text-sm font-medium text-gray-300"
      >
        AI Model for Dev Agents
      </label>

      {/* Error State */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-amber-400 bg-amber-400/10 px-3 py-2 rounded-lg">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Dropdown Button */}
      <div className="relative">
        <button
          id="model-selector"
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          onKeyDown={handleKeyDown}
          disabled={disabled || isLoading}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-labelledby="model-selector-label"
          className={`
            w-full flex items-center justify-between gap-3
            bg-surface-3 border border-surface-4 rounded-lg
            px-4 py-3 text-left
            transition-colors
            focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-surface-2
            ${disabled || isLoading ? "opacity-50 cursor-not-allowed" : "hover:border-brand-500/50 cursor-pointer"}
          `}
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 text-brand-400 animate-spin" />
              <span className="text-gray-400">Loading models...</span>
            </div>
          ) : selectedModelDetails ? (
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${PROVIDER_CONFIG[selectedModelDetails.provider].bgColor}`}
              >
                <Bot className={`w-4 h-4 ${PROVIDER_CONFIG[selectedModelDetails.provider].color}`} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium truncate">
                    {selectedModelDetails.displayName}
                  </span>
                  {selectedModelDetails.isDefault && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-brand-500/20 text-brand-400 rounded font-medium uppercase">
                      Default
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 truncate">
                  {selectedModelDetails.description}
                </p>
              </div>
            </div>
          ) : (
            <span className="text-gray-400">Select a model...</span>
          )}

          <ChevronDown
            className={`w-5 h-5 text-gray-500 flex-shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </button>

        {/* Dropdown Menu */}
        {isOpen && !isLoading && (
          <div
            role="listbox"
            aria-labelledby="model-selector-label"
            className={`
              absolute z-50 w-full mt-2
              bg-surface-2 border border-surface-4 rounded-xl
              shadow-xl shadow-black/40
              max-h-80 overflow-y-auto scrollbar-thin
            `}
          >
            {Object.entries(groupedModels).map(([provider, models]) => (
              <div key={provider} className="py-1">
                {/* Provider Group Header */}
                <div className="px-4 py-2 flex items-center gap-2">
                  <Sparkles className={`w-3 h-3 ${PROVIDER_CONFIG[provider as ModelProvider].color}`} />
                  <span className={`text-xs font-semibold uppercase tracking-wide ${PROVIDER_CONFIG[provider as ModelProvider].color}`}>
                    {PROVIDER_CONFIG[provider as ModelProvider].label}
                  </span>
                </div>

                {/* Provider Models */}
                {models.map((model) => {
                  const isSelected =
                    selectedModel?.provider === model.provider &&
                    selectedModel?.modelId === model.modelId;

                  return (
                    <button
                      key={`${model.provider}-${model.modelId}`}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        onSelect({ provider: model.provider, modelId: model.modelId } as ModelConfig);
                        setIsOpen(false);
                      }}
                      className={`
                        w-full px-4 py-3 flex items-center gap-3
                        text-left transition-colors
                        ${isSelected ? "bg-brand-500/10" : "hover:bg-surface-3"}
                      `}
                    >
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${PROVIDER_CONFIG[model.provider].bgColor}`}
                      >
                        <Bot className={`w-4 h-4 ${PROVIDER_CONFIG[model.provider].color}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-200 font-medium">
                            {model.displayName}
                          </span>
                          {model.isDefault && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-brand-500/20 text-brand-400 rounded font-medium uppercase">
                              Default
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">{model.description}</p>
                      </div>
                      {isSelected && (
                        <Check className="w-4 h-4 text-brand-400 flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Help Text */}
      <p className="text-xs text-gray-600">
        This model will be used for all development agents in this workflow.
      </p>
    </div>
  );
}

// ─── IntakeForm Component ────────────────────────────────────────────────────

export default function IntakeForm({ onSubmit, isSubmitting = false }: IntakeFormProps) {
  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  // Model selector state
  const [selectedModel, setSelectedModel] = useState<ModelConfig | null>(null);
  const [availableModels, setAvailableModels] = useState<AvailableModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsError, setModelsError] = useState<string | null>(null);

  // Fetch available models on mount
  useEffect(() => {
    const fetchModels = async () => {
      setModelsLoading(true);
      setModelsError(null);

      try {
        const response = await fetch("/api/models");

        if (!response.ok) {
          throw new Error(`Failed to fetch models: ${response.status}`);
        }

        const data: ModelsResponse = await response.json();

        setAvailableModels(data.models);
        setSelectedModel(data.defaultModel);
      } catch (error) {
        console.error("Error fetching models:", error);
        setModelsError("Failed to load models. Using default.");
        // Fallback to default model
        setSelectedModel(DEFAULT_MODEL);
        // Provide fallback model list
        setAvailableModels([
          {
            provider: "bedrock",
            modelId: "anthropic.claude-sonnet-4-5-v1",
            displayName: "Claude Sonnet 4.5",
            description: "Balanced performance and cost (default)",
            isDefault: true,
          },
        ]);
      } finally {
        setModelsLoading(false);
      }
    };

    fetchModels();
  }, []);

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedModel) return;

    onSubmit?.({
      title,
      description,
      modelConfig: selectedModel,
    });
  };

  const isFormValid = title.trim() && description.trim() && selectedModel;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Title Input */}
      <div className="space-y-2">
        <label htmlFor="title" className="block text-sm font-medium text-gray-300">
          Feature Title
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter a descriptive title for this feature..."
          disabled={isSubmitting}
          className={`
            w-full bg-surface-3 border border-surface-4 rounded-lg
            px-4 py-3 text-white placeholder:text-gray-600
            focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-surface-2
            transition-colors
            ${isSubmitting ? "opacity-50 cursor-not-allowed" : "hover:border-brand-500/50"}
          `}
        />
      </div>

      {/* Description Input */}
      <div className="space-y-2">
        <label htmlFor="description" className="block text-sm font-medium text-gray-300">
          Description
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the feature requirements in detail..."
          rows={5}
          disabled={isSubmitting}
          className={`
            w-full bg-surface-3 border border-surface-4 rounded-lg
            px-4 py-3 text-white placeholder:text-gray-600
            focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-surface-2
            transition-colors resize-none
            ${isSubmitting ? "opacity-50 cursor-not-allowed" : "hover:border-brand-500/50"}
          `}
        />
      </div>

      {/* Model Selector */}
      <ModelSelector
        selectedModel={selectedModel}
        availableModels={availableModels}
        isLoading={modelsLoading}
        error={modelsError}
        onSelect={setSelectedModel}
        disabled={isSubmitting}
      />

      {/* Submit Button */}
      <div className="pt-4">
        <button
          type="submit"
          disabled={!isFormValid || isSubmitting}
          className={`
            w-full flex items-center justify-center gap-2
            btn-primary py-3 text-base font-semibold
            ${(!isFormValid || isSubmitting) ? "opacity-50 cursor-not-allowed" : ""}
          `}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Starting Workflow...
            </>
          ) : (
            "Start Workflow"
          )}
        </button>
      </div>
    </form>
  );
}