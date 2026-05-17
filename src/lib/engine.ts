// engine.ts - Workflow execution engine
import { BedrockAgentCoreRuntimeClient, InvokeHarnessCommand } from '@aws-sdk/client-bedrock-agentcore-runtime';
import { WorkflowState, AgentTicket, ModelConfig, DEFAULT_MODEL_CONFIG, toInvokeHarnessModelConfig } from './types';
import { loadWorkflowState, saveWorkflowState } from './storage';

/**
 * Workflow execution engine
 * Orchestrates agent invocations based on workflow state and ticket dependencies
 */
export class WorkflowEngine {
  private client: BedrockAgentCoreRuntimeClient;
  private workflowId: string;
  
  constructor(workflowId: string, region: string = 'us-east-1') {
    this.workflowId = workflowId;
    this.client = new BedrockAgentCoreRuntimeClient({ region });
  }
  
  /**
   * Execute the workflow by processing tickets according to dependencies
   */
  async execute(): Promise<void> {
    console.log(`[Engine] Starting workflow execution: ${this.workflowId}`);
    
    // Load workflow state
    const state = await loadWorkflowState(this.workflowId);
    
    if (!state) {
      throw new Error(`Workflow not found: ${this.workflowId}`);
    }
    
    // Get model configuration (with fallback to default)
    const modelConfig = state.modelConfig || DEFAULT_MODEL_CONFIG;
    console.log(`[Engine] Using model: ${modelConfig.provider} - ${modelConfig.displayName}`);
    console.log(`[Engine] Model ID: ${modelConfig.modelId}`);
    
    // Transform to InvokeHarnessCommand format
    const harnessModelConfig = toInvokeHarnessModelConfig(modelConfig);
    console.log(`[Engine] Harness config:`, JSON.stringify(harnessModelConfig, null, 2));
    
    // Update state to in_progress
    state.status = 'in_progress';
    state.updatedAt = new Date().toISOString();
    await saveWorkflowState(state);
    
    try {
      // Process tickets in dependency order
      await this.processTickets(state, harnessModelConfig);
      
      // Mark workflow as completed
      state.status = 'completed';
      state.updatedAt = new Date().toISOString();
      await saveWorkflowState(state);
      
      console.log(`[Engine] Workflow completed: ${this.workflowId}`);
    } catch (error) {
      console.error(`[Engine] Workflow failed: ${this.workflowId}`, error);
      state.status = 'failed';
      state.updatedAt = new Date().toISOString();
      await saveWorkflowState(state);
      throw error;
    }
  }
  
  /**
   * Process tickets in dependency order
   */
  private async processTickets(
    state: WorkflowState,
    harnessModelConfig: Record<string, any>
  ): Promise<void> {
    const tickets = state.tickets;
    const completed = new Set<string>();
    
    while (completed.size < tickets.length) {
      // Find tickets ready to execute
      const ready = tickets.filter(ticket => {
        // Skip if already completed or failed
        if (ticket.status === 'completed' || ticket.status === 'failed') {
          completed.add(ticket.id);
          return false;
        }
        
        // Skip if blocked by pending dependencies
        if (ticket.blockedBy && ticket.blockedBy.length > 0) {
          const blocked = ticket.blockedBy.some(depId => !completed.has(depId));
          if (blocked) {
            return false;
          }
        }
        
        return true;
      });
      
      if (ready.length === 0) {
        // Check if there are still pending tickets
        const pending = tickets.filter(t => 
          t.status !== 'completed' && t.status !== 'failed'
        );
        
        if (pending.length > 0) {
          console.error('[Engine] Deadlock detected - no tickets ready but some still pending');
          throw new Error('Workflow deadlock: circular dependencies detected');
        }
        
        break; // All tickets processed
      }
      
      // Execute ready tickets in parallel
      await Promise.all(ready.map(ticket => 
        this.executeTicket(state, ticket, harnessModelConfig)
      ));
    }
  }
  
  /**
   * Execute a single ticket by invoking the assigned agent
   */
  private async executeTicket(
    state: WorkflowState,
    ticket: AgentTicket,
    harnessModelConfig: Record<string, any>
  ): Promise<void> {
    console.log(`[Engine] Executing ticket ${ticket.id}: ${ticket.title}`);
    console.log(`[Engine] Agent: ${ticket.assignee}`);
    
    // Update ticket status
    ticket.status = 'in_progress';
    ticket.startedAt = new Date().toISOString();
    ticket.updatedAt = new Date().toISOString();
    await saveWorkflowState(state);
    
    try {
      // Build agent context
      const context = this.buildAgentContext(state, ticket);
      
      // Invoke agent harness with model configuration
      const command = new InvokeHarnessCommand({
        harnessId: ticket.assignee,
        input: {
          text: JSON.stringify(context)
        },
        // Pass model configuration to harness invocation
        model: harnessModelConfig
      });
      
      console.log(`[Engine] Invoking agent ${ticket.assignee} with model:`, 
                  JSON.stringify(harnessModelConfig, null, 2));
      
      const response = await this.client.send(command);
      
      // Extract result from response
      const result = this.extractAgentResult(response);
      
      // Update ticket with result
      ticket.status = 'completed';
      ticket.result = result;
      ticket.completedAt = new Date().toISOString();
      ticket.updatedAt = new Date().toISOString();
      
      console.log(`[Engine] Ticket completed: ${ticket.id}`);
    } catch (error) {
      console.error(`[Engine] Ticket failed: ${ticket.id}`, error);
      
      // Update ticket with error
      ticket.status = 'failed';
      ticket.error = error instanceof Error ? error.message : String(error);
      ticket.updatedAt = new Date().toISOString();
      
      throw error;
    } finally {
      await saveWorkflowState(state);
    }
  }
  
  /**
   * Build agent execution context
   */
  private buildAgentContext(
    state: WorkflowState,
    ticket: AgentTicket
  ): Record<string, any> {
    return {
      workflow_id: state.workflowId,
      agent_id: ticket.assignee,
      ticket: {
        id: ticket.id,
        title: ticket.title,
        description: ticket.description
      },
      requirements: state.requirements,
      // Include results from completed dependencies
      dependencies: ticket.blockedBy?.map(depId => {
        const dep = state.tickets.find(t => t.id === depId);
        return dep ? {
          id: dep.id,
          title: dep.title,
          result: dep.result
        } : null;
      }).filter(Boolean) || []
    };
  }
  
  /**
   * Extract agent result from response
   */
  private extractAgentResult(response: any): string {
    // Handle different response formats
    if (response.output?.text) {
      return response.output.text;
    }
    
    if (typeof response.output === 'string') {
      return response.output;
    }
    
    return JSON.stringify(response.output || {});
  }
}

/**
 * Create and start a workflow execution
 */
export async function executeWorkflow(
  workflowId: string,
  region?: string
): Promise<void> {
  const engine = new WorkflowEngine(workflowId, region);
  await engine.execute();
}
