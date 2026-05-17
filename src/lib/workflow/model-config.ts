/**
 * Model Configuration Types
 * Discriminated union for AI model provider selection
 */

export type ModelProvider = "bedrock" | "openai" | "gemini";

export type ModelConfig =
  | { provider: "bedrock"; modelId: string }
  | { provider: "openai"; modelId: string }
  | { provider: "gemini"; modelId: string };

export interface AvailableModel {
  provider: ModelProvider;
  modelId: string;
  displayName: string;
  description?: string;
  isDefault: boolean;
}

export interface ModelsResponse {
  models: AvailableModel[];
}
