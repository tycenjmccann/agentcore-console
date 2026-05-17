/**
 * GET /api/models
 * 
 * Returns the list of available AI models with metadata.
 * This endpoint is used by the frontend to populate the model selector dropdown.
 * 
 * @returns {ModelsResponse} List of available models and the default model configuration
 */

import { NextResponse } from "next/server";
import type { ModelConfig, ModelProvider } from "@/lib/workflow/types";
import { DEFAULT_MODEL } from "@/lib/workflow/types";

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Represents an available AI model that can be selected by users.
 */
export interface AvailableModel {
  /** The provider of the model (bedrock, openai, gemini) */
  provider: ModelProvider;
  /** The unique identifier for the model */
  modelId: string;
  /** Human-readable display name */
  displayName: string;
  /** Description of the model's characteristics */
  description: string;
  /** Whether this is the default model selection */
  isDefault: boolean;
}

/**
 * Response structure for GET /api/models
 */
export interface ModelsResponse {
  /** List of all available models */
  models: AvailableModel[];
  /** The default model configuration */
  defaultModel: ModelConfig;
}

// ─── Available Models Configuration ──────────────────────────────────────────

/**
 * Static list of available AI models.
 * In production, this could be fetched from a configuration service or database.
 */
const AVAILABLE_MODELS: AvailableModel[] = [
  // Bedrock Models
  {
    provider: "bedrock",
    modelId: "anthropic.claude-sonnet-4-5-v1",
    displayName: "Claude Sonnet 4.5",
    description: "Balanced performance and cost (default)",
    isDefault: true,
  },
  {
    provider: "bedrock",
    modelId: "anthropic.claude-opus-4",
    displayName: "Claude Opus 4",
    description: "Highest capability, slower, more expensive",
    isDefault: false,
  },
  // OpenAI Models
  {
    provider: "openai",
    modelId: "gpt-4-turbo",
    displayName: "GPT-4 Turbo",
    description: "OpenAI's fastest GPT-4 model",
    isDefault: false,
  },
  {
    provider: "openai",
    modelId: "gpt-4",
    displayName: "GPT-4",
    description: "OpenAI's most capable model",
    isDefault: false,
  },
  // Gemini Models
  {
    provider: "gemini",
    modelId: "gemini-pro",
    displayName: "Gemini Pro",
    description: "Google's advanced AI model",
    isDefault: false,
  },
];

// ─── Logging ─────────────────────────────────────────────────────────────────

/**
 * Simple structured logger for API debugging.
 * In production, consider using a proper logging library like pino or winston.
 */
function logRequest(method: string, path: string, status: number, durationMs: number) {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "info",
      method,
      path,
      status,
      durationMs,
    })
  );
}

function logError(method: string, path: string, error: unknown) {
  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "error",
      method,
      path,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
  );
}

// ─── Route Handler ───────────────────────────────────────────────────────────

/**
 * GET /api/models
 * 
 * Returns all available AI models with their metadata.
 * The response includes a list of models and the default model configuration.
 */
export async function GET(): Promise<NextResponse<ModelsResponse | { error: string }>> {
  const startTime = performance.now();
  const path = "/api/models";

  try {
    const response: ModelsResponse = {
      models: AVAILABLE_MODELS,
      defaultModel: DEFAULT_MODEL,
    };

    const durationMs = Math.round(performance.now() - startTime);
    logRequest("GET", path, 200, durationMs);

    return NextResponse.json(response, {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=300", // Cache for 5 minutes
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    logError("GET", path, error);

    return NextResponse.json(
      {
        error: "Internal server error while fetching available models",
      },
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
}

// ─── CORS Preflight Handler ──────────────────────────────────────────────────

/**
 * OPTIONS /api/models
 * 
 * Handles CORS preflight requests for local development.
 */
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400", // 24 hours
    },
  });
}
