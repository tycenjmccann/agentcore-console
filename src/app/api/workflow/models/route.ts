import { NextRequest, NextResponse } from "next/server";

/**
 * Model option for AI model selection.
 * Used by the IntakeForm to display available models.
 */
export interface ModelOption {
  /** Unique identifier for the model option */
  id: string;
  /** Provider type: bedrock (AWS), openai, or gemini (Google) */
  provider: "bedrock" | "openai" | "gemini";
  /** Provider-specific model identifier */
  modelId: string;
  /** Human-readable display name */
  displayName: string;
  /** Whether this is the default model selection */
  isDefault: boolean;
  /** Whether an API key is required (non-Bedrock models) */
  requiresApiKey: boolean;
  /** Optional description of the model's capabilities */
  description?: string;
}

/**
 * Response shape for GET /api/workflow/models
 */
export interface ModelsResponse {
  models: ModelOption[];
}

/**
 * Available models for workflow agent invocation.
 * 
 * Models are categorized by provider:
 * - bedrock: AWS Bedrock models (Anthropic Claude) - no API key required
 * - openai: OpenAI models (GPT-4) - requires API key
 * - gemini: Google Gemini models - requires API key
 */
const AVAILABLE_MODELS: ModelOption[] = [
  {
    id: "claude-sonnet-4-5",
    provider: "bedrock",
    modelId: "global.anthropic.claude-sonnet-4-5-20250929-v1:0",
    displayName: "Claude Sonnet 4.5 (default)",
    isDefault: true,
    requiresApiKey: false,
    description: "Balanced performance and cost. Recommended for most use cases.",
  },
  {
    id: "claude-opus-4",
    provider: "bedrock",
    modelId: "global.anthropic.claude-opus-4-20250514-v1:0",
    displayName: "Claude Opus 4",
    isDefault: false,
    requiresApiKey: false,
    description: "Highest capability model. Best for complex reasoning tasks.",
  },
  {
    id: "gpt-4o",
    provider: "openai",
    modelId: "gpt-4o",
    displayName: "GPT-4o",
    isDefault: false,
    requiresApiKey: true,
    description: "OpenAI's optimized GPT-4 model. Requires OpenAI API key.",
  },
  {
    id: "gemini-2-flash",
    provider: "gemini",
    modelId: "gemini-2.0-flash-exp",
    displayName: "Gemini 2.0 Flash",
    isDefault: false,
    requiresApiKey: true,
    description: "Google's fast and efficient model. Requires Google AI API key.",
  },
];

/**
 * GET /api/workflow/models
 * 
 * Returns available AI models for workflow agent invocation.
 * Response is cacheable for 5 minutes to reduce unnecessary requests.
 * 
 * @returns {ModelsResponse} List of available model options
 */
export async function GET(_req: NextRequest): Promise<NextResponse> {
  try {
    const response: ModelsResponse = {
      models: AVAILABLE_MODELS,
    };

    return NextResponse.json(response, {
      status: 200,
      headers: {
        // Cache for 5 minutes, allow stale-while-revalidate for 1 hour
        "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
      },
    });
  } catch (error) {
    console.error("[GET /api/workflow/models] Error:", error);

    const message = error instanceof Error ? error.message : "Unknown error occurred";

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
