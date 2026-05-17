// app/api/workflows/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { initializeWorkflowState } from '@/lib/storage';
import { ModelConfig, DEFAULT_MODEL_CONFIG } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';

interface CreateWorkflowRequest {
  title: string;
  description: string;
  requirements: string;
  modelConfig?: ModelConfig;
}

/**
 * POST /api/workflows
 * Create a new workflow with optional model configuration
 */
export async function POST(request: NextRequest) {
  try {
    const body: CreateWorkflowRequest = await request.json();
    
    // Validate required fields
    if (!body.title || !body.requirements) {
      return NextResponse.json(
        { error: 'Missing required fields: title, requirements' },
        { status: 400 }
      );
    }
    
    // Generate workflow ID
    const workflowId = `wf_${Date.now()}_${uuidv4().split('-')[0]}`;
    
    // Use provided modelConfig or default
    const modelConfig = body.modelConfig || DEFAULT_MODEL_CONFIG;
    
    console.log(`[API] Creating workflow: ${workflowId}`);
    console.log(`[API] Model: ${modelConfig.provider} - ${modelConfig.displayName}`);
    
    // Initialize workflow state with modelConfig
    const state = await initializeWorkflowState(
      workflowId,
      body.title,
      body.description || '',
      body.requirements,
      modelConfig
    );
    
    return NextResponse.json({
      success: true,
      workflowId: state.workflowId,
      modelConfig: state.modelConfig
    });
  } catch (error) {
    console.error('[API] Error creating workflow:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to create workflow',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
