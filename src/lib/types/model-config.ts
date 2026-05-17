// Model Configuration Types

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

export type ModelProvider = 'bedrock' | 'openai' | 'gemini';

export interface ModelConfig {
  provider: ModelProvider;
  modelId: string;
  displayName: string;
  bedrockModelConfig?: BedrockModelConfig;
  openAiModelConfig?: OpenAiModelConfig;
  geminiModelConfig?: GeminiModelConfig;
}

export interface WorkflowState {
  // Existing properties...
  id: string;
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
  
  // New model configuration property
  modelConfig?: ModelConfig;
}

// Supported models configuration
export interface SupportedModel {
  id: string;
  displayName: string;
  provider: ModelProvider;
  modelId: string;
  requiresApiKey?: boolean;
  apiKeyEnvVar?: string;
}

export const SUPPORTED_MODELS: SupportedModel[] = [
  // Bedrock Models (always available)
  {
    id: 'claude-sonnet-4-5',
    displayName: 'Claude Sonnet 4.5',
    provider: 'bedrock',
    modelId: 'global.anthropic.claude-sonnet-4-5-20250929-v1:0',
  },
  {
    id: 'claude-opus-4-5',
    displayName: 'Claude Opus 4.5',
    provider: 'bedrock',
    modelId: 'global.anthropic.claude-opus-4-5-20250929-v1:0',
  },
  {
    id: 'claude-haiku-4-5',
    displayName: 'Claude Haiku 4.5',
    provider: 'bedrock',
    modelId: 'global.anthropic.claude-haiku-4-5-20250929-v1:0',
  },
  {
    id: 'amazon-nova-pro',
    displayName: 'Amazon Nova Pro',
    provider: 'bedrock',
    modelId: 'amazon.nova-pro-v1:0',
  },
  {
    id: 'amazon-nova-lite',
    displayName: 'Amazon Nova Lite',
    provider: 'bedrock',
    modelId: 'amazon.nova-lite-v1:0',
  },
  // OpenAI Models (require OPENAI_API_KEY_ARN)
  {
    id: 'gpt-5-5',
    displayName: 'GPT-5.5',
    provider: 'openai',
    modelId: 'gpt-5.5',
    requiresApiKey: true,
    apiKeyEnvVar: 'OPENAI_API_KEY_ARN',
  },
  {
    id: 'o3',
    displayName: 'o3',
    provider: 'openai',
    modelId: 'o3',
    requiresApiKey: true,
    apiKeyEnvVar: 'OPENAI_API_KEY_ARN',
  },
  {
    id: 'o4-mini',
    displayName: 'o4-mini',
    provider: 'openai',
    modelId: 'o4-mini',
    requiresApiKey: true,
    apiKeyEnvVar: 'OPENAI_API_KEY_ARN',
  },
  // Gemini Models (require GEMINI_API_KEY_ARN)
  {
    id: 'gemini-2-5-pro',
    displayName: 'Gemini 2.5 Pro',
    provider: 'gemini',
    modelId: 'gemini-2.5-pro',
    requiresApiKey: true,
    apiKeyEnvVar: 'GEMINI_API_KEY_ARN',
  },
  {
    id: 'gemini-2-5-flash',
    displayName: 'Gemini 2.5 Flash',
    provider: 'gemini',
    modelId: 'gemini-2.5-flash',
    requiresApiKey: true,
    apiKeyEnvVar: 'GEMINI_API_KEY_ARN',
  },
];

// Default model selection
export const DEFAULT_MODEL_ID = 'claude-sonnet-4-5';
