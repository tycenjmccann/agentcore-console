/**
 * Core type definitions for the Agentis MVP application
 */

/**
 * Model configuration for workflow execution
 */
export interface ModelConfig {
  /** Provider: bedrock, openai, or gemini */
  provider: 'bedrock' | 'openai' | 'gemini';
  
  /** Full model ID */
  modelId: string;
  
  /** Human-readable display name */
  displayName: string;
  
  /** Bedrock model configuration (IAM auth) */
  bedrockModelConfig?: {
    modelId: string;
  };
  
  /** OpenAI model configuration (API key auth) */
  openAiModelConfig?: {
    modelId: string;
    apiKeyArn: string;
  };
  
  /** Gemini model configuration (API key auth) */
  geminiModelConfig?: {
    modelId: string;
    apiKeyArn: string;
  };
}

/**
 * Ticket/Task node in the workflow graph
 */
export interface TicketNode {
  /** Unique ticket ID (e.g., TEAM-123) */
  id: string;
  
  /** Ticket title */
  title: string;
  
  /** Detailed description */
  description?: string;
  
  /** Current status */
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'blocked';
  
  /** Assigned agent ID */
  assignee?: string;
  
  /** List of ticket IDs this ticket is blocked by */
  blockedBy?: string[];
  
  /** Metadata */
  metadata?: Record<string, any>;
  
  /** Created timestamp */
  createdAt?: string;
  
  /** Updated timestamp */
  updatedAt?: string;
}

/**
 * Workflow state - represents a complete workflow execution
 */
export interface WorkflowState {
  /** Unique workflow ID */
  id: string;
  
  /** Workflow name */
  name: string;
  
  /** Workflow description */
  description?: string;
  
  /** Overall workflow status */
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  
  /** List of tickets in this workflow */
  tickets: TicketNode[];
  
  /** Model configuration for this workflow */
  modelConfig?: ModelConfig;
  
  /** Original requirements document */
  requirements?: string;
  
  /** Created timestamp */
  createdAt: string;
  
  /** Updated timestamp */
  updatedAt: string;
  
  /** Completed timestamp */
  completedAt?: string;
  
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * API response wrapper
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Workflow creation request
 */
export interface CreateWorkflowRequest {
  name: string;
  description?: string;
  requirements: string;
  modelConfig?: ModelConfig;
}

/**
 * Workflow execution request
 */
export interface ExecuteWorkflowRequest {
  workflowId: string;
}
