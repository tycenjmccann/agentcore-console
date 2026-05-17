// app/api/workflows/[id]/execute/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { executeWorkflow } from '@/lib/engine';

/**
 * POST /api/workflows/[id]/execute
 * Start workflow execution with configured model
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const workflowId = params.id;
  
  try {
    console.log(`[API] Starting workflow execution: ${workflowId}`);
    
    // Execute workflow in background
    // The engine will read modelConfig from WorkflowState
    executeWorkflow(workflowId).catch(error => {
      console.error(`[API] Workflow execution failed: ${workflowId}`, error);
    });
    
    return NextResponse.json({
      success: true,
      workflowId,
      message: 'Workflow execution started'
    });
  } catch (error) {
    console.error(`[API] Error starting workflow: ${workflowId}`, error);
    
    return NextResponse.json(
      {
        error: 'Failed to start workflow execution',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
