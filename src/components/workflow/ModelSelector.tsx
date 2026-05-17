"use client";

import * as React from "react";
import { Select, SelectGroup, SelectItem } from "@/components/ui/select";
import { ModelConfig, ModelOption, ModelProvider } from "@/types/model";
import { cn } from "@/lib/utils";
import { AlertCircle, Check } from "lucide-react";

interface ModelSelectorProps {
  value?: ModelConfig;
  onChange: (config: ModelConfig) => void;
  className?: string;
  disabled?: boolean;
}

// Define all supported models
const MODELS: Record<ModelProvider, ModelOption[]> = {
  bedrock: [
    {
      provider: "bedrock",
      modelId: "global.anthropic.claude-sonnet-4-5-20250929-v1:0",
      displayName: "Claude Sonnet 4.5",
      available: true,
    },
    {
      provider: "bedrock",
      modelId: "global.anthropic.claude-opus-4-5-20250929-v1:0",
      displayName: "Claude Opus 4.5",
      available: true,
    },
    {
      provider: "bedrock",
      modelId: "global.anthropic.claude-haiku-4-5-20250929-v1:0",
      displayName: "Claude Haiku 4.5",
      available: true,
    },
    {
      provider: "bedrock",
      modelId: "amazon.nova-pro-v1:0",
      displayName: "Amazon Nova Pro",
      available: true,
    },
    {
      provider: "bedrock",
      modelId: "amazon.nova-lite-v1:0",
      displayName: "Amazon Nova Lite",
      available: true,
    },
  ],
  openai: [
    {
      provider: "openai",
      modelId: "gpt-5.5",
      displayName: "GPT-5.5",
      available: false,
      apiKeyEnvVar: "OPENAI_API_KEY_ARN",
    },
    {
      provider: "openai",
      modelId: "o3",
      displayName: "o3",
      available: false,
      apiKeyEnvVar: "OPENAI_API_KEY_ARN",
    },
    {
      provider: "openai",
      modelId: "o4-mini",
      displayName: "o4-mini",
      available: false,
      apiKeyEnvVar: "OPENAI_API_KEY_ARN",
    },
  ],
  gemini: [
    {
      provider: "gemini",
      modelId: "gemini-2.5-pro",
      displayName: "Gemini 2.5 Pro",
      available: false,
      apiKeyEnvVar: "GEMINI_API_KEY_ARN",
    },
    {
      provider: "gemini",
      modelId: "gemini-2.5-flash",
      displayName: "Gemini 2.5 Flash",
      available: false,
      apiKeyEnvVar: "GEMINI_API_KEY_ARN",
    },
  ],
};

// Default model
const DEFAULT_MODEL = MODELS.bedrock[0]; // Claude Sonnet 4.5

export function ModelSelector({ value, onChange, className, disabled }: ModelSelectorProps) {
  const [apiKeyAvailability, setApiKeyAvailability] = React.useState<Record<string, boolean>>({
    OPENAI_API_KEY_ARN: false,
    GEMINI_API_KEY_ARN: false,
  });
  const [loading, setLoading] = React.useState(true);

  // Check API key availability on mount
  React.useEffect(() => {
    const checkApiKeys = async () => {
      try {
        const response = await fetch("/api/config/api-keys");
        if (response.ok) {
          const data = await response.json();
          setApiKeyAvailability({
            OPENAI_API_KEY_ARN: data.openai || false,
            GEMINI_API_KEY_ARN: data.gemini || false,
          });
        }
      } catch (error) {
        console.error("Failed to check API key availability:", error);
      } finally {
        setLoading(false);
      }
    };
    checkApiKeys();
  }, []);

  // Build flat list of all models with availability
  const allModels = React.useMemo(() => {
    return Object.entries(MODELS).flatMap(([provider, models]) =>
      models.map((model) => ({
        ...model,
        available:
          model.provider === "bedrock" ||
          (model.apiKeyEnvVar ? apiKeyAvailability[model.apiKeyEnvVar] : false),
      }))
    );
  }, [apiKeyAvailability]);

  // Get current selection or default
  const currentModel = value || createModelConfig(DEFAULT_MODEL);
  const selectedValue = `${currentModel.provider}:${currentModel.modelId}`;

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const [provider, modelId] = e.target.value.split(":") as [ModelProvider, string];
    const model = allModels.find((m) => m.provider === provider && m.modelId === modelId);
    if (model) {
      onChange(createModelConfig(model));
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <label htmlFor="model-selector" className="text-sm font-medium text-gray-300">
        Model Selection
      </label>
      <Select
        id="model-selector"
        value={selectedValue}
        onChange={handleChange}
        disabled={disabled || loading}
        aria-label="Select AI model for workflow agents"
      >
        <SelectGroup label="Amazon Bedrock (Always Available)">
          {MODELS.bedrock.map((model) => (
            <SelectItem
              key={model.modelId}
              value={`${model.provider}:${model.modelId}`}
            >
              {model.displayName}
            </SelectItem>
          ))}
        </SelectGroup>
        <SelectGroup label="OpenAI">
          {MODELS.openai.map((model) => {
            const available = apiKeyAvailability.OPENAI_API_KEY_ARN;
            return (
              <SelectItem
                key={model.modelId}
                value={`${model.provider}:${model.modelId}`}
                disabled={!available}
              >
                {model.displayName} {!available && "(API key not configured)"}
              </SelectItem>
            );
          })}
        </SelectGroup>
        <SelectGroup label="Google Gemini">
          {MODELS.gemini.map((model) => {
            const available = apiKeyAvailability.GEMINI_API_KEY_ARN;
            return (
              <SelectItem
                key={model.modelId}
                value={`${model.provider}:${model.modelId}`}
                disabled={!available}
              >
                {model.displayName} {!available && "(API key not configured)"}
              </SelectItem>
            );
          })}
        </SelectGroup>
      </Select>
      
      {/* Info text */}
      <div className="flex items-start gap-2 text-xs text-gray-500">
        <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
        <p>
          All agents in this workflow will use the selected model.
          {!apiKeyAvailability.OPENAI_API_KEY_ARN && !apiKeyAvailability.GEMINI_API_KEY_ARN && (
            <span className="block mt-1">
              To enable external providers, configure API keys in environment variables.
            </span>
          )}
        </p>
      </div>

      {/* Current selection display */}
      <div className="flex items-center gap-2 p-3 bg-surface-2 border border-surface-4 rounded-md">
        <Check className="w-4 h-4 text-green-400" />
        <div className="text-sm">
          <span className="text-gray-500">Selected: </span>
          <span className="text-gray-200 font-medium">
            {getProviderDisplayName(currentModel.provider)} - {currentModel.displayName}
          </span>
        </div>
      </div>
    </div>
  );
}

// Helper function to create ModelConfig from ModelOption
function createModelConfig(model: ModelOption): ModelConfig {
  const config: ModelConfig = {
    provider: model.provider,
    modelId: model.modelId,
    displayName: model.displayName,
  };

  if (model.provider === "bedrock") {
    config.bedrockModelConfig = { modelId: model.modelId };
  } else if (model.provider === "openai") {
    config.openAiModelConfig = {
      modelId: model.modelId,
      apiKeyArn: process.env.OPENAI_API_KEY_ARN || "",
    };
  } else if (model.provider === "gemini") {
    config.geminiModelConfig = {
      modelId: model.modelId,
      apiKeyArn: process.env.GEMINI_API_KEY_ARN || "",
    };
  }

  return config;
}

function getProviderDisplayName(provider: ModelProvider): string {
  const names: Record<ModelProvider, string> = {
    bedrock: "Amazon Bedrock",
    openai: "OpenAI",
    gemini: "Google Gemini",
  };
  return names[provider];
}

export { MODELS, DEFAULT_MODEL, createModelConfig };
