"use client";

import { useState, useEffect } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ModelConfig,
  SupportedModel,
  SUPPORTED_MODELS,
  DEFAULT_MODEL_ID,
  ModelProvider,
} from "@/lib/types/model-config";

interface ModelSelectorProps {
  value?: ModelConfig;
  onChange: (config: ModelConfig) => void;
  className?: string;
}

interface ProviderAvailability {
  bedrock: boolean;
  openai: boolean;
  gemini: boolean;
}

export default function ModelSelector({
  value,
  onChange,
  className,
}: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [availability, setAvailability] = useState<ProviderAvailability>({
    bedrock: true,
    openai: false,
    gemini: false,
  });
  const [loading, setLoading] = useState(true);

  // Fetch provider availability on mount
  useEffect(() => {
    async function checkAvailability() {
      try {
        const response = await fetch('/api/models/availability');
        if (response.ok) {
          const data = await response.json();
          setAvailability({
            bedrock: true, // Always available
            openai: data.openai || false,
            gemini: data.gemini || false,
          });
        }
      } catch (error) {
        console.error('Failed to check model availability:', error);
      } finally {
        setLoading(false);
      }
    }
    checkAvailability();
  }, []);

  // Set default value if not provided
  useEffect(() => {
    if (!value && !loading) {
      const defaultModel = SUPPORTED_MODELS.find(
        (m) => m.id === DEFAULT_MODEL_ID
      );
      if (defaultModel) {
        onChange(createModelConfig(defaultModel));
      }
    }
  }, [value, onChange, loading]);

  const createModelConfig = (model: SupportedModel): ModelConfig => {
    const config: ModelConfig = {
      provider: model.provider,
      modelId: model.modelId,
      displayName: model.displayName,
    };

    if (model.provider === 'bedrock') {
      config.bedrockModelConfig = { modelId: model.modelId };
    } else if (model.provider === 'openai') {
      config.openAiModelConfig = {
        modelId: model.modelId,
        apiKeyArn: process.env.NEXT_PUBLIC_OPENAI_API_KEY_ARN || '',
      };
    } else if (model.provider === 'gemini') {
      config.geminiModelConfig = {
        modelId: model.modelId,
        apiKeyArn: process.env.NEXT_PUBLIC_GEMINI_API_KEY_ARN || '',
      };
    }

    return config;
  };

  const handleSelect = (model: SupportedModel) => {
    const config = createModelConfig(model);
    onChange(config);
    setIsOpen(false);
  };

  const isModelAvailable = (model: SupportedModel): boolean => {
    if (model.provider === 'bedrock') return true;
    return availability[model.provider] || false;
  };

  // Group models by provider
  const groupedModels = {
    bedrock: SUPPORTED_MODELS.filter((m) => m.provider === 'bedrock'),
    openai: SUPPORTED_MODELS.filter((m) => m.provider === 'openai'),
    gemini: SUPPORTED_MODELS.filter((m) => m.provider === 'gemini'),
  };

  const providerLabels = {
    bedrock: 'Amazon Bedrock',
    openai: 'OpenAI',
    gemini: 'Google Gemini',
  };

  const selectedModel = value
    ? SUPPORTED_MODELS.find((m) => m.modelId === value.modelId)
    : SUPPORTED_MODELS.find((m) => m.id === DEFAULT_MODEL_ID);

  return (
    <div className={cn("relative", className)}>
      <label
        htmlFor="model-selector"
        className="block text-sm font-medium text-gray-300 mb-2"
      >
        Model Selection
      </label>

      {/* Selected Value Display */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={loading}
        className={cn(
          "w-full flex items-center justify-between px-4 py-2.5 rounded-lg border transition-colors",
          "bg-surface-2 border-surface-4 text-gray-200",
          "hover:bg-surface-3 hover:border-surface-5",
          "focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500",
          loading && "opacity-50 cursor-not-allowed"
        )}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="Select model"
      >
        <div className="flex flex-col items-start">
          <span className="text-sm font-medium">
            {loading
              ? 'Loading models...'
              : selectedModel?.displayName || 'Select a model'}
          </span>
          {selectedModel && (
            <span className="text-xs text-gray-500">
              {providerLabels[selectedModel.provider]}
            </span>
          )}
        </div>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-gray-400 transition-transform",
            isOpen && "transform rotate-180"
          )}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Options List */}
          <div
            className="absolute z-50 w-full mt-2 bg-surface-2 border border-surface-4 rounded-lg shadow-xl max-h-96 overflow-y-auto"
            role="listbox"
          >
            {/* Bedrock Models */}
            <div className="py-2">
              <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {providerLabels.bedrock}
              </div>
              {groupedModels.bedrock.map((model) => (
                <ModelOption
                  key={model.id}
                  model={model}
                  isSelected={selectedModel?.id === model.id}
                  isAvailable={true}
                  onSelect={handleSelect}
                />
              ))}
            </div>

            {/* OpenAI Models */}
            <div className="py-2 border-t border-surface-4">
              <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {providerLabels.openai}
              </div>
              {groupedModels.openai.map((model) => (
                <ModelOption
                  key={model.id}
                  model={model}
                  isSelected={selectedModel?.id === model.id}
                  isAvailable={isModelAvailable(model)}
                  onSelect={handleSelect}
                />
              ))}
            </div>

            {/* Gemini Models */}
            <div className="py-2 border-t border-surface-4">
              <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {providerLabels.gemini}
              </div>
              {groupedModels.gemini.map((model) => (
                <ModelOption
                  key={model.id}
                  model={model}
                  isSelected={selectedModel?.id === model.id}
                  isAvailable={isModelAvailable(model)}
                  onSelect={handleSelect}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

interface ModelOptionProps {
  model: SupportedModel;
  isSelected: boolean;
  isAvailable: boolean;
  onSelect: (model: SupportedModel) => void;
}

function ModelOption({
  model,
  isSelected,
  isAvailable,
  onSelect,
}: ModelOptionProps) {
  const handleClick = () => {
    if (isAvailable) {
      onSelect(model);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!isAvailable}
      className={cn(
        "w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors",
        isAvailable
          ? "hover:bg-surface-3 cursor-pointer"
          : "opacity-50 cursor-not-allowed",
        isSelected && "bg-brand-600/20"
      )}
      role="option"
      aria-selected={isSelected}
      aria-disabled={!isAvailable}
      title={!isAvailable ? 'API key not configured' : undefined}
    >
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-sm font-medium",
              isSelected ? "text-brand-400" : "text-gray-200",
              !isAvailable && "text-gray-500"
            )}
          >
            {model.displayName}
          </span>
          {!isAvailable && (
            <span className="text-xs px-2 py-0.5 bg-surface-4 text-gray-500 rounded-full">
              API key not configured
            </span>
          )}
        </div>
      </div>

      {isSelected && (
        <Check className="w-4 h-4 text-brand-400 flex-shrink-0" />
      )}
    </button>
  );
}
