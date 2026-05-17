import { NextRequest, NextResponse } from 'next/server';
import type { ModelConfig } from '@/lib/workflow/types';

/**
 * Model metadata for the available models API
 */
interface ModelMetadata {
  provider: ModelConfig['provider'];
  modelId: string;
  displayName: string;
  description?: string;
  isDefault: boolean;
}

interface ModelsResponse {
  models: ModelMetadata[];
}

/**
 * Registry of available models
 * Can be configured via environment variables in the future
 */
const AVAILABLE_MODELS: ModelMetadata[] = [
  {
    provider: 'bedrock',
    modelId: 'anthropic.claude-sonnet-4-5',
    displayName: 'Claude Sonnet 4.5',
    description: 'Balanced performance and speed — ideal for most development tasks',
    isDefault: true,
  },
  {
    provider: 'bedrock',
    modelId: 'anthropic.claude-opus-4',
    displayName: 'Claude Opus 4',
    description: 'Highest capability model for complex reasoning and code generation',
    isDefault: false,
  },
  {
    provider: 'openai',
    modelId: 'gpt-4-turbo',
    displayName: 'GPT-4 Turbo',
    description: 'OpenAI\'s fastest high-intelligence model',
    isDefault: false,
  },
  {
    provider: 'openai',
    modelId: 'o1-preview',
    displayName: 'OpenAI o1 Preview',
    description: 'Advanced reasoning model for complex problem-solving',
    isDefault: false,
  },
  {
    provider: 'gemini',
    modelId: 'gemini-pro',
    displayName: 'Gemini Pro',
    description: 'Google\'s most capable model for text and code',
    isDefault: false,
  },
  {
    provider: 'gemini',
    modelId: 'gemini-1.5-pro',
    displayName: 'Gemini 1.5 Pro',
    description: 'Enhanced version with improved performance',
    isDefault: false,
  },
];

/**
 * GET /api/models
 * 
 * Returns the list of available AI models with metadata.
 * Used by the UI to populate the model selector dropdown.
 * 
 * @returns {ModelsResponse} List of available models
 */
export async function GET(request: NextRequest): Promise<NextResponse<ModelsResponse>> {
  try {
    // Future: Filter models based on environment config
    // For now, return all models
    const response: ModelsResponse = {
      models: AVAILABLE_MODELS,
    };

    return NextResponse.json(response, {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
      },
    });
  } catch (error) {
    console.error('[API /api/models] Error fetching models:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to fetch available models',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
