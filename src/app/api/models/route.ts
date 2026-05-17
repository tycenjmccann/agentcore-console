import { NextResponse } from "next/server";
import type { AvailableModel } from "@/lib/workflow/types";

/**
 * GET /api/models
 * Returns available AI models based on environment configuration
 * 
 * Response includes models from providers with configured credentials:
 * - Bedrock (if AWS_REGION is set)
 * - OpenAI (if OPENAI_API_KEY is set)
 * - Gemini (if GOOGLE_API_KEY is set)
 * 
 * @returns Array of AvailableModel objects
 */
export async function GET() {
  try {
    const models: AvailableModel[] = [];

    // Bedrock models (default provider)
    if (process.env.AWS_REGION) {
      models.push(
        {
          provider: "bedrock",
          modelId: "anthropic.claude-sonnet-4-5-v1:0",
          displayName: "Claude Sonnet 4.5 (Default)",
          isDefault: true,
          description: "Fast, intelligent, and cost-effective",
        },
        {
          provider: "bedrock",
          modelId: "anthropic.claude-opus-4-0-v1:0",
          displayName: "Claude Opus 4.0",
          isDefault: false,
          description: "Most powerful model for complex tasks",
        },
        {
          provider: "bedrock",
          modelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
          displayName: "Claude Sonnet 3.5",
          isDefault: false,
          description: "Previous generation Sonnet",
        }
      );
    }

    // OpenAI models
    if (process.env.OPENAI_API_KEY) {
      models.push(
        {
          provider: "openai",
          modelId: "gpt-4-turbo",
          displayName: "GPT-4 Turbo",
          isDefault: false,
          description: "Optimized for speed and cost",
        },
        {
          provider: "openai",
          modelId: "gpt-4o",
          displayName: "GPT-4o",
          isDefault: false,
          description: "Latest OpenAI model",
        }
      );
    }

    // Gemini models
    if (process.env.GOOGLE_API_KEY) {
      models.push(
        {
          provider: "gemini",
          modelId: "gemini-2.0-flash-exp",
          displayName: "Gemini 2.0 Flash",
          isDefault: false,
          description: "Fast experimental model",
        },
        {
          provider: "gemini",
          modelId: "gemini-1.5-pro-latest",
          displayName: "Gemini 1.5 Pro",
          isDefault: false,
          description: "Production-ready model",
        }
      );
    }

    // Always return at least the default Bedrock model
    if (models.length === 0) {
      models.push({
        provider: "bedrock",
        modelId: "anthropic.claude-sonnet-4-5-v1:0",
        displayName: "Claude Sonnet 4.5 (Default)",
        isDefault: true,
        description: "Fast, intelligent, and cost-effective",
      });
    }

    return NextResponse.json(models, {
      headers: {
        "Cache-Control": "public, max-age=300", // 5 minutes
      },
    });
  } catch (error) {
    console.error("Error fetching models:", error);
    return NextResponse.json(
      { error: "Failed to fetch available models" },
      { status: 500 }
    );
  }
}
