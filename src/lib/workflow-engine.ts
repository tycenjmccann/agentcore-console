/**
 * Workflow Engine
 * 
 * Orchestrates workflow execution, manages ticket dependencies,
 * and invokes agents with proper model configuration.
 */

import {
  BedrockAgentCoreClient,
  InvokeHarnessCommand,
  InvokeHarnessCommandInput,
  InvokeHarnessCommandOutput
} from '@aws-sdk/client-bedrock-agentcore';
import {
  WorkflowState,
  WorkflowTicket,
  ModelConfig,
  InvokeHarnessModelParam,
  DEFAULT_MODEL_CONFIG
} from '@/types/workflow';

// ============================================================================
// Types
// ============================================================================

interface AgentInvocationContext {
  workflowId: string;
  ticketId: string;
  agentId: string;
  message: string;
  modelConfig: ModelConfig;
}

interface EngineConfig {
  region?: string;
  client?: BedrockAgentCoreClient;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Transform ModelConfig into InvokeHarnessCommand model parameter format
 * 
 * @param modelConfig - The workflow model configuration
 * @returns Model parameter in SDK format
 */
export function buildModelParameter(modelConfig: ModelConfig): InvokeHarnessModelParam {
  switch (modelConfig.provider) {
    case 'bedrock':
      if (!modelConfig.bedrockModelConfig) {
        throw new Error('Bedrock model config missing bedrockModelConfig field');
      }
      return { bedrockModelConfig: modelConfig.bedrockModelConfig };
    
    case 'openai':
      if (!modelConfig.openAiModelConfig) {
        throw new Error('OpenAI model config missing openAiModelConfig field');
      }
      return { openAiModelConfig: modelConfig.openAiModelConfig };
    
    case 'gemini':
      if (!modelConfig.geminiModelConfig) {
        throw new Error('Gemini model config missing geminiModelConfig field');
      }
      return { geminiModelConfig: modelConfig.geminiModelConfig };
    
    default:
      throw new Error(`Unknown model provider: ${(modelConfig as any).provider}`);
  }
}

/**
 * Get model configuration for workflow with fallback logic
 * 
 * @param workflowState - Current workflow state
 * @returns Model configuration to use (falls back to default if undefined)
 */
export function getWorkflowModelConfig(workflowState: WorkflowState): ModelConfig {
  // Use workflow-specific config if available
  if (workflowState.modelConfig) {
    return workflowState.modelConfig;
  }
  
  // Fallback to default (Claude Sonnet 4.5)
  console.log(
    `[Workflow ${workflowState.workflowId}] No modelConfig found, using default: ${DEFAULT_MODEL_CONFIG.displayName}`
  );
  return DEFAULT_MODEL_CONFIG;
}

/**
 * Populate API key ARNs from environment variables
 * 
 * @param modelConfig - Model config (may have empty apiKeyArn fields)
 * @returns Model config with ARNs populated from env vars
 */
export function populateApiKeyArns(modelConfig: ModelConfig): ModelConfig {
  const config = { ...modelConfig };
  
  if (config.provider === 'openai' && config.openAiModelConfig) {
    const arnFromEnv = process.env.OPENAI_API_KEY_ARN;
    if (!arnFromEnv) {
      throw new Error(
        'OpenAI model selected but OPENAI_API_KEY_ARN environment variable not set'
      );
    }
    config.openAiModelConfig = {
      ...config.openAiModelConfig,
      apiKeyArn: arnFromEnv
    };
  }
  
  if (config.provider === 'gemini' && config.geminiModelConfig) {
    const arnFromEnv = process.env.GEMINI_API_KEY_ARN;
    if (!arnFromEnv) {
      throw new Error(
        'Gemini model selected but GEMINI_API_KEY_ARN environment variable not set'
      );
    }
    config.geminiModelConfig = {
      ...config.geminiModelConfig,
      apiKeyArn: arnFromEnv
    };
  }
  
  return config;
}

// ============================================================================
// Workflow Engine Class
// ============================================================================

export class WorkflowEngine {
  private client: BedrockAgentCoreClient;
  
  constructor(config: EngineConfig = {}) {
    this.client = config.client || new BedrockAgentCoreClient({
      region: config.region || process.env.AWS_REGION || 'us-east-1'
    });
  }
  
  /**
   * Invoke an agent with workflow-specific model configuration
   * 
   * @param context - Agent invocation context including model config
   * @returns Agent response stream
   */
  async invokeAgent(context: AgentInvocationContext): Promise<InvokeHarnessCommandOutput> {
    const { workflowId, ticketId, agentId, message, modelConfig } = context;
    
    // Populate API key ARNs from environment if needed
    const configWithArns = populateApiKeyArns(modelConfig);
    
    // Transform to SDK format
    const modelParam = buildModelParameter(configWithArns);
    
    // Log which model is being used
    console.log(
      `[Workflow ${workflowId}] [Ticket ${ticketId}] Invoking agent ${agentId} with model: ${configWithArns.provider}/${configWithArns.displayName}`
    );
    
    // Build invocation input
    const input: InvokeHarnessCommandInput = {
      harnessId: agentId,
      inputText: message,
      sessionId: `workflow-${workflowId}-ticket-${ticketId}`,
      model: modelParam,
      // Optional: Add streaming configuration
      enableTrace: true
    };
    
    // Invoke the harness
    const command = new InvokeHarnessCommand(input);
    return await this.client.send(command);
  }
  
  /**
   * Execute a single ticket in the workflow
   * 
   * @param workflowState - Current workflow state
   * @param ticket - Ticket to execute
   * @returns Updated ticket with results
   */
  async executeTicket(
    workflowState: WorkflowState,
    ticket: WorkflowTicket
  ): Promise<WorkflowTicket> {
    try {
      // Get model config for this workflow (with fallback)
      const modelConfig = getWorkflowModelConfig(workflowState);
      
      // Build agent message
      const message = this.buildAgentMessage(workflowState, ticket);
      
      // Invoke agent with model configuration
      const response = await this.invokeAgent({
        workflowId: workflowState.workflowId,
        ticketId: ticket.id,
        agentId: ticket.assignee,
        message,
        modelConfig
      });
      
      // Process response (simplified - actual implementation would parse stream)
      const artifacts = await this.processAgentResponse(response);
      
      // Update ticket
      return {
        ...ticket,
        status: 'completed',
        artifacts,
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error(
        `[Workflow ${workflowState.workflowId}] Ticket ${ticket.id} failed:`,
        error
      );
      
      return {
        ...ticket,
        status: 'failed',
        updatedAt: new Date().toISOString()
      };
    }
  }
  
  /**
   * Execute the entire workflow
   * Handles ticket dependencies and orchestration
   * 
   * @param workflowState - Current workflow state
   * @returns Updated workflow state
   */
  async executeWorkflow(workflowState: WorkflowState): Promise<WorkflowState> {
    console.log(
      `[Workflow ${workflowState.workflowId}] Starting execution with ${workflowState.tickets.length} tickets`
    );
    
    // Get model config and log it
    const modelConfig = getWorkflowModelConfig(workflowState);
    console.log(
      `[Workflow ${workflowState.workflowId}] Model configuration: ${modelConfig.provider}/${modelConfig.displayName}`
    );
    
    let updatedTickets = [...workflowState.tickets];
    let hasChanges = true;
    
    // Execute tickets respecting dependencies
    while (hasChanges) {
      hasChanges = false;
      
      for (let i = 0; i < updatedTickets.length; i++) {
        const ticket = updatedTickets[i];
        
        // Skip if already processed
        if (ticket.status === 'completed' || ticket.status === 'failed') {
          continue;
        }
        
        // Check if dependencies are met
        if (this.areDependenciesMet(ticket, updatedTickets)) {
          console.log(
            `[Workflow ${workflowState.workflowId}] Executing ticket ${ticket.id}: ${ticket.title}`
          );
          
          // Execute ticket
          const updatedTicket = await this.executeTicket(workflowState, ticket);
          updatedTickets[i] = updatedTicket;
          hasChanges = true;
        } else {
          // Mark as blocked
          if (ticket.status !== 'blocked') {
            updatedTickets[i] = {
              ...ticket,
              status: 'blocked',
              updatedAt: new Date().toISOString()
            };
            hasChanges = true;
          }
        }
      }
    }
    
    // Determine overall workflow status
    const allCompleted = updatedTickets.every(t => t.status === 'completed');
    const anyFailed = updatedTickets.some(t => t.status === 'failed');
    
    return {
      ...workflowState,
      tickets: updatedTickets,
      status: anyFailed ? 'failed' : (allCompleted ? 'completed' : 'in_progress'),
      updatedAt: new Date().toISOString(),
      completedAt: allCompleted ? new Date().toISOString() : undefined
    };
  }
  
  // ============================================================================
  // Private Helper Methods
  // ============================================================================
  
  private buildAgentMessage(workflowState: WorkflowState, ticket: WorkflowTicket): string {
    return `
# Your Assignment: ${ticket.title}

## Ticket
ID: ${ticket.id}
Description: ${ticket.description}

## Requirements
${workflowState.requirements}

## Workflow Context
workflow_id: ${workflowState.workflowId}
agent_id: ${ticket.assignee}
    `.trim();
  }
  
  private areDependenciesMet(
    ticket: WorkflowTicket,
    allTickets: WorkflowTicket[]
  ): boolean {
    if (!ticket.blockedBy || ticket.blockedBy.length === 0) {
      return true;
    }
    
    return ticket.blockedBy.every(depId => {
      const dep = allTickets.find(t => t.id === depId);
      return dep?.status === 'completed';
    });
  }
  
  private async processAgentResponse(
    response: InvokeHarnessCommandOutput
  ): Promise<string[]> {
    // Simplified - actual implementation would parse the response stream
    // and extract artifacts (S3 paths, PR URLs, etc.)
    return [];
  }
}

// ============================================================================
// Exported Functions for Direct Use
// ============================================================================

/**
 * Create a workflow engine instance
 */
export function createWorkflowEngine(config?: EngineConfig): WorkflowEngine {
  return new WorkflowEngine(config);
}

/**
 * Execute a workflow with proper model configuration
 * Convenience function for single-shot execution
 */
export async function executeWorkflow(
  workflowState: WorkflowState,
  config?: EngineConfig
): Promise<WorkflowState> {
  const engine = createWorkflowEngine(config);
  return engine.executeWorkflow(workflowState);
}
