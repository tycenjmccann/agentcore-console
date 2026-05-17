/**
 * Model Configuration Utilities
 * 
 * Type guards and validators for ModelConfig discriminated union
 */

import type { ModelConfig } from './types';

/**
 * Type guard to check if a value is a valid ModelConfig
 */
export function isValidModelConfig(config: unknown): config is ModelConfig {
  if (!config || typeof config !== 'object') {
    return false;
  }
  
  const candidate = config as Record<string, unknown>;
  
  // Must have provider and modelId fields
  if (!('provider' in candidate) || !('modelId' in candidate)) {
    return false;
  }
  
  const { provider, modelId } = candidate;
  
  // Validate types
  if (typeof modelId !== 'string' || !modelId.trim()) {
    return false;
  }
  
  // Validate provider is one of the valid options
  const validProviders = ['bedrock', 'openai', 'gemini'];
  if (typeof provider !== 'string' || !validProviders.includes(provider)) {
    return false;
  }
  
  return true;
}

/**
 * Provider-specific validation for model IDs
 */
export function isValidModelId(provider: ModelConfig['provider'], modelId: string): boolean {
  if (!modelId || typeof modelId !== 'string' || !modelId.trim()) {
    return false;
  }
  
  switch (provider) {
    case 'bedrock':
      // Bedrock models follow pattern: provider.model-name
      return /^[a-z0-9-]+\.[a-z0-9-]+/.test(modelId);
    
    case 'openai':
      // OpenAI models: gpt-4, gpt-3.5-turbo, o1-preview, o1-mini, etc.
      return /^gpt-[a-z0-9.-]+$/.test(modelId) || modelId.startsWith('o1-');
    
    case 'gemini':
      // Gemini models: gemini-pro, gemini-1.5-pro, etc.
      return /^gemini-[a-z0-9.-]+$/.test(modelId);
    
    default:
      return false;
  }
}

/**
 * Validate a complete ModelConfig object
 */
export function validateModelConfig(config: unknown): { valid: boolean; error?: string } {
  if (!isValidModelConfig(config)) {
    return { valid: false, error: 'Invalid model configuration structure' };
  }
  
  if (!isValidModelId(config.provider, config.modelId)) {
    return { 
      valid: false, 
      error: `Invalid model ID "${config.modelId}" for provider "${config.provider}"` 
    };
  }
  
  return { valid: true };
}

/**
 * Get default model configuration (Claude Sonnet 4.5 on Bedrock)
 */
export function getDefaultModelConfig(): ModelConfig {
  return {
    provider: 'bedrock',
    modelId: 'anthropic.claude-sonnet-4-5'
  };
}
