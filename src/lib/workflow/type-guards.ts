/**
 * Type guards and validation utilities for workflow types
 */

import type { ModelConfig, BedrockConfig, OpenAIConfig, GeminiConfig } from "./types";

/**
 * Type guard for ModelConfig
 * Validates that a value is a valid ModelConfig discriminated union
 */
export function isModelConfig(value: unknown): value is ModelConfig {
  if (!value || typeof value !== "object") return false;
  const config = value as Record<string, unknown>;
  
  if (!config.provider || typeof config.provider !== "string") return false;
  if (!config.modelId || typeof config.modelId !== "string") return false;
  
  return ["bedrock", "openai", "gemini"].includes(config.provider as string);
}

/**
 * Type guard for BedrockConfig
 */
export function isBedrockConfig(config: ModelConfig): config is BedrockConfig {
  return config.provider === "bedrock";
}

/**
 * Type guard for OpenAIConfig
 */
export function isOpenAIConfig(config: ModelConfig): config is OpenAIConfig {
  return config.provider === "openai";
}

/**
 * Type guard for GeminiConfig
 */
export function isGeminiConfig(config: ModelConfig): config is GeminiConfig {
  return config.provider === "gemini";
}

/**
 * Validates a ModelConfig and throws if invalid
 * Use for runtime validation when accepting external input
 */
export function validateModelConfig(value: unknown): asserts value is ModelConfig {
  if (!isModelConfig(value)) {
    throw new Error(
      `Invalid ModelConfig: must have provider ("bedrock"|"openai"|"gemini") and modelId (string)`
    );
  }
  
  const config = value as ModelConfig;
  
  // Provider-specific validation
  if (isBedrockConfig(config)) {
    if (config.region && typeof config.region !== "string") {
      throw new Error("BedrockConfig: region must be a string");
    }
  } else if (isOpenAIConfig(config)) {
    if (config.apiVersion && typeof config.apiVersion !== "string") {
      throw new Error("OpenAIConfig: apiVersion must be a string");
    }
  } else if (isGeminiConfig(config)) {
    if (config.apiVersion && typeof config.apiVersion !== "string") {
      throw new Error("GeminiConfig: apiVersion must be a string");
    }
  }
}
