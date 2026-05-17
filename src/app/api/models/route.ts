import { NextRequest, NextResponse } from "next/server";
import type { ModelProvider } from "@/lib/workflow/types";

/**
 * Available Model Response Type
 * Represents a model that can be selected for workflow invocations
 */
export interface AvailableModel {
  provider: ModelProvider;
  modelId: string;
  displayName: string;
  isDefault: boolean;
  description?: string;
}

/**
 * GET /api/models
 * 
 * Returns list of available AI models based on environment configuration.
 * Checks for presence of API keys and credentials to determine availability.
 * 
 * Response: 200 with AvailableModel[] (may be empty if no providers configured)
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const models: AvailableModel[] = [];

    // Check Bedrock availability (AWS credentials)
    const awsRegion = process.env.AWS_REGION;
    if (awsRegion) {
      // Default model: Claude Sonnet 4.5
      models.push({
        provider: "bedrock",
        modelId: "anthropic.claude-sonnet-4-5-v1:0",
        displayName: "Claude Sonnet 4.5 (Default)",
        isDefault: true,
        description: "Balanced performance and cost, optimal for most development tasks"
      });

      // Claude Opus (premium option)
      models.push({
        provider: "bedrock",
        modelId: "anthropic.claude-opus-4-0-v1:0",
        displayName: "Claude Opus 4.0",
        isDefault: false,
        description: "Highest capability model, best for complex reasoning and architecture"
      });

      // Claude Sonnet 3.5 (legacy/fallback)
      models.push({
        provider: "bedrock",
        modelId: "anthropic.claude-sonnet-3-5-v2:0",
        displayName: "Claude Sonnet 3.5",
        isDefault: false,
        description: "Previous generation, faster and lower cost"
      });
    }

    // Check OpenAI availability
    const openaiKey = process.env.OPENAI_API_KEY;
    if (openaiKey) {
      models.push({
        provider: "openai",
        modelId: "gpt-4-turbo",
        displayName: "GPT-4 Turbo",
        isDefault: false,
        description: "OpenAI's most capable model with 128k context"
      });

      models.push({
        provider: "openai",
        modelId: "gpt-4o",
        displayName: "GPT-4o",
        isDefault: false,
        description: "Optimized for speed and multimodal capabilities"
      });
    }

    // Check Gemini availability
    const geminiKey = process.env.GOOGLE_API_KEY;
    if (geminiKey) {
      models.push({
        provider: "gemini",
        modelId: "gemini-2.0-flash-exp",
        displayName: "Gemini 2.0 Flash",
        isDefault: false,
        description: "Google's latest model with experimental features"
      });

      models.push({
        provider: "gemini",
        modelId: "gemini-1.5-pro",
        displayName: "Gemini 1.5 Pro",
        isDefault: false,
        description: "Large context window, excellent for code analysis"
      });
    }

    const duration = Date.now() - startTime;
    
    // Log response time for monitoring
    console.log(`[API /models] Returned ${models.length} models in ${duration}ms`);

    return NextResponse.json(models, {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=300", // Cache for 5 minutes
      },
    });
  } catch (error) {
    console.error("[API /models] Error:", error);
    
    return NextResponse.json(
      { 
        error: "Failed to fetch available models",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
