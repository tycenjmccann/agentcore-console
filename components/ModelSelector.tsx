import React from 'react';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ModelConfig } from '@/types';

interface ModelOption {
  id: string;
  displayName: string;
  provider: 'bedrock' | 'openai' | 'gemini';
  isAvailable: boolean;
  unavailableReason?: string;
}

interface ModelSelectorProps {
  value?: ModelConfig;
  onChange: (config: ModelConfig) => void;
  openAiAvailable: boolean;
  geminiAvailable: boolean;
}

const MODEL_OPTIONS: ModelOption[] = [
  // Bedrock models (always available)
  {
    id: 'us.anthropic.claude-sonnet-4-5-v1:0',
    displayName: 'Claude Sonnet 4.5',
    provider: 'bedrock',
    isAvailable: true,
  },
  {
    id: 'us.anthropic.claude-opus-4-5-v1:0',
    displayName: 'Claude Opus 4.5',
    provider: 'bedrock',
    isAvailable: true,
  },
  {
    id: 'us.anthropic.claude-haiku-4-5-v1:0',
    displayName: 'Claude Haiku 4.5',
    provider: 'bedrock',
    isAvailable: true,
  },
  {
    id: 'us.amazon.nova-pro-v1:0',
    displayName: 'Amazon Nova Pro',
    provider: 'bedrock',
    isAvailable: true,
  },
  {
    id: 'us.amazon.nova-lite-v1:0',
    displayName: 'Amazon Nova Lite',
    provider: 'bedrock',
    isAvailable: true,
  },
  // OpenAI models
  {
    id: 'gpt-5.5',
    displayName: 'GPT-5.5',
    provider: 'openai',
    isAvailable: false, // Will be set dynamically
  },
  {
    id: 'o3',
    displayName: 'o3',
    provider: 'openai',
    isAvailable: false,
  },
  {
    id: 'o4-mini',
    displayName: 'o4-mini',
    provider: 'openai',
    isAvailable: false,
  },
  // Gemini models
  {
    id: 'gemini-2.5-pro',
    displayName: 'Gemini 2.5 Pro',
    provider: 'gemini',
    isAvailable: false,
  },
  {
    id: 'gemini-2.5-flash',
    displayName: 'Gemini 2.5 Flash',
    provider: 'gemini',
    isAvailable: false,
  },
];

const PROVIDER_LABELS = {
  bedrock: 'AWS Bedrock',
  openai: 'OpenAI',
  gemini: 'Google Gemini',
};

export function ModelSelector({ value, onChange, openAiAvailable, geminiAvailable }: ModelSelectorProps) {
  // Update availability based on props
  const models = MODEL_OPTIONS.map(model => ({
    ...model,
    isAvailable: model.provider === 'bedrock' 
      ? true 
      : model.provider === 'openai' 
        ? openAiAvailable 
        : geminiAvailable,
    unavailableReason: !model.isAvailable && model.provider !== 'bedrock'
      ? 'API key not configured'
      : undefined,
  }));

  // Group models by provider
  const groupedModels = {
    bedrock: models.filter(m => m.provider === 'bedrock'),
    openai: models.filter(m => m.provider === 'openai'),
    gemini: models.filter(m => m.provider === 'gemini'),
  };

  const handleValueChange = (modelId: string) => {
    const selectedModel = models.find(m => m.id === modelId);
    if (!selectedModel || !selectedModel.isAvailable) return;

    const modelConfig: ModelConfig = {
      provider: selectedModel.provider,
      modelId: selectedModel.id,
      displayName: selectedModel.displayName,
    };

    // Add provider-specific config
    switch (selectedModel.provider) {
      case 'bedrock':
        modelConfig.bedrockModelConfig = { modelId: selectedModel.id };
        break;
      case 'openai':
        modelConfig.openAiModelConfig = { 
          modelId: selectedModel.id,
          apiKeyArn: process.env.NEXT_PUBLIC_OPENAI_API_KEY_ARN || '',
        };
        break;
      case 'gemini':
        modelConfig.geminiModelConfig = { 
          modelId: selectedModel.id,
          apiKeyArn: process.env.NEXT_PUBLIC_GEMINI_API_KEY_ARN || '',
        };
        break;
    }

    onChange(modelConfig);
  };

  // Get current value or default to Claude Sonnet 4.5
  const currentValue = value?.modelId || 'us.anthropic.claude-sonnet-4-5-v1:0';

  return (
    <TooltipProvider>
      <Select value={currentValue} onValueChange={handleValueChange}>
        <SelectTrigger className="w-full" aria-label="Select model">
          <SelectValue placeholder="Select a model" />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(groupedModels).map(([provider, providerModels]) => (
            <SelectGroup key={provider}>
              <SelectLabel>{PROVIDER_LABELS[provider as keyof typeof PROVIDER_LABELS]}</SelectLabel>
              {providerModels.map(model => (
                <Tooltip key={model.id} delayDuration={0}>
                  <TooltipTrigger asChild>
                    <SelectItem 
                      value={model.id} 
                      disabled={!model.isAvailable}
                      className={!model.isAvailable ? 'opacity-50 cursor-not-allowed' : ''}
                    >
                      {model.displayName}
                      {!model.isAvailable && ' (unavailable)'}
                    </SelectItem>
                  </TooltipTrigger>
                  {!model.isAvailable && model.unavailableReason && (
                    <TooltipContent>
                      <p>{model.unavailableReason}</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    </TooltipProvider>
  );
}
