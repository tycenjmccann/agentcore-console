// types.ts - Core type definitions for workflow system

/**
 * Model configuration for workflow execution
 * Supports Bedrock (IAM auth), OpenAI, and Google Gemini providers
 */
export interface ModelConfig {
  provider: 'bedrock' | 'openai' | 'gemini';
  modelId: string;
  displayName: string;
  
  // Provider-specific configuration (only one should be set)
  bedrockModelConfig?: {
    modelId: string;
  };
  openAiModelConfig?: {
    modelId: string;
    apiKeyArn: string;
  };
  geminiModelConfig?: {
    modelId: string;
    apiKeyArn: string;
  };
}

/**
 * Agent ticket status
 */
export type TicketStatus = 'pending' | 'in_progress' | 'completed' | 'blocked' | 'failed';

/**
 * Individual agent ticket in a workflow
 */
export interface AgentTicket {
  id: string;
  title: string;
  description: string;
  assignee: string; // Agent ID
  status: TicketStatus;
  blockedBy?: string[]; // Ticket IDs that must complete first
  result?: string; // Agent output when completed
  error?: string; // Error message if failed
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
}

/**
 * Complete workflow state persisted to S3
 */
export interface WorkflowState {
  workflowId: string;
  title: string;
  description: string;
  requirements: string; // Markdown requirements document
  status: 'planning' | 'in_progress' | 'completed' | 'failed';
  
  // Model configuration for all agents in this workflow
  modelConfig?: ModelConfig;
  
  tickets: AgentTicket[];
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

/**
 * Default model configuration
 * Falls back to Claude Sonnet 4.5 when no model specified
 */
export const DEFAULT_MODEL_CONFIG: ModelConfig = {
  provider: 'bedrock',
  modelId: 'global.anthropic.claude-sonnet-4-5-20250929-v1:0',
  displayName: 'Claude Sonnet 4.5',
  bedrockModelConfig: {
    modelId: 'global.anthropic.claude-sonnet-4-5-20250929-v1:0'
  }
};

/**
 * Available models grouped by provider
 */
export const AVAILABLE_MODELS: ModelConfig[] = [
  // Bedrock models (always available)
  {
    provider: 'bedrock',
    modelId: 'global.anthropic.claude-sonnet-4-5-20250929-v1:0',
    displayName: 'Claude Sonnet 4.5',
    bedrockModelConfig: {
      modelId: 'global.anthropic.claude-sonnet-4-5-20250929-v1:0'
    }
  },
  {
    provider: 'bedrock',
    modelId: 'global.anthropic.claude-opus-4-5-20250514-v1:0',
    displayName: 'Claude Opus 4.5',
    bedrockModelConfig: {
      modelId: 'global.anthropic.claude-opus-4-5-20250514-v1:0'
    }
  },
  {
    provider: 'bedrock',
    modelId: 'global.anthropic.claude-haiku-4-5-20250514-v1:0',
    displayName: 'Claude Haiku 4.5',
    bedrockModelConfig: {
      modelId: 'global.anthropic.claude-haiku-4-5-20250514-v1:0'
    }
  },
  {
    provider: 'bedrock',
    modelId: 'global.amazon.nova-pro-v1:0',
    displayName: 'Amazon Nova Pro',
    bedrockModelConfig: {
      modelId: 'global.amazon.nova-pro-v1:0'
    }
  },
  {
    provider: 'bedrock',
    modelId: 'global.amazon.nova-lite-v1:0',
    displayName: 'Amazon Nova Lite',
    bedrockModelConfig: {
      modelId: 'global.amazon.nova-lite-v1:0'
    }
  },
  // OpenAI models (require OPENAI_API_KEY_ARN)
  {
    provider: 'openai',
    modelId: 'gpt-5.5',
    displayName: 'GPT-5.5',
    openAiModelConfig: {
      modelId: 'gpt-5.5',
      apiKeyArn: '' // Will be populated from env var
    }
  },
  {
    provider: 'openai',
    modelId: 'o3',
    displayName: 'o3',
    openAiModelConfig: {
      modelId: 'o3',
      apiKeyArn: ''
    }
  },
  {
    provider: 'openai',
    modelId: 'o4-mini',
    displayName: 'o4-mini',
    openAiModelConfig: {
      modelId: 'o4-mini',
      apiKeyArn: ''
    }
  },
  // Gemini models (require GEMINI_API_KEY_ARN)
  {
    provider: 'gemini',
    modelId: 'gemini-2.5-pro',
    displayName: 'Gemini 2.5 Pro',
    geminiModelConfig: {
      modelId: 'gemini-2.5-pro',
      apiKeyArn: ''
    }
  },
  {
    provider: 'gemini',
    modelId: 'gemini-2.5-flash',
    displayName: 'Gemini 2.5 Flash',
    geminiModelConfig: {
      modelId: 'gemini-2.5-flash',
      apiKeyArn: ''
    }
  }
];

/**
 * Check if a model is available based on environment configuration
 */
export function isModelAvailable(model: ModelConfig): boolean {
  if (model.provider === 'bedrock') {
    return true; // Bedrock always available (IAM auth)
  }
  
  if (model.provider === 'openai') {
    return !!process.env.OPENAI_API_KEY_ARN;
  }
  
  if (model.provider === 'gemini') {
    return !!process.env.GEMINI_API_KEY_ARN;
  }
  
  return false;
}

/**
 * Get API key ARN for external providers from environment
 */
export function getApiKeyArn(provider: 'openai' | 'gemini'): string | undefined {
  if (provider === 'openai') {
    return process.env.OPENAI_API_KEY_ARN;
  }
  if (provider === 'gemini') {
    return process.env.GEMINI_API_KEY_ARN;
  }
  return undefined;
}

/**
 * Transform ModelConfig to InvokeHarnessCommand model parameter format
 */
export function toInvokeHarnessModelConfig(config: ModelConfig): Record<string, any> {
  if (config.bedrockModelConfig) {
    return {
      bedrockModelConfig: {
        modelId: config.bedrockModelConfig.modelId
      }
    };
  }
  
  if (config.openAiModelConfig) {
    const apiKeyArn = getApiKeyArn('openai');
    return {
      openAiModelConfig: {
        modelId: config.openAiModelConfig.modelId,
        apiKeyArn: apiKeyArn || config.openAiModelConfig.apiKeyArn
      }
    };
  }
  
  if (config.geminiModelConfig) {
    const apiKeyArn = getApiKeyArn('gemini');
    return {
      geminiModelConfig: {
        modelId: config.geminiModelConfig.modelId,
        apiKeyArn: apiKeyArn || config.geminiModelConfig.apiKeyArn
      }
    };
  }
  
  // Fallback to default Bedrock config
  return {
    bedrockModelConfig: {
      modelId: DEFAULT_MODEL_CONFIG.modelId
    }
  };
}
