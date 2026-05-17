/**
 * Model Configuration Utilities
 * 
 * Provides conversion, validation, and utility functions for ModelConfig.
 * Used by the workflow engine to pass model configuration to dev agent invocations.
 */

import type { ModelConfig, BedrockModelConfig, ModelProvider } from "./types";
import { DEFAULT_MODEL, isBedrockModel, isOpenAIModel, isGeminiModel } from "./types";
import { getAgentDef } from "./agents";

// ─── Supported Models ────────────────────────────────────────────────────────

/**
 * List of supported model IDs for each provider.
 * Used for validation when model config is provided.
 */
export const SUPPORTED_MODELS: Record<ModelProvider, string[]> = {
  bedrock: [
    "anthropic.claude-sonnet-4-5-v1",
    "anthropic.claude-sonnet-4-5-20250514-v1:0",
    "anthropic.claude-opus-4",
    "anthropic.claude-opus-4-20250514-v1:0",
    "global.anthropic.claude-sonnet-4-5-20250929-v1:0",
    "global.anthropic.claude-opus-4-20250514-v1:0",
    "anthropic.claude-3-5-sonnet-20240620-v1:0",
    "anthropic.claude-3-5-sonnet-20241022-v2:0",
  ],
  openai: [
    "gpt-4",
    "gpt-4-turbo",
    "gpt-4-turbo-preview",
    "gpt-4o",
    "gpt-4o-mini",
  ],
  gemini: [
    "gemini-pro",
    "gemini-ultra",
    "gemini-1.5-pro",
    "gemini-1.5-flash",
  ],
};

// ─── Model Config Conversion ─────────────────────────────────────────────────

/**
 * Error thrown when a model configuration is invalid or unsupported.
 */
export class UnsupportedModelError extends Error {
  constructor(
    public readonly provider: string,
    public readonly modelId: string,
    message?: string
  ) {
    super(message || `Unsupported model: ${provider}:${modelId}`);
    this.name = "UnsupportedModelError";
  }
}

/**
 * Convert a ModelConfig to the string format expected by AgentCore InvokeHarnessCommand.
 * 
 * @param config - The model configuration to convert
 * @returns A string in the format expected by AgentCore:
 *   - Bedrock: modelId directly (e.g., "anthropic.claude-opus-4")
 *   - OpenAI: "openai:{modelId}" (e.g., "openai:gpt-4-turbo")
 *   - Gemini: "gemini:{modelId}" (e.g., "gemini:gemini-pro")
 * @throws UnsupportedModelError if the model is not in the supported list
 * 
 * @example
 * modelConfigToAgentCoreFormat({ provider: "bedrock", modelId: "anthropic.claude-opus-4" })
 * // Returns: "anthropic.claude-opus-4"
 * 
 * modelConfigToAgentCoreFormat({ provider: "openai", modelId: "gpt-4-turbo" })
 * // Returns: "openai:gpt-4-turbo"
 */
export function modelConfigToAgentCoreFormat(config: ModelConfig): string {
  // Validate the model is supported (warning only, don't block)
  const supportedModels = SUPPORTED_MODELS[config.provider] || [];
  if (!supportedModels.includes(config.modelId)) {
    console.warn(
      `[model-utils] Model "${config.modelId}" is not in the known list for provider "${config.provider}". ` +
      `Proceeding anyway, but this may fail if the model is invalid.`
    );
  }

  switch (config.provider) {
    case "bedrock":
      // Bedrock models are passed directly as the modelId
      return config.modelId;
    case "openai":
      // OpenAI models are prefixed with "openai:"
      return `openai:${config.modelId}`;
    case "gemini":
      // Gemini models are prefixed with "gemini:"
      return `gemini:${config.modelId}`;
    default:
      // TypeScript exhaustiveness check - this should never happen
      const _exhaustive: never = config;
      throw new UnsupportedModelError(
        (config as ModelConfig).provider,
        (config as ModelConfig).modelId,
        `Unknown model provider`
      );
  }
}

// ─── Dev Agent Detection ─────────────────────────────────────────────────────

/**
 * List of agent IDs that are considered "dev agents" (development phase).
 * Model override only applies to these agents.
 */
export const DEV_AGENT_IDS = [
  "team-backend-dev",
  "team-api-dev",
  "team-frontend-dev",
] as const;

export type DevAgentId = typeof DEV_AGENT_IDS[number];

/**
 * Check if an agent ID is a development agent.
 * Model override only applies to dev agents to maintain consistency
 * in requirements and design phases.
 * 
 * @param agentId - The agent ID to check
 * @returns True if the agent is a development phase agent
 * 
 * @example
 * isDevAgent("team-backend-dev") // true
 * isDevAgent("team-ios-designer") // false
 * isDevAgent("team-requirements-analyst") // false
 */
export function isDevAgent(agentId: string): agentId is DevAgentId {
  // Check if explicitly in the dev agent list
  if ((DEV_AGENT_IDS as readonly string[]).includes(agentId)) {
    return true;
  }
  
  // Also check via agent definition phase
  const agentDef = getAgentDef(agentId);
  return agentDef?.phase === "development";
}

// ─── Model Config Validation ─────────────────────────────────────────────────

/**
 * Validate a model configuration.
 * 
 * @param config - The configuration to validate
 * @returns An object with isValid and optional error message
 */
export function validateModelConfig(config: ModelConfig): { isValid: boolean; error?: string } {
  // Check provider is valid
  if (!config.provider || !["bedrock", "openai", "gemini"].includes(config.provider)) {
    return { isValid: false, error: `Invalid provider: ${config.provider}` };
  }

  // Check modelId is present
  if (!config.modelId || typeof config.modelId !== "string") {
    return { isValid: false, error: "Model ID is required" };
  }

  // For external providers, check if API key is available (via env vars)
  if (config.provider === "openai") {
    if (!process.env.OPENAI_API_KEY && !(config as { apiKey?: string }).apiKey) {
      return { 
        isValid: false, 
        error: "OpenAI API key not configured. Set OPENAI_API_KEY environment variable." 
      };
    }
  }

  if (config.provider === "gemini") {
    if (!process.env.GEMINI_API_KEY && !(config as { apiKey?: string }).apiKey) {
      return { 
        isValid: false, 
        error: "Gemini API key not configured. Set GEMINI_API_KEY environment variable." 
      };
    }
  }

  return { isValid: true };
}

/**
 * Get the effective model config, applying defaults if not provided.
 * 
 * @param config - Optional model configuration from WorkflowInput
 * @returns The model configuration to use (defaults to DEFAULT_MODEL if not provided)
 */
export function getEffectiveModelConfig(config?: ModelConfig): ModelConfig {
  return config || DEFAULT_MODEL;
}

/**
 * Get a human-readable description of a model configuration.
 * Useful for logging and audit trails.
 * 
 * @param config - The model configuration
 * @returns A string like "Bedrock: anthropic.claude-sonnet-4-5-v1"
 */
export function getModelDisplayName(config: ModelConfig): string {
  const providerNames: Record<ModelProvider, string> = {
    bedrock: "Bedrock",
    openai: "OpenAI",
    gemini: "Gemini",
  };
  return `${providerNames[config.provider]}: ${config.modelId}`;
}

// ─── Exports ─────────────────────────────────────────────────────────────────

export type { ModelConfig, BedrockModelConfig, ModelProvider };
export { DEFAULT_MODEL, isBedrockModel, isOpenAIModel, isGeminiModel };
