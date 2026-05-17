// Type definitions for Workflow model configuration

export type ModelProvider = 'bedrock' | 'openai' | 'gemini';

export interface BedrockModelConfig {
  modelId: string;
}

export interface OpenAiModelConfig {
  modelId: string;
  apiKeyArn: string;
}

export interface GeminiModelConfig {
  modelId: string;
  apiKeyArn: string;
}

export interface ModelConfig {
  provider: ModelProvider;
  modelId: string;
  displayName: string;
  bedrockModelConfig?: BedrockModelConfig;
  openAiModelConfig?: OpenAiModelConfig;
  geminiModelConfig?: GeminiModelConfig;
}

export interface WorkflowState {
  id: string;
  name: string;
  description?: string;
  status: 'draft' | 'running' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
  modelConfig?: ModelConfig;
  // Add other workflow properties as needed
}

// Model display helpers
export const DEFAULT_MODEL_CONFIG: ModelConfig = {
  provider: 'bedrock',
  modelId: 'anthropic.claude-sonnet-4-5-v2:0',
  displayName: 'Claude Sonnet 4.5',
};

export const MODEL_DISPLAY_NAMES: Record<string, string> = {
  // Bedrock models
  'anthropic.claude-sonnet-4-5-v2:0': 'Claude Sonnet 4.5',
  'anthropic.claude-opus-4-5-v2:0': 'Claude Opus 4.5',
  'anthropic.claude-haiku-4-5-v2:0': 'Claude Haiku 4.5',
  'amazon.nova-pro-v1:0': 'Amazon Nova Pro',
  'amazon.nova-lite-v1:0': 'Amazon Nova Lite',
  
  // OpenAI models
  'gpt-5.5': 'GPT-5.5',
  'o3': 'o3',
  'o4-mini': 'o4-mini',
  
  // Gemini models
  'gemini-2.5-pro': 'Gemini 2.5 Pro',
  'gemini-2.5-flash': 'Gemini 2.5 Flash',
};

export const PROVIDER_DISPLAY_NAMES: Record<ModelProvider, string> = {
  bedrock: 'Bedrock',
  openai: 'OpenAI',
  gemini: 'Google Gemini',
};

export function getModelDisplayName(modelId: string): string {
  return MODEL_DISPLAY_NAMES[modelId] || modelId;
}

export function getProviderDisplayName(provider: ModelProvider): string {
  return PROVIDER_DISPLAY_NAMES[provider];
}

export function formatModelDisplay(modelConfig?: ModelConfig): string {
  if (!modelConfig) {
    return `${PROVIDER_DISPLAY_NAMES.bedrock} - ${DEFAULT_MODEL_CONFIG.displayName}`;
  }
  
  const provider = getProviderDisplayName(modelConfig.provider);
  const model = modelConfig.displayName || getModelDisplayName(modelConfig.modelId);
  
  return `${provider} - ${model}`;
}
