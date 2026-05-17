import { useState, useEffect } from "react";
import { ChevronDown, Loader2, AlertCircle, Sparkles } from "lucide-react";
import type { ModelConfig, AvailableModel, ModelsResponse } from "@/lib/workflow/model-config";

interface ModelSelectorProps {
  value: ModelConfig | null;
  onChange: (config: ModelConfig) => void;
  disabled?: boolean;
}

export function ModelSelector({ value, onChange, disabled }: ModelSelectorProps) {
  const [models, setModels] = useState<AvailableModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    fetchModels();
  }, []);

  const fetchModels = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/models");
      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }
      const data: ModelsResponse = await response.json();
      setModels(data.models);
      
      // If no value is set, default to the default model
      if (!value) {
        const defaultModel = data.models.find((m) => m.isDefault);
        if (defaultModel) {
          onChange({
            provider: defaultModel.provider,
            modelId: defaultModel.modelId,
          });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load models");
    } finally {
      setLoading(false);
    }
  };

  const selectedModel = value
    ? models.find((m) => m.provider === value.provider && m.modelId === value.modelId)
    : null;

  const handleSelect = (model: AvailableModel) => {
    onChange({
      provider: model.provider,
      modelId: model.modelId,
    });
    setIsOpen(false);
  };

  // Group models by provider
  const groupedModels = models.reduce(
    (acc, model) => {
      if (!acc[model.provider]) {
        acc[model.provider] = [];
      }
      acc[model.provider].push(model);
      return acc;
    },
    {} as Record<string, AvailableModel[]>
  );

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2.5 bg-surface-2 border border-surface-4 rounded-lg">
        <Loader2 className="w-4 h-4 text-gray-500 animate-spin" />
        <span className="text-sm text-gray-500">Loading models...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-3 py-2.5 bg-red-400/10 border border-red-400/30 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-400" />
          <span className="text-sm text-red-400">{error}</span>
        </div>
        <button
          onClick={fetchModels}
          className="text-xs text-gray-500 hover:text-gray-300 underline"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="relative" data-testid="model-selector">
      <label className="block text-xs font-medium text-gray-400 mb-1.5">
        AI Model
      </label>
      
      {/* Selected Model Display */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-surface-2 border border-surface-4 rounded-lg hover:border-brand-500/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        data-testid="model-selector-button"
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {selectedModel ? (
            <>
              <Sparkles className="w-4 h-4 text-brand-400 flex-shrink-0" />
              <div className="text-left flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-200 font-medium truncate">
                    {selectedModel.displayName}
                  </span>
                  {selectedModel.isDefault && (
                    <span className="text-[10px] bg-brand-600/20 text-brand-400 px-1.5 py-0.5 rounded-full uppercase font-semibold flex-shrink-0">
                      Default
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-500 capitalize">
                  [{selectedModel.provider}]
                </span>
              </div>
            </>
          ) : (
            <span className="text-sm text-gray-500">Select a model</span>
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-gray-500 transition-transform flex-shrink-0 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown Menu */}
          <div className="absolute z-20 w-full mt-1 bg-surface-1 border border-surface-4 rounded-lg shadow-lg max-h-[400px] overflow-y-auto" data-testid="model-dropdown">
            {Object.entries(groupedModels).map(([provider, providerModels]) => (
              <div key={provider} className="border-b border-surface-4 last:border-b-0">
                <div className="px-3 py-2 bg-surface-2/50">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {provider}
                  </span>
                </div>
                <div className="py-1">
                  {providerModels.map((model) => (
                    <button
                      key={`${model.provider}-${model.modelId}`}
                      type="button"
                      onClick={() => handleSelect(model)}
                      className={`w-full text-left px-3 py-2.5 hover:bg-surface-3 transition-colors ${
                        selectedModel?.provider === model.provider &&
                        selectedModel?.modelId === model.modelId
                          ? "bg-brand-600/10"
                          : ""
                      }`}
                      data-testid={`model-option-${model.provider}-${model.modelId}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-200 font-medium">
                              {model.displayName}
                            </span>
                            {model.isDefault && (
                              <span className="text-[10px] bg-brand-600/20 text-brand-400 px-1.5 py-0.5 rounded-full uppercase font-semibold">
                                Default
                              </span>
                            )}
                          </div>
                          {model.description && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              {model.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
