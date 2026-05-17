/**
 * Workflow Engine - Model Configuration Integration
 * 
 * This module extends the workflow engine to support per-workflow model configuration.
 * It handles:
 * - Extracting modelConfig from WorkflowInput
 * - Validating model configurations
 * - Determining which agents should receive model overrides (dev agents only)
 * - Passing model config to harness invocations
 */

import { ModelConfig, AgentDefinition, WorkflowState } from './types';

// Dev agents that should receive model overrides
const DEV_AGENT_IDS = [
  'team-backend-dev',
  'team-api-dev',
  'team-frontend-dev',
] as const;

// Default model configuration (Claude Sonnet 4.5 on Bedrock)
const DEFAULT_MODEL_CONFIG: ModelConfig = {
  provider: 'bedrock',
  modelId: 'global.anthropic.claude-sonnet-4-5-20250929-v1:0',
};

/**
 * Check if an agent should receive model configuration override.
 * Only dev agents receive overrides; system agents use default.
 */
export function shouldReceiveModelOverride(agentId: string): boolean {
  return DEV_AGENT_IDS.includes(agentId as typeof DEV_AGENT_IDS[number]);
}

/**
 * Get the model configuration for a specific agent.
 * Returns workflow modelConfig for dev agents, or default for system agents.
 */
export function getModelConfigForAgent(
  agentId: string,
  workflowModelConfig?: ModelConfig
): ModelConfig {
  if (shouldReceiveModelOverride(agentId) && workflowModelConfig) {
    return workflowModelConfig;
  }
  return DEFAULT_MODEL_CONFIG;
}

/**
 * Validate model configuration structure.
 * Returns error message if invalid, or null if valid.
 */
export function validateModelConfig(config: unknown): string | null {
  if (!config || typeof config !== 'object') {
    return 'Model config must be an object';
  }

  const mc = config as Record<string, unknown>;

  if (!mc.provider || typeof mc.provider !== 'string') {
    return 'Model config must have a provider string';
  }

  if (!['bedrock', 'openai', 'gemini'].includes(mc.provider)) {
    return `Invalid provider: ${mc.provider}. Must be bedrock, openai, or gemini`;
  }

  if (!mc.modelId || typeof mc.modelId !== 'string') {
    return 'Model config must have a modelId string';
  }

  if (mc.modelId.trim().length === 0) {
    return 'Model config modelId cannot be empty';
  }

  return null;
}

/**
 * Convert ModelConfig to InvokeHarness API parameters.
 * Different providers require different parameter structures.
 */
export function modelConfigToInvokeParams(config: ModelConfig): {
  modelProvider?: string;
  modelId?: string;
  modelOverride?: Record<string, unknown>;
} {
  switch (config.provider) {
    case 'bedrock':
      return {
        modelProvider: 'bedrock',
        modelId: config.modelId,
        modelOverride: {
          bedrockModelConfig: {
            modelId: config.modelId,
          },
        },
      };
    case 'openai':
      return {
        modelProvider: 'openai',
        modelId: config.modelId,
        modelOverride: {
          openAiModelConfig: {
            modelId: config.modelId,
          },
        },
      };
    case 'gemini':
      return {
        modelProvider: 'gemini',
        modelId: config.modelId,
        modelOverride: {
          geminiModelConfig: {
            modelId: config.modelId,
          },
        },
      };
  }
}

/**
 * Extract and validate model config from workflow input.
 * Returns validated config or undefined if not present/invalid.
 * Logs errors for invalid configs.
 */
export function extractModelConfigFromInput(
  input: { modelConfig?: unknown }
): ModelConfig | undefined {
  if (!input.modelConfig) {
    return undefined;
  }

  const validationError = validateModelConfig(input.modelConfig);
  if (validationError) {
    console.error(
      `[Workflow Engine] Invalid modelConfig in input: ${validationError}`,
      input.modelConfig
    );
    return undefined;
  }

  return input.modelConfig as ModelConfig;
}

/**
 * Create a log entry for model selection.
 * Used for observability and debugging.
 */
export function createModelSelectionLog(
  agentId: string,
  agentName: string,
  modelConfig: ModelConfig,
  isOverride: boolean
): string {
  const source = isOverride ? 'workflow override' : 'default';
  return `[Model Selection] Agent ${agentName} (${agentId}) using ${modelConfig.provider}/${modelConfig.modelId} (${source})`;
}
