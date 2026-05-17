/**
 * Workflow Type Definitions
 * 
 * This file contains core type definitions for the workflow system,
 * including WorkflowState, ModelConfig, and related types.
 */

// ============================================================================
// Model Configuration Types
// ============================================================================

/**
 * Bedrock model configuration
 * Uses IAM authentication, always available
 */
export interface BedrockModelConfig {
  modelId: string;
}

/**
 * OpenAI model configuration
 * Requires API key from Token Vault
 */
export interface OpenAIModelConfig {
  modelId: string;
  apiKeyArn: string;
}

/**
 * Gemini model configuration
 * Requires API key from Token Vault
 */
export interface GeminiModelConfig {
  modelId: string;
  apiKeyArn: string;
}

/**
 * Model provider types
 */
export type ModelProvider = 'bedrock' | 'openai' | 'gemini';

/**
 * Complete model configuration for a workflow
 * Contains provider-specific config and display metadata
 */
export interface ModelConfig {
  provider: ModelProvider;
  modelId: string;
  displayName: string;
  bedrockModelConfig?: BedrockModelConfig;
  openAiModelConfig?: OpenAIModelConfig;
  geminiModelConfig?: GeminiModelConfig;
}

// ============================================================================
// Workflow Types
// ============================================================================

export type WorkflowStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'blocked';

export type AgentRole = 
  | 'team-product-manager'
  | 'team-ios-designer'
  | 'team-backend-designer'
  | 'team-android-designer'
  | 'team-security-reviewer'
  | 'team-legal-compliance'
  | 'team-localization'
  | 'team-analytics-designer'
  | 'team-backend-dev'
  | 'team-api-dev'
  | 'team-frontend-dev';

/**
 * Represents a single task/ticket in the workflow
 */
export interface WorkflowTicket {
  id: string;
  title: string;
  description: string;
  assignee: AgentRole;
  status: WorkflowStatus;
  blockedBy?: string[]; // Ticket IDs
  artifacts?: string[]; // S3 paths, PR URLs, etc.
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

/**
 * Complete workflow state persisted in DynamoDB/S3
 */
export interface WorkflowState {
  workflowId: string;
  status: WorkflowStatus;
  requirements: string; // Markdown requirements doc
  tickets: WorkflowTicket[];
  
  /**
   * Model configuration for all agents in this workflow
   * If undefined, falls back to default (Claude Sonnet 4.5)
   * 
   * @since v1.1.0 - Added model configuration support
   */
  modelConfig?: ModelConfig;
  
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

// ============================================================================
// InvokeHarnessCommand Model Parameter Types
// ============================================================================

/**
 * Model parameter format for InvokeHarnessCommand
 * This is what gets passed to the AgentCore SDK
 */
export type InvokeHarnessModelParam = 
  | { bedrockModelConfig: BedrockModelConfig }
  | { openAiModelConfig: OpenAIModelConfig }
  | { geminiModelConfig: GeminiModelConfig };

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default model configuration
 * Claude Sonnet 4.5 on Bedrock (always available)
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
 * Available models by provider
 * Used for UI dropdown and validation
 */
export const AVAILABLE_MODELS: ModelConfig[] = [
  // Bedrock models (IAM auth, always available)
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
  // OpenAI models (requires OPENAI_API_KEY_ARN)
  {
    provider: 'openai',
    modelId: 'gpt-5.5',
    displayName: 'GPT-5.5',
    openAiModelConfig: {
      modelId: 'gpt-5.5',
      apiKeyArn: '' // Filled from env var at runtime
    }
  },
  {
    provider: 'openai',
    modelId: 'o3',
    displayName: 'o3',
    openAiModelConfig: {
      modelId: 'o3',
      apiKeyArn: '' // Filled from env var at runtime
    }
  },
  {
    provider: 'openai',
    modelId: 'o4-mini',
    displayName: 'o4-mini',
    openAiModelConfig: {
      modelId: 'o4-mini',
      apiKeyArn: '' // Filled from env var at runtime
    }
  },
  // Gemini models (requires GEMINI_API_KEY_ARN)
  {
    provider: 'gemini',
    modelId: 'gemini-2.5-pro',
    displayName: 'Gemini 2.5 Pro',
    geminiModelConfig: {
      modelId: 'gemini-2.5-pro',
      apiKeyArn: '' // Filled from env var at runtime
    }
  },
  {
    provider: 'gemini',
    modelId: 'gemini-2.5-flash',
    displayName: 'Gemini 2.5 Flash',
    geminiModelConfig: {
      modelId: 'gemini-2.5-flash',
      apiKeyArn: '' // Filled from env var at runtime
    }
  }
];
