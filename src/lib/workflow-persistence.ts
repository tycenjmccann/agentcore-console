/**
 * Workflow State Persistence
 * 
 * Handles loading/saving workflow state with proper modelConfig handling
 */

import { WorkflowState, ModelConfig, DEFAULT_MODEL_CONFIG } from '@/types/workflow';

// ============================================================================
// Storage Interface
// ============================================================================

export interface WorkflowStorage {
  load(workflowId: string): Promise<WorkflowState | null>;
  save(workflowState: WorkflowState): Promise<void>;
}

// ============================================================================
// In-Memory Storage (for testing/development)
// ============================================================================

export class InMemoryWorkflowStorage implements WorkflowStorage {
  private storage = new Map<string, WorkflowState>();
  
  async load(workflowId: string): Promise<WorkflowState | null> {
    return this.storage.get(workflowId) || null;
  }
  
  async save(workflowState: WorkflowState): Promise<void> {
    this.storage.set(workflowState.workflowId, workflowState);
  }
}

// ============================================================================
// S3 Storage Implementation
// ============================================================================

export class S3WorkflowStorage implements WorkflowStorage {
  private bucket: string;
  private s3Client: any; // AWS SDK S3Client
  
  constructor(bucket: string, s3Client?: any) {
    this.bucket = bucket;
    this.s3Client = s3Client;
  }
  
  async load(workflowId: string): Promise<WorkflowState | null> {
    try {
      // Implementation would use S3 GetObject
      // const { Body } = await this.s3Client.send(new GetObjectCommand({ ... }));
      // return JSON.parse(await Body.transformToString());
      throw new Error('S3 storage not yet implemented');
    } catch (error) {
      console.error(`Failed to load workflow ${workflowId}:`, error);
      return null;
    }
  }
  
  async save(workflowState: WorkflowState): Promise<void> {
    try {
      // Implementation would use S3 PutObject
      // await this.s3Client.send(new PutObjectCommand({ ... }));
      throw new Error('S3 storage not yet implemented');
    } catch (error) {
      console.error(
        `Failed to save workflow ${workflowState.workflowId}:`,
        error
      );
      throw error;
    }
  }
}

// ============================================================================
// Workflow State Initialization
// ============================================================================

/**
 * Initialize a new workflow state with proper defaults
 * 
 * @param params - Workflow initialization parameters
 * @returns Initialized workflow state
 */
export function initializeWorkflowState(params: {
  workflowId: string;
  requirements: string;
  tickets: any[];
  modelConfig?: ModelConfig;
}): WorkflowState {
  const now = new Date().toISOString();
  
  return {
    workflowId: params.workflowId,
    status: 'pending',
    requirements: params.requirements,
    tickets: params.tickets.map((t, idx) => ({
      id: t.id || `ticket-${idx + 1}`,
      title: t.title,
      description: t.description,
      assignee: t.assignee,
      status: 'pending',
      blockedBy: t.blockedBy || [],
      artifacts: [],
      createdAt: now,
      updatedAt: now
    })),
    // Include modelConfig if provided, otherwise leave undefined for fallback
    modelConfig: params.modelConfig,
    createdAt: now,
    updatedAt: now
  };
}

/**
 * Migrate legacy workflow state to include modelConfig support
 * Handles backward compatibility with existing workflows
 * 
 * @param state - Workflow state (may be missing modelConfig)
 * @returns Migrated workflow state
 */
export function migrateWorkflowState(state: any): WorkflowState {
  // If modelConfig is missing, it will be undefined
  // The engine will detect this and use the default
  return {
    ...state,
    // Preserve existing modelConfig if present, otherwise undefined
    modelConfig: state.modelConfig || undefined
  };
}

/**
 * Update workflow state with new model configuration
 * 
 * @param workflowState - Current workflow state
 * @param modelConfig - New model configuration
 * @returns Updated workflow state
 */
export function updateWorkflowModelConfig(
  workflowState: WorkflowState,
  modelConfig: ModelConfig
): WorkflowState {
  console.log(
    `[Workflow ${workflowState.workflowId}] Updating model config to ${modelConfig.provider}/${modelConfig.displayName}`
  );
  
  return {
    ...workflowState,
    modelConfig,
    updatedAt: new Date().toISOString()
  };
}

// ============================================================================
// Workflow State Queries
// ============================================================================

/**
 * Check if workflow state is compatible with current version
 * 
 * @param state - Workflow state to check
 * @returns True if compatible
 */
export function isWorkflowStateValid(state: any): state is WorkflowState {
  return (
    typeof state === 'object' &&
    state !== null &&
    typeof state.workflowId === 'string' &&
    typeof state.status === 'string' &&
    typeof state.requirements === 'string' &&
    Array.isArray(state.tickets) &&
    typeof state.createdAt === 'string' &&
    typeof state.updatedAt === 'string'
  );
}

/**
 * Get display name for workflow model configuration
 * 
 * @param workflowState - Workflow state
 * @returns Display string (e.g., "Bedrock - Claude Sonnet 4.5")
 */
export function getWorkflowModelDisplay(workflowState: WorkflowState): string {
  const config = workflowState.modelConfig || DEFAULT_MODEL_CONFIG;
  const providerName = {
    bedrock: 'Bedrock',
    openai: 'OpenAI',
    gemini: 'Google Gemini'
  }[config.provider];
  
  return `${providerName} - ${config.displayName}`;
}
