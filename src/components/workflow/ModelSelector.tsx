"use client";

import { useState, useEffect } from "react";
import type { ModelConfig, ProviderAvailability, ModelDefinition } from "@/lib/workflow/types";
import { MODEL_REGISTRY, BEDROCK_MODELS, DEFAULT_MODEL_CONFIG } from "@/lib/workflow/types";

interface ModelSelectorProps {
  value: ModelConfig;
  onChange: (config: ModelConfig) => void;
  disabled?: boolean;
}

export default function ModelSelector({ value, onChange, disabled }: ModelSelectorProps) {
  const [availability, setAvailability] = useState<ProviderAvailability>({
    bedrock: true,
    openai: false,
    gemini: false,
  });
  const [loading, setLoading] = useState(true);

  // Fetch provider availability on mount
  useEffect(() => {
    fetch("/api/providers/availability")
      .then((res) => res.json())
      .then((data: ProviderAvailability) => {
        setAvailability(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch provider availability:", err);
        setLoading(false);
      });
  }, []);

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    const model = MODEL_REGISTRY.find((m) => m.id === selectedId);
    
    if (!model) return;

    // Create appropriate config based on provider
    let newConfig: ModelConfig;
    if (model.provider === 'bedrock') {
      newConfig = { type: 'bedrock', modelId: selectedId };
    } else if (model.provider === 'openai') {
      newConfig = { 
        type: 'openai', 
        modelId: selectedId,
        apiKeyArn: process.env.NEXT_PUBLIC_OPENAI_API_KEY_ARN || ''
      };
    } else {
      newConfig = { 
        type: 'gemini', 
        modelId: selectedId,
        apiKeyArn: process.env.NEXT_PUBLIC_GEMINI_API_KEY_ARN || ''
      };
    }

    onChange(newConfig);
  };

  // Group models by provider
  const bedrockModels = MODEL_REGISTRY.filter(m => m.provider === 'bedrock');
  const openaiModels = MODEL_REGISTRY.filter(m => m.provider === 'openai');
  const geminiModels = MODEL_REGISTRY.filter(m => m.provider === 'gemini');

  const isModelDisabled = (model: ModelDefinition): boolean => {
    if (model.provider === 'bedrock') return false;
    if (model.provider === 'openai') return !availability.openai;
    if (model.provider === 'gemini') return !availability.gemini;
    return true;
  };

  const getDisabledTooltip = (provider: 'openai' | 'gemini'): string => {
    if (provider === 'openai') {
      return 'OpenAI models require OPENAI_API_KEY_ARN to be configured';
    }
    return 'Gemini models require GEMINI_API_KEY_ARN to be configured';
  };

  if (loading) {
    return (
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-1">
          AI Model
        </label>
        <div className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-500 text-sm">
          Loading models...
        </div>
      </div>
    );
  }

  return (
    <div>
      <label className="block text-sm font-medium text-zinc-300 mb-1">
        AI Model
      </label>
      <p className="text-xs text-zinc-500 mb-2">
        Choose which AI model the workflow agents will use
      </p>
      
      <select
        value={value.modelId}
        onChange={handleModelChange}
        disabled={disabled}
        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 text-sm focus:outline-none focus:border-zinc-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {/* Bedrock Group */}
        <optgroup label="Bedrock (Always Available)">
          {bedrockModels.map((model) => (
            <option key={model.id} value={model.id}>
              {model.displayName}
              {model.id === BEDROCK_MODELS.CLAUDE_SONNET_4_5 && ' (Recommended)'}
              {model.description && ` - ${model.description}`}
            </option>
          ))}
        </optgroup>

        {/* OpenAI Group */}
        <optgroup label={`OpenAI ${!availability.openai ? '(API Key Required)' : ''}`}>
          {openaiModels.map((model) => (
            <option 
              key={model.id} 
              value={model.id}
              disabled={isModelDisabled(model)}
              title={isModelDisabled(model) ? getDisabledTooltip('openai') : undefined}
            >
              {model.displayName}
              {isModelDisabled(model) && ' - Requires API Key'}
            </option>
          ))}
        </optgroup>

        {/* Gemini Group */}
        <optgroup label={`Gemini ${!availability.gemini ? '(API Key Required)' : ''}`}>
          {geminiModels.map((model) => (
            <option 
              key={model.id} 
              value={model.id}
              disabled={isModelDisabled(model)}
              title={isModelDisabled(model) ? getDisabledTooltip('gemini') : undefined}
            >
              {model.displayName}
              {isModelDisabled(model) && ' - Requires API Key'}
            </option>
          ))}
        </optgroup>
      </select>

      {/* Availability status indicator */}
      <div className="mt-2 flex gap-3 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-zinc-400">Bedrock</span>
        </div>
        <div className="flex items-center gap-1">
          <div className={`w-2 h-2 rounded-full ${availability.openai ? 'bg-green-500' : 'bg-zinc-600'}`} />
          <span className="text-zinc-400">OpenAI</span>
        </div>
        <div className="flex items-center gap-1">
          <div className={`w-2 h-2 rounded-full ${availability.gemini ? 'bg-green-500' : 'bg-zinc-600'}`} />
          <span className="text-zinc-400">Gemini</span>
        </div>
      </div>

      {/* Warning message for unavailable providers */}
      {(!availability.openai || !availability.gemini) && (
        <div className="mt-2 text-xs text-zinc-500 bg-zinc-800/50 p-2 rounded border border-zinc-700">
          ℹ️ To enable {!availability.openai && 'OpenAI'}{!availability.openai && !availability.gemini && ' and '}{!availability.gemini && 'Gemini'} models, configure the required API key ARN(s) in environment variables.
        </div>
      )}
    </div>
  );
}
