/**
 * Model Override Integration for Workflow Engine
 * 
 * This module provides the integration layer between the workflow engine's
 * invokeAgent function and the model configuration utilities.
 * 
 * Usage in engine.ts:
 * 1. Import: import { getModelOverrideForAgent } from "./model-integration";
 * 2. Call before invokeHarnessAgent: const modelOverride = getModelOverrideForAgent(workflowId, agentId);
 * 3. Pass to invokeHarnessAgent: { ..., modelOverride }
 */

import { getWorkflow } from "./store";
import { 
  isDevAgent, 
  modelConfigToAgentCoreFormat, 
  getModelDisplayName,
  getEffectiveModelConfig
} from "./model-utils";
import { DEFAULT_MODEL, type ModelConfig } from "./types";

/**
 * Determine the model override string for an agent invocation.
 * 
 * Returns undefined (use default) for:
 * - Non-dev agents (requirements, design phases)
 * - When no model config is specified
 * - When the specified model is the same as the default
 * 
 * Returns the AgentCore-formatted model string for:
 * - Dev agents with a non-default model specified in the workflow
 * 
 * @param workflowId - The workflow ID to get model config from
 * @param agentId - The agent ID to check
 * @returns The model override string or undefined
 * 
 * @example
 * const modelOverride = getModelOverrideForAgent(workflowId, "team-backend-dev");
 * // Returns "anthropic.claude-opus-4" if workflow has Opus configured
 * // Returns undefined if agent is not a dev agent or using default model
 */
export function getModelOverrideForAgent(
  workflowId: string, 
  agentId: string
): string | undefined {
  // Only apply model override to dev agents
  if (!isDevAgent(agentId)) {
    return undefined;
  }

  // Get the workflow's model config
  const state = getWorkflow(workflowId);
  const modelConfig = state?.modelConfig;

  // No model config or same as default → no override
  if (!modelConfig || modelConfig.modelId === DEFAULT_MODEL.modelId) {
    return undefined;
  }

  // Log the override for audit trail
  const displayName = getModelDisplayName(modelConfig);
  console.log(`[model-integration] Dev agent ${agentId} using model override: ${displayName}`);

  // Convert to AgentCore format
  return modelConfigToAgentCoreFormat(modelConfig);
}

/**
 * Extract and validate model config from workflow input.
 * Used by startWorkflow to initialize the workflow state.
 * 
 * @param inputModelConfig - Optional model config from WorkflowInput
 * @returns The effective model config (input or default)
 */
export function extractModelConfig(inputModelConfig?: ModelConfig): ModelConfig {
  const config = getEffectiveModelConfig(inputModelConfig);
  console.log(`[model-integration] Workflow model config: ${getModelDisplayName(config)}`);
  return config;
}

/**
 * Log model invocation details for audit trail.
 * Call this before invoking an agent.
 * 
 * @param workflowId - The workflow ID
 * @param agentId - The agent being invoked
 * @param modelOverride - The model override being used (or undefined)
 */
export function logModelInvocation(
  workflowId: string,
  agentId: string,
  modelOverride?: string
): void {
  const state = getWorkflow(workflowId);
  const baseModel = state?.modelConfig 
    ? getModelDisplayName(state.modelConfig) 
    : getModelDisplayName(DEFAULT_MODEL);

  if (modelOverride) {
    console.log(`[engine] Agent ${agentId} invocation:
  - Workflow model config: ${baseModel}
  - Model override applied: ${modelOverride}
  - Timestamp: ${new Date().toISOString()}`);
  } else {
    console.log(`[engine] Agent ${agentId} invocation:
  - Using harness default model (no override)
  - Timestamp: ${new Date().toISOString()}`);
  }
}
