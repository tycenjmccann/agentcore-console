/**
 * Workflow Engine - Model Configuration Integration
 * 
 * Helper functions for reading model config from WorkflowState and
 * passing it to agent invocations.
 */

import type { WorkflowState, ModelConfig } from "@/lib/workflow/types";
import { toModelConfigPayload, validateModelConfig, getModelDisplayName } from "@/lib/workflow/model-config";
import { invokeHarnessAgent } from "@/lib/agentcore-sdk";
import { DEFAULT_MODEL_CONFIG } from "@/lib/workflow/types";

/**
 * Get the effective model configuration for a workflow
 * Returns the workflow's modelConfig if present, otherwise returns default (Claude Sonnet 4.5)
 * 
 * @param workflowState - Current workflow state
 * @returns Model configuration to use for invocations
 */
export function getWorkflowModelConfig(workflowState: WorkflowState): ModelConfig {
  if (workflowState.modelConfig) {
    // Validate before using
    const validation = validateModelConfig(workflowState.modelConfig);
    if (!validation.valid) {
      console.warn(
        `[Workflow ${workflowState.id}] Invalid model config, falling back to default:`,
        validation.error
      );
      return DEFAULT_MODEL_CONFIG;
    }
    return workflowState.modelConfig;
  }
  
  // Default to Claude Sonnet 4.5
  return DEFAULT_MODEL_CONFIG;
}

/**
 * Invoke a workflow agent with the workflow's model configuration
 * 
 * @param workflowState - Current workflow state
 * @param harnessArn - ARN of the harness to invoke
 * @param prompt - User prompt
 * @param sessionId - Runtime session ID
 * @param options - Additional invocation options
 * @returns Readable stream of agent response
 */
export async function invokeWorkflowAgent(params: {
  workflowState: WorkflowState;
  harnessArn: string;
  prompt: string;
  sessionId: string;
  systemPrompt?: string;
  history?: Array<{ role: string; content: string }>;
  region?: string;
}): Promise<ReadableStream> {
  const modelConfig = getWorkflowModelConfig(params.workflowState);
  const modelPayload = toModelConfigPayload(modelConfig);
  const displayName = getModelDisplayName(modelConfig);
  
  console.log(
    `[Workflow ${params.workflowState.id}] Invoking agent with model: ${displayName}`
  );
  
  // Add structured logging for observability
  console.log(JSON.stringify({
    event: "agent_invocation",
    workflowId: params.workflowState.id,
    harnessArn: params.harnessArn,
    modelType: modelConfig.type,
    modelId: modelConfig.config.modelId,
    timestamp: new Date().toISOString(),
  }));
  
  return invokeHarnessAgent({
    harnessArn: params.harnessArn,
    prompt: params.prompt,
    sessionId: params.sessionId,
    systemPrompt: params.systemPrompt,
    history: params.history,
    region: params.region,
    model: modelPayload, // Pass model config to InvokeHarnessCommand
  });
}

/**
 * Log model configuration for a workflow (called at workflow start)
 * 
 * @param workflowState - Workflow state
 */
export function logWorkflowModelConfig(workflowState: WorkflowState): void {
  const modelConfig = getWorkflowModelConfig(workflowState);
  const displayName = getModelDisplayName(modelConfig);
  
  console.log(
    `[Workflow ${workflowState.id}] Initialized with model: ${displayName}`
  );
  
  // Structured log for monitoring/analytics
  console.log(JSON.stringify({
    event: "workflow_model_config",
    workflowId: workflowState.id,
    modelType: modelConfig.type,
    modelId: modelConfig.config.modelId,
    isDefault: !workflowState.modelConfig,
    timestamp: new Date().toISOString(),
  }));
}
