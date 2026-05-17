/**
 * Model Configuration Utilities
 * 
 * Utilities for validating and transforming model configurations
 * between internal format (ModelConfig) and API format (ModelConfigPayload).
 */

import type {
  ModelConfig,
  ModelConfigPayload,
  BedrockModelConfig,
  OpenAIModelConfig,
  GeminiModelConfig,
  DEFAULT_MODEL_CONFIG,
} from "@/lib/workflow/types";

/**
 * Transform internal ModelConfig to InvokeHarnessCommand-compatible format
 * 
 * @param config - Internal model configuration
 * @returns API-compatible model configuration payload
 */
export function toModelConfigPayload(
  config: ModelConfig
): ModelConfigPayload {
  switch (config.type) {
    case "bedrock":
      return { bedrockModelConfig: config.config };
    case "openai":
      return { openAiModelConfig: config.config };
    case "gemini":
      return { geminiModelConfig: config.config };
    default:
      // TypeScript exhaustiveness check
      const _exhaustive: never = config;
      throw new Error(`Unknown model config type: ${JSON.stringify(_exhaustive)}`);
  }
}

/**
 * Validate model configuration structure
 * 
 * @param config - Model configuration to validate
 * @returns Validation result with error message if invalid
 */
export function validateModelConfig(
  config: ModelConfig
): { valid: boolean; error?: string } {
  switch (config.type) {
    case "bedrock":
      if (!config.config.modelId || config.config.modelId.trim().length === 0) {
        return { valid: false, error: "Bedrock model ID is required" };
      }
      return { valid: true };

    case "openai":
      if (!config.config.modelId || config.config.modelId.trim().length === 0) {
        return { valid: false, error: "OpenAI model ID is required" };
      }
      if (!config.config.apiKeyArn || config.config.apiKeyArn.trim().length === 0) {
        return { valid: false, error: "OpenAI API key ARN is required" };
      }
      // Validate ARN format
      if (!config.config.apiKeyArn.startsWith("arn:aws:")) {
        return { valid: false, error: "Invalid OpenAI API key ARN format" };
      }
      return { valid: true };

    case "gemini":
      if (!config.config.modelId || config.config.modelId.trim().length === 0) {
        return { valid: false, error: "Gemini model ID is required" };
      }
      if (!config.config.apiKeyArn || config.config.apiKeyArn.trim().length === 0) {
        return { valid: false, error: "Gemini API key ARN is required" };
      }
      // Validate ARN format
      if (!config.config.apiKeyArn.startsWith("arn:aws:")) {
        return { valid: false, error: "Invalid Gemini API key ARN format" };
      }
      return { valid: true };

    default:
      const _exhaustive: never = config;
      return { valid: false, error: `Unknown config type: ${JSON.stringify(_exhaustive)}` };
  }
}

/**
 * Get a human-readable display name for a model configuration
 * 
 * @param config - Model configuration
 * @returns Display name like "Bedrock: Claude Sonnet 4.5"
 */
export function getModelDisplayName(config: ModelConfig): string {
  const providerMap = {
    bedrock: "Bedrock",
    openai: "OpenAI",
    gemini: "Gemini",
  };

  const provider = providerMap[config.type];
  const modelId = config.config.modelId;

  // Extract friendly model name from ID
  let modelName = modelId;
  if (config.type === "bedrock") {
    // Extract from ARN: global.anthropic.claude-sonnet-4-5-20250929-v1:0 -> Claude Sonnet 4.5
    const match = modelId.match(/\.(\w+)[\.\-]([\w\-]+)/);
    if (match) {
      const vendor = match[1];
      const model = match[2].replace(/-/g, " ");
      modelName = `${vendor.charAt(0).toUpperCase() + vendor.slice(1)} ${model}`;
    }
  }

  return `${provider}: ${modelName}`;
}

/**
 * Get API key ARN from environment for a provider
 * 
 * @param provider - Provider type ("openai" or "gemini")
 * @returns API key ARN or null if not configured
 */
export function getProviderApiKeyArn(
  provider: "openai" | "gemini"
): string | null {
  switch (provider) {
    case "openai":
      return process.env.OPENAI_API_KEY_ARN || null;
    case "gemini":
      return process.env.GEMINI_API_KEY_ARN || null;
    default:
      return null;
  }
}

/**
 * Create a model configuration with environment-provided API keys
 * 
 * @param provider - Provider type
 * @param modelId - Model identifier
 * @returns Complete model configuration with API keys filled in
 * @throws Error if API key not configured for external providers
 */
export function createModelConfig(
  provider: "bedrock" | "openai" | "gemini",
  modelId: string
): ModelConfig {
  switch (provider) {
    case "bedrock":
      return {
        type: "bedrock",
        config: { modelId },
      };

    case "openai": {
      const apiKeyArn = getProviderApiKeyArn("openai");
      if (!apiKeyArn) {
        throw new Error(
          "OpenAI API key ARN not configured. Set OPENAI_API_KEY_ARN environment variable."
        );
      }
      return {
        type: "openai",
        config: { modelId, apiKeyArn },
      };
    }

    case "gemini": {
      const apiKeyArn = getProviderApiKeyArn("gemini");
      if (!apiKeyArn) {
        throw new Error(
          "Gemini API key ARN not configured. Set GEMINI_API_KEY_ARN environment variable."
        );
      }
      return {
        type: "gemini",
        config: { modelId, apiKeyArn },
      };
    }

    default:
      const _exhaustive: never = provider;
      throw new Error(`Unknown provider: ${_exhaustive}`);
  }
}
