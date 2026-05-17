// Model configuration types for workflow agents

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

export interface ModelOption {
  provider: ModelProvider;
  modelId: string;
  displayName: string;
  available: boolean;
  apiKeyEnvVar?: string;
}

export interface WorkflowState {
  workflowId?: string;
  status?: string;
  modelConfig?: ModelConfig;
  // Add other workflow state properties as needed
}
