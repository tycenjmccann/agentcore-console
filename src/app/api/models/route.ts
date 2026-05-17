import { NextResponse } from "next/server";
import type { ModelProvider } from "@/lib/workflow/types";

/**
 * Available Model Response Type
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
 * Returns a list of available AI models based on environment configuration.
 * Models are only included if their required credentials are present.
 *
 * Environment Variables:
 * - AWS_REGION: Required for Bedrock models
 * - OPENAI_API_KEY: Required for OpenAI models
 * - GOOGLE_API_KEY: Required for Gemini models
 *
 * Default Model: Claude Sonnet 4.5 on Bedrock
 */
export async function GET() {
  const startTime = Date.now();

  try {
    const models: AvailableModel[] = [];

    // Bedrock models - Check for AWS_REGION
    const hasBedrockAccess = Boolean(process.env.AWS_REGION);
    if (hasBedrockAccess) {
      models.push({
        provider: "bedrock",
        modelId: "anthropic.claude-sonnet-4-5-v1:0",
        displayName: "Claude Sonnet 4.5 (Default)",
        isDefault: true,
        description: "Fast, intelligent responses with excellent context understanding",
      });

      models.push({
        provider: "bedrock",
        modelId: "anthropic.claude-opus-4-0-v1:0",
        displayName: "Claude Opus 4.0",
        isDefault: false,
        description: "Most capable model for complex reasoning tasks",
      });

      models.push({
        provider: "bedrock",
        modelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
        displayName: "Claude 3.5 Sonnet",
        isDefault: false,
        description: "Previous generation Sonnet model",
      });
    }

    // OpenAI models - Check for OPENAI_API_KEY
    const hasOpenAIAccess = Boolean(process.env.OPENAI_API_KEY);
    if (hasOpenAIAccess) {
      models.push({
        provider: "openai",
        modelId: "gpt-4-turbo",
        displayName: "GPT-4 Turbo",
        isDefault: false,
        description: "OpenAI's most capable model with enhanced performance",
      });

      models.push({
        provider: "openai",
        modelId: "gpt-4",
        displayName: "GPT-4",
        isDefault: false,
        description: "Reliable and capable general-purpose model",
      });

      models.push({
        provider: "openai",
        modelId: "gpt-3.5-turbo",
        displayName: "GPT-3.5 Turbo",
        isDefault: false,
        description: "Fast and cost-effective option",
      });
    }

    // Gemini models - Check for GOOGLE_API_KEY
    const hasGeminiAccess = Boolean(process.env.GOOGLE_API_KEY);
    if (hasGeminiAccess) {
      models.push({
        provider: "gemini",
        modelId: "gemini-pro",
        displayName: "Gemini Pro",
        isDefault: false,
        description: "Google's advanced multimodal model",
      });

      models.push({
        provider: "gemini",
        modelId: "gemini-pro-vision",
        displayName: "Gemini Pro Vision",
        isDefault: false,
        description: "Enhanced with vision capabilities",
      });
    }

    const duration = Date.now() - startTime;

    // Log performance
    console.log(`[GET /api/models] Returned ${models.length} models in ${duration}ms`);

    return NextResponse.json(models, {
      headers: {
        "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[GET /api/models] Error after ${duration}ms:`, error);

    return NextResponse.json(
      {
        error: "Failed to fetch available models",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
