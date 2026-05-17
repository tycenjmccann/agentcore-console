/**
 * Workflow Engine Integration - Model Override Support
 * 
 * This module handles model selection for agent invocations based on:
 * - WorkflowInput.modelOverride configuration
 * - Agent phase (requirements agents always use default)
 * - Default fallback to Claude Sonnet 4.5
 */

import type { WorkflowInput, AgentDefinition, ModelConfig } from "./types";

const DEFAULT_MODEL: ModelConfig = {
  provider: "bedrock",
  modelId: "global.anthropic.claude-sonnet-4-5-20250929-v1:0",
};

/**
 * Determine which model to use for an agent invocation.
 * 
 * Rules:
 * 1. Requirements agents ALWAYS use default (no override)
 * 2. Design + development agents use override if provided
 * 3. If no override specified, use default
 * 
 * @param workflowInput - The workflow input containing optional modelOverride
 * @param agentDef - The agent definition (contains phase info)
 * @param workflowId - Workflow ID for logging
 * @returns ModelConfig to use for this invocation
 */
export function selectModelForAgent(
  workflowInput: WorkflowInput,
  agentDef: AgentDefinition,
  workflowId: string
): ModelConfig {
  // Requirements agent always uses default
  if (agentDef.phase === "requirements") {
    console.log(
      `[Workflow ${workflowId}] Agent ${agentDef.id} (${agentDef.phase}): Using default model (requirements phase)`
    );
    return DEFAULT_MODEL;
  }

  // Check for model override in workflow input
  if (workflowInput.modelOverride) {
    const override = workflowInput.modelOverride;
    console.log(
      `[Workflow ${workflowId}] Agent ${agentDef.id} (${agentDef.phase}): ` +
        `Using override ${override.provider}:${override.modelId}`
    );
    return override;
  }

  // Default fallback
  console.log(
    `[Workflow ${workflowId}] Agent ${agentDef.id} (${agentDef.phase}): Using default model (no override)`
  );
  return DEFAULT_MODEL;
}

/**
 * Validate that a ModelConfig is properly formatted.
 * @returns Error message if invalid, null if valid
 */
export function validateModelConfig(config: ModelConfig): string | null {
  if (!config.provider || !config.modelId) {
    return "ModelConfig must have provider and modelId fields";
  }

  if (!["bedrock", "openai", "gemini"].includes(config.provider)) {
    return `Invalid provider: ${config.provider}. Must be bedrock, openai, or gemini`;
  }

  if (config.provider === "bedrock" && !config.modelId.includes(".")) {
    return `Invalid Bedrock modelId format: ${config.modelId}. Expected format: provider.model-name`;
  }

  return null;
}
