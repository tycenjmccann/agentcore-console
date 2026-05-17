/**
 * GET /api/models
 * 
 * Returns the list of available AI models that users can select
 * for workflow execution.
 */

import { NextResponse } from 'next/server';
import type { ModelsResponse } from '@/lib/workflow/model-config';

export async function GET() {
  try {
    const response: ModelsResponse = {
      models: [
        // Bedrock models
        {
          provider: 'bedrock',
          modelId: 'global.anthropic.claude-sonnet-4-5-20250929-v1:0',
          displayName: 'Claude Sonnet 4.5',
          description: 'Balanced performance and speed - recommended for most tasks',
          isDefault: true,
        },
        {
          provider: 'bedrock',
          modelId: 'anthropic.claude-opus-4',
          displayName: 'Claude Opus 4',
          description: 'Highest capability model for complex reasoning tasks',
          isDefault: false,
        },
        {
          provider: 'bedrock',
          modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
          displayName: 'Claude 3.5 Sonnet',
          description: 'Previous generation with excellent code capabilities',
          isDefault: false,
        },
        
        // OpenAI models
        {
          provider: 'openai',
          modelId: 'gpt-4-turbo',
          displayName: 'GPT-4 Turbo',
          description: 'Fast and capable model with large context window',
          isDefault: false,
        },
        {
          provider: 'openai',
          modelId: 'gpt-4',
          displayName: 'GPT-4',
          description: 'Standard GPT-4 model with strong reasoning',
          isDefault: false,
        },
        {
          provider: 'openai',
          modelId: 'gpt-4o',
          displayName: 'GPT-4o',
          description: 'Multimodal GPT-4 optimized for efficiency',
          isDefault: false,
        },
        
        // Gemini models
        {
          provider: 'gemini',
          modelId: 'gemini-pro',
          displayName: 'Gemini Pro',
          description: 'Google\'s most capable AI model',
          isDefault: false,
        },
        {
          provider: 'gemini',
          modelId: 'gemini-1.5-pro',
          displayName: 'Gemini 1.5 Pro',
          description: 'Enhanced Gemini with longer context support',
          isDefault: false,
        },
      ],
    };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error('[API /models] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch available models' },
      { status: 500 }
    );
  }
}
