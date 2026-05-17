"use client";

import { useState, useEffect } from "react";
import { Check, ChevronDown, Info } from "lucide-react";
import * as Select from "@radix-ui/react-select";
import { clsx } from "clsx";

export interface ModelConfig {
  provider: "bedrock" | "openai" | "gemini";
  modelId: string;
  displayName: string;
  bedrockModelConfig?: { modelId: string };
  openAiModelConfig?: { modelId: string; apiKeyArn: string };
  geminiModelConfig?: { modelId: string; apiKeyArn: string };
}

interface ModelOption {
  provider: "bedrock" | "openai" | "gemini";
  modelId: string;
  displayName: string;
  available: boolean;
  tooltip?: string;
}

interface ProviderAvailability {
  bedrock: boolean;
  openai: boolean;
  gemini: boolean;
}

interface ModelSelectorProps {
  value?: ModelConfig;
  onChange: (config: ModelConfig) => void;
  className?: string;
}

const MODELS: Omit<ModelOption, "available">[] = [
  // Bedrock models (always available)
  { provider: "bedrock", modelId: "anthropic.claude-sonnet-4-5-v1:0", displayName: "Claude Sonnet 4.5" },
  { provider: "bedrock", modelId: "anthropic.claude-opus-4-5-v1:0", displayName: "Claude Opus 4.5" },
  { provider: "bedrock", modelId: "anthropic.claude-haiku-4-5-v1:0", displayName: "Claude Haiku 4.5" },
  { provider: "bedrock", modelId: "amazon.nova-pro-v1:0", displayName: "Amazon Nova Pro" },
  { provider: "bedrock", modelId: "amazon.nova-lite-v1:0", displayName: "Amazon Nova Lite" },
  // OpenAI models
  { provider: "openai", modelId: "gpt-5.5", displayName: "GPT-5.5" },
  { provider: "openai", modelId: "o3", displayName: "o3" },
  { provider: "openai", modelId: "o4-mini", displayName: "o4-mini" },
  // Gemini models
  { provider: "gemini", modelId: "gemini-2.5-pro", displayName: "Gemini 2.5 Pro" },
  { provider: "gemini", modelId: "gemini-2.5-flash", displayName: "Gemini 2.5 Flash" },
];

const DEFAULT_MODEL = MODELS[0]; // Claude Sonnet 4.5

export function ModelSelector({ value, onChange, className }: ModelSelectorProps) {
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
        const response = await fetch("/api/models/availability");
        if (response.ok) {
          const data = await response.json();
          setAvailability({
            bedrock: true, // Always available
            openai: data.openai || false,
            gemini: data.gemini || false,
          });
        }
      } catch (error) {
        console.error("Failed to check model availability:", error);
      } finally {
        setLoading(false);
      }
    }

    checkAvailability();
  }, []);

  // Set default value if none provided
  useEffect(() => {
    if (!value && !loading) {
      onChange(createModelConfig(DEFAULT_MODEL, availability));
    }
  }, [value, onChange, loading, availability]);

  // Augment models with availability info
  const modelsWithAvailability: ModelOption[] = MODELS.map((model) => {
    const isAvailable = availability[model.provider];
    return {
      ...model,
      available: isAvailable,
      tooltip: !isAvailable ? "API key not configured" : undefined,
    };
  });

  // Group models by provider
  const groupedModels = {
    bedrock: modelsWithAvailability.filter((m) => m.provider === "bedrock"),
    openai: modelsWithAvailability.filter((m) => m.provider === "openai"),
    gemini: modelsWithAvailability.filter((m) => m.provider === "gemini"),
  };

  const handleValueChange = (modelId: string) => {
    const model = modelsWithAvailability.find((m) => m.modelId === modelId);
    if (model && model.available) {
      onChange(createModelConfig(model, availability));
    }
  };

  const selectedModel = value
    ? modelsWithAvailability.find((m) => m.modelId === value.modelId)
    : DEFAULT_MODEL;

  if (loading) {
    return (
      <div className={clsx("animate-pulse", className)}>
        <div className="h-10 bg-surface-3 rounded-lg" />
      </div>
    );
  }

  return (
    <div className={className}>
      <Select.Root
        value={selectedModel?.modelId}
        onValueChange={handleValueChange}
      >
        <Select.Trigger
          className="w-full flex items-center justify-between gap-2 px-4 py-2.5 bg-surface-2 border border-surface-4 rounded-lg text-sm text-gray-200 hover:border-surface-5 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors"
          aria-label="Select model"
        >
          <Select.Value>
            <span className="flex items-center gap-2">
              <span className="text-xs text-gray-500">
                {getProviderDisplayName(selectedModel?.provider || "bedrock")}
              </span>
              <span className="text-gray-400">—</span>
              <span>{selectedModel?.displayName || "Select model..."}</span>
            </span>
          </Select.Value>
          <Select.Icon>
            <ChevronDown className="w-4 h-4 text-gray-500" />
          </Select.Icon>
        </Select.Trigger>

        <Select.Portal>
          <Select.Content
            className="overflow-hidden bg-surface-2 border border-surface-4 rounded-lg shadow-xl z-50"
            position="popper"
            sideOffset={4}
          >
            <Select.Viewport className="p-1">
              {/* Bedrock Group */}
              <Select.Group>
                <Select.Label className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Bedrock (AWS)
                </Select.Label>
                {groupedModels.bedrock.map((model) => (
                  <ModelSelectItem key={model.modelId} model={model} />
                ))}
              </Select.Group>

              {/* OpenAI Group */}
              <Select.Separator className="h-px bg-surface-4 my-1" />
              <Select.Group>
                <Select.Label className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  OpenAI
                </Select.Label>
                {groupedModels.openai.map((model) => (
                  <ModelSelectItem key={model.modelId} model={model} />
                ))}
              </Select.Group>

              {/* Gemini Group */}
              <Select.Separator className="h-px bg-surface-4 my-1" />
              <Select.Group>
                <Select.Label className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Google Gemini
                </Select.Label>
                {groupedModels.gemini.map((model) => (
                  <ModelSelectItem key={model.modelId} model={model} />
                ))}
              </Select.Group>
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}

function ModelSelectItem({ model }: { model: ModelOption }) {
  return (
    <Select.Item
      value={model.modelId}
      disabled={!model.available}
      className={clsx(
        "relative flex items-center gap-2 px-3 py-2 rounded text-sm outline-none cursor-pointer select-none",
        model.available
          ? "text-gray-200 hover:bg-surface-3 focus:bg-surface-3 data-[state=checked]:bg-brand-600/20 data-[state=checked]:text-brand-300"
          : "text-gray-600 cursor-not-allowed opacity-50"
      )}
    >
      <Select.ItemIndicator className="absolute left-3">
        <Check className="w-4 h-4 text-brand-400" />
      </Select.ItemIndicator>
      <span className={clsx("flex-1", model.available && "pl-6")}>
        {model.displayName}
      </span>
      {!model.available && model.tooltip && (
        <div
          className="group relative"
          title={model.tooltip}
          role="tooltip"
        >
          <Info className="w-3.5 h-3.5 text-gray-500" />
          <span className="absolute hidden group-hover:block bottom-full right-0 mb-2 px-2 py-1 text-xs text-white bg-gray-900 rounded whitespace-nowrap z-50">
            {model.tooltip}
          </span>
        </div>
      )}
    </Select.Item>
  );
}

function createModelConfig(
  model: Omit<ModelOption, "available">,
  availability: ProviderAvailability
): ModelConfig {
  const config: ModelConfig = {
    provider: model.provider,
    modelId: model.modelId,
    displayName: model.displayName,
  };

  switch (model.provider) {
    case "bedrock":
      config.bedrockModelConfig = { modelId: model.modelId };
      break;
    case "openai":
      if (availability.openai) {
        config.openAiModelConfig = {
          modelId: model.modelId,
          apiKeyArn: process.env.NEXT_PUBLIC_OPENAI_API_KEY_ARN || "",
        };
      }
      break;
    case "gemini":
      if (availability.gemini) {
        config.geminiModelConfig = {
          modelId: model.modelId,
          apiKeyArn: process.env.NEXT_PUBLIC_GEMINI_API_KEY_ARN || "",
        };
      }
      break;
  }

  return config;
}

function getProviderDisplayName(provider: string): string {
  switch (provider) {
    case "bedrock":
      return "Bedrock";
    case "openai":
      return "OpenAI";
    case "gemini":
      return "Gemini";
    default:
      return provider;
  }
}
