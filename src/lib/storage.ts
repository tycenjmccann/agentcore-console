// storage.ts - WorkflowState persistence to S3
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { WorkflowState, ModelConfig } from './types';

const BUCKET_NAME = process.env.WORKFLOW_STATE_BUCKET || 'agentis-workflow-states';
const s3Client = new S3Client({});

/**
 * Load workflow state from S3
 */
export async function loadWorkflowState(
  workflowId: string
): Promise<WorkflowState | null> {
  const key = `workflows/${workflowId}/state.json`;
  
  try {
    console.log(`[Storage] Loading workflow state: ${workflowId}`);
    
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key
    });
    
    const response = await s3Client.send(command);
    const body = await response.Body?.transformToString();
    
    if (!body) {
      console.error(`[Storage] Empty response body for workflow: ${workflowId}`);
      return null;
    }
    
    const state = JSON.parse(body) as WorkflowState;
    
    console.log(`[Storage] Loaded workflow state: ${workflowId}`);
    console.log(`[Storage] Status: ${state.status}`);
    console.log(`[Storage] Model: ${state.modelConfig?.displayName || 'default'}`);
    
    return state;
  } catch (error: any) {
    if (error.name === 'NoSuchKey') {
      console.log(`[Storage] Workflow not found: ${workflowId}`);
      return null;
    }
    
    console.error(`[Storage] Error loading workflow state: ${workflowId}`, error);
    throw error;
  }
}

/**
 * Save workflow state to S3
 * Ensures modelConfig is persisted along with other state
 */
export async function saveWorkflowState(
  state: WorkflowState
): Promise<void> {
  const key = `workflows/${state.workflowId}/state.json`;
  
  try {
    console.log(`[Storage] Saving workflow state: ${state.workflowId}`);
    console.log(`[Storage] Status: ${state.status}`);
    console.log(`[Storage] Model: ${state.modelConfig?.displayName || 'default'}`);
    
    // Update timestamp
    state.updatedAt = new Date().toISOString();
    
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: JSON.stringify(state, null, 2),
      ContentType: 'application/json'
    });
    
    await s3Client.send(command);
    
    console.log(`[Storage] Saved workflow state: ${state.workflowId}`);
  } catch (error) {
    console.error(`[Storage] Error saving workflow state: ${state.workflowId}`, error);
    throw error;
  }
}

/**
 * Initialize a new workflow state
 */
export async function initializeWorkflowState(
  workflowId: string,
  title: string,
  description: string,
  requirements: string,
  modelConfig?: ModelConfig
): Promise<WorkflowState> {
  const now = new Date().toISOString();
  
  const state: WorkflowState = {
    workflowId,
    title,
    description,
    requirements,
    status: 'planning',
    modelConfig, // Persist model configuration
    tickets: [],
    createdAt: now,
    updatedAt: now
  };
  
  console.log(`[Storage] Initializing workflow: ${workflowId}`);
  console.log(`[Storage] Model: ${modelConfig?.displayName || 'default'}`);
  
  await saveWorkflowState(state);
  
  return state;
}

/**
 * List all workflow states
 */
export async function listWorkflowStates(): Promise<WorkflowState[]> {
  // TODO: Implement S3 listing
  // For now, return empty array
  return [];
}
