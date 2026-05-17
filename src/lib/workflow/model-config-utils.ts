/**
 * Model Configuration Type Guards and Utilities
 *
 * Runtime type guards and helper functions for working with ModelConfig
 * discriminated union types.
 */

import type {
  ModelConfig,
  BedrockModelConfig,
  OpenAIModelConfig,
  GeminiModelConfig,
  ModelProvider,
  AvailableModel,
} from "./types";

// ─── Type Guards ─────────────────────────────────────────────────────────────

/**
 * Type guard to check if a ModelConfig is a Bedrock configuration.
 *
 * @example
 * ```typescript
 * function processModel(config: ModelConfig) {
 *   if (isBedrockConfig(config)) {
 *     // TypeScript knows config.region is available here
 *     console.log(`Bedrock region: ${config.region ?? "default"}`);
 *   }
 * }
 * ```
 */
export function isBedrockConfig(config: ModelConfig): config is BedrockModelConfig {
  return config.provider === "bedrock";
}

/**
 * Type guard to check if a ModelConfig is an OpenAI configuration.
 *
 * @example
 * ```typescript
 * if (isOpenAIConfig(config)) {
 *   // TypeScript knows config.apiKeyRef is available here
 *   const keyRef = config.apiKeyRef ?? "OPENAI_API_KEY";
 * }
 * ```
 */
export function isOpenAIConfig(config: ModelConfig): config is OpenAIModelConfig {
  return config.provider === "openai";
}

/**
 * Type guard to check if a ModelConfig is a Gemini configuration.
 *
 * @example
 * ```typescript
 * if (isGeminiConfig(config)) {
 *   // TypeScript knows config.apiKeyRef is available here
 *   const keyRef = config.apiKeyRef ?? "GEMINI_API_KEY";
 * }
 * ```
 */
export function isGeminiConfig(config: ModelConfig): config is GeminiModelConfig {
  return config.provider === "gemini";
}

// ─── Validation Functions ────────────────────────────────────────────────────

/**
 * Supported model providers for validation.
 */
export const SUPPORTED_PROVIDERS: readonly ModelProvider[] = ["bedrock", "openai", "gemini"] as const;

/**
 * Check if a string is a valid model provider.
 *
 * @example
 * ```typescript
 * const provider = "bedrock";
 * if (isValidProvider(provider)) {
 *   // provider is now typed as ModelProvider
 * }
 * ```
 */
export function isValidProvider(provider: string): provider is ModelProvider {
  return SUPPORTED_PROVIDERS.includes(provider as ModelProvider);
}

/**
 * Validate that an object is a valid ModelConfig.
 * Returns true if the object has the correct shape for any provider.
 *
 * @example
 * ```typescript
 * const userInput = JSON.parse(request.body);
 * if (isValidModelConfig(userInput)) {
 *   // userInput is now typed as ModelConfig
 *   processModelConfig(userInput);
 * }
 * ```
 */
export function isValidModelConfig(value: unknown): value is ModelConfig {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  if (typeof obj.provider !== "string" || typeof obj.modelId !== "string") {
    return false;
  }

  if (!isValidProvider(obj.provider)) {
    return false;
  }

  // Provider-specific validation
  switch (obj.provider) {
    case "bedrock":
      // region is optional string
      if (obj.region !== undefined && typeof obj.region !== "string") {
        return false;
      }
      break;
    case "openai":
    case "gemini":
      // apiKeyRef is optional string
      if (obj.apiKeyRef !== undefined && typeof obj.apiKeyRef !== "string") {
        return false;
      }
      break;
  }

  return true;
}

/**
 * Validate that an object is a valid AvailableModel.
 *
 * @example
 * ```typescript
 * const model = fetchedData;
 * if (isValidAvailableModel(model)) {
 *   // model is now typed as AvailableModel
 * }
 * ```
 */
export function isValidAvailableModel(value: unknown): value is AvailableModel {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  return (
    typeof obj.provider === "string" &&
    isValidProvider(obj.provider) &&
    typeof obj.modelId === "string" &&
    typeof obj.displayName === "string" &&
    (obj.description === undefined || typeof obj.description === "string") &&
    typeof obj.isDefault === "boolean"
  );
}

// ─── Conversion Utilities ────────────────────────────────────────────────────

/**
 * Convert an AvailableModel to a ModelConfig for use in workflow input.
 *
 * @example
 * ```typescript
 * const selectedModel = models.find(m => m.modelId === "gpt-4");
 * if (selectedModel) {
 *   const config = availableModelToConfig(selectedModel);
 *   // config is now a valid ModelConfig
 * }
 * ```
 */
export function availableModelToConfig(model: AvailableModel): ModelConfig {
  switch (model.provider) {
    case "bedrock":
      return {
        provider: "bedrock",
        modelId: model.modelId,
      };
    case "openai":
      return {
        provider: "openai",
        modelId: model.modelId,
      };
    case "gemini":
      return {
        provider: "gemini",
        modelId: model.modelId,
      };
  }
}

/**
 * Get a human-readable description of a ModelConfig.
 *
 * @example
 * ```typescript
 * const config: ModelConfig = { provider: "bedrock", modelId: "claude-3" };
 * console.log(describeModelConfig(config)); // "bedrock:claude-3"
 * ```
 */
export function describeModelConfig(config: ModelConfig): string {
  return `${config.provider}:${config.modelId}`;
}

/**
 * Get a log-friendly representation of a ModelConfig or undefined.
 * Used for logging agent invocations.
 *
 * @example
 * ```typescript
 * console.log(`[AgentInvoke] model=${modelConfigToLogString(state.modelOverride)}`);
 * // Output: "[AgentInvoke] model=bedrock:claude-3" or "[AgentInvoke] model=default"
 * ```
 */
export function modelConfigToLogString(config: ModelConfig | undefined): string {
  if (!config) {
    return "default";
  }
  return describeModelConfig(config);
}
