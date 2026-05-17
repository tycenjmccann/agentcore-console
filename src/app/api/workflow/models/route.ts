import { NextRequest, NextResponse } from 'next/server';

/**
 * Model Selection API Route
 * 
 * GET /api/workflow/models
 * Returns available AI models for workflow development agents.
 * 
 * Implements TEAM-64:
 * - Hardcoded list of Bedrock models (no dynamic AWS discovery)
 * - Claude Sonnet 4.5 marked as default
 * - Response time < 200ms
 * - Graceful error handling (always returns at least default model)
 */

export interface ModelInfo {
  id: string;
  displayName: string;
  provider: 'bedrock' | 'openai' | 'gemini';
  isDefault: boolean;
}

export interface ModelsResponse {
  models: ModelInfo[];
}

/**
 * Hardcoded list of available models.
 * This list is static to ensure fast response times and avoid AWS API calls.
 * Can be expanded to include OpenAI/Gemini models when credentials are configured.
 */
const AVAILABLE_MODELS: ModelInfo[] = [
  {
    id: 'global.anthropic.claude-sonnet-4-5-20250929-v1:0',
    displayName: 'Claude Sonnet 4.5 (Default)',
    provider: 'bedrock',
    isDefault: true,
  },
  {
    id: 'global.anthropic.claude-opus-4-20250514-v1:0',
    displayName: 'Claude Opus 4',
    provider: 'bedrock',
    isDefault: false,
  },
];

/**
 * Fallback model to return if anything goes wrong.
 * Ensures the API never fails completely.
 */
const DEFAULT_MODEL: ModelInfo = {
  id: 'global.anthropic.claude-sonnet-4-5-20250929-v1:0',
  displayName: 'Claude Sonnet 4.5 (Default)',
  provider: 'bedrock',
  isDefault: true,
};

/**
 * GET handler for model selection endpoint.
 * 
 * @returns JSON response with available models
 */
export async function GET(request: NextRequest): Promise<NextResponse<ModelsResponse>> {
  try {
    // Simple synchronous response - no AWS calls needed
    const response: ModelsResponse = {
      models: AVAILABLE_MODELS,
    };

    return NextResponse.json(response, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    // Graceful fallback: return at least the default model
    console.error('[GET /api/workflow/models] Error:', error);
    
    const fallbackResponse: ModelsResponse = {
      models: [DEFAULT_MODEL],
    };

    return NextResponse.json(fallbackResponse, {
      status: 200, // Still return 200 to avoid breaking the UI
      headers: {
        'Cache-Control': 'no-cache',
      },
    });
  }
}
