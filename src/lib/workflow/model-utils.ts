/**
 * Model display name utilities
 */
import type { ModelConfig } from './types';

/**
 * Maps model IDs to human-friendly display names
 */
const MODEL_DISPLAY_NAMES: Record<string, string> = {
  // Bedrock models
  'global.anthropic.claude-sonnet-4-5-20250929-v1:0': 'Claude Sonnet 4.5',
  'global.anthropic.claude-opus-4-20250514-v1:0': 'Claude Opus 4',
  'anthropic.claude-3-5-sonnet-20241022-v2:0': 'Claude 3.5 Sonnet',
  'anthropic.claude-3-opus-20240229-v1:0': 'Claude 3 Opus',
  'anthropic.claude-3-sonnet-20240229-v1:0': 'Claude 3 Sonnet',
  'anthropic.claude-3-haiku-20240307-v1:0': 'Claude 3 Haiku',
  
  // OpenAI models
  'gpt-4-turbo-preview': 'GPT-4 Turbo',
  'gpt-4': 'GPT-4',
  'gpt-3.5-turbo': 'GPT-3.5 Turbo',
  
  // Gemini models
  'gemini-pro': 'Gemini Pro',
  'gemini-ultra': 'Gemini Ultra',
};

/**
 * Default model ID (Bedrock Claude Sonnet 4.5)
 */
export const DEFAULT_MODEL_ID = 'global.anthropic.claude-sonnet-4-5-20250929-v1:0';

/**
 * Gets the display name for a model configuration
 * @param modelConfig - The model configuration
 * @returns Human-friendly display name
 */
export function getModelDisplayName(modelConfig: ModelConfig): string {
  const displayName = MODEL_DISPLAY_NAMES[modelConfig.modelId];
  if (displayName) {
    return displayName;
  }
  
  // Fallback to model ID if not in our map
  return modelConfig.modelId;
}

/**
 * Checks if the given model config is the default model
 * @param modelConfig - The model configuration to check
 * @returns true if this is the default model
 */
export function isDefaultModel(modelConfig: ModelConfig): boolean {
  return modelConfig.provider === 'bedrock' && modelConfig.modelId === DEFAULT_MODEL_ID;
}
