import { NextRequest, NextResponse } from "next/server";
import type { AvailableModel, ModelProvider } from "@/lib/workflow/types";

/**
 * Hardcoded model registry for v1.
 * 
 * Contains all supported AI models organized by provider.
 * In future versions, this could be fetched from a database or external service.
 */
const MODEL_REGISTRY: AvailableModel[] = [
  // AWS Bedrock - Claude models
  {
    provider: "bedrock",
    modelId: "anthropic.claude-sonnet-4-5-v1:0",
    displayName: "Claude Sonnet 4.5",
    description: "Balanced performance and cost, optimized for development tasks",
    isDefault: true,
  },
  {
    provider: "bedrock",
    modelId: "anthropic.claude-opus-4-v1:0",
    displayName: "Claude Opus 4",
    description: "Highest capability model for complex reasoning and code generation",
    isDefault: false,
  },
  // OpenAI models
  {
    provider: "openai",
    modelId: "gpt-4-turbo",
    displayName: "GPT-4 Turbo",
    description: "OpenAI's flagship model with 128k context window",
    isDefault: false,
  },
  // Google Gemini models
  {
    provider: "gemini",
    modelId: "gemini-pro",
    displayName: "Gemini Pro",
    description: "Google's multimodal model optimized for text tasks",
    isDefault: false,
  },
];

/**
 * Valid provider values for filtering.
 */
const VALID_PROVIDERS: ReadonlySet<ModelProvider> = new Set([
  "bedrock",
  "openai",
  "gemini",
]);

/**
 * Type guard to validate provider string.
 */
function isValidProvider(provider: string): provider is ModelProvider {
  return VALID_PROVIDERS.has(provider as ModelProvider);
}

/**
 * Response type for the models endpoint.
 */
interface ModelsResponse {
  models: AvailableModel[];
}

/**
 * Error response type.
 */
interface ErrorResponse {
  error: string;
  details?: string;
}

/**
 * GET /api/models
 * 
 * Returns a list of available AI models for workflow agent invocation.
 * 
 * @param request - Next.js request object
 * @returns JSON response with models array
 * 
 * @example
 * // Get all models
 * GET /api/models
 * 
 * // Filter by provider
 * GET /api/models?provider=bedrock
 * 
 * @response 200 - Success
 * ```json
 * {
 *   "models": [
 *     {
 *       "provider": "bedrock",
 *       "modelId": "anthropic.claude-sonnet-4-5-v1:0",
 *       "displayName": "Claude Sonnet 4.5",
 *       "description": "Balanced performance and cost",
 *       "isDefault": true
 *     }
 *   ]
 * }
 * ```
 * 
 * @response 500 - Internal Server Error
 * ```json
 * {
 *   "error": "Internal server error",
 *   "details": "Error message"
 * }
 * ```
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<ModelsResponse | ErrorResponse>> {
  try {
    // Extract provider filter from query params
    const providerParam = request.nextUrl.searchParams.get("provider");

    // Start with all models
    let models = [...MODEL_REGISTRY];

    // Apply provider filter if specified
    if (providerParam !== null) {
      const normalizedProvider = providerParam.toLowerCase().trim();
      
      // Validate provider value
      if (!isValidProvider(normalizedProvider)) {
        // Return empty array for invalid provider (not an error, just no matches)
        // This follows RESTful convention of filtering returning empty results
        models = [];
      } else {
        models = models.filter(
          (model) => model.provider === normalizedProvider
        );
      }
    }

    // Create response with caching headers
    const response = NextResponse.json<ModelsResponse>(
      { models },
      { status: 200 }
    );

    // Set caching headers - cache for 1 hour (3600 seconds)
    // Models list changes infrequently, so caching is safe
    response.headers.set(
      "Cache-Control",
      "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400"
    );

    return response;
  } catch (error) {
    // Log error for debugging (server-side only)
    console.error("[GET /api/models] Error:", error);

    // Return generic error response - don't expose internal details
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";

    return NextResponse.json<ErrorResponse>(
      {
        error: "Internal server error",
        details: process.env.NODE_ENV === "development" ? errorMessage : undefined,
      },
      { status: 500 }
    );
  }
}
