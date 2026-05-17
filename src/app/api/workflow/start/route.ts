import { NextRequest, NextResponse } from "next/server";
import { startWorkflow } from "@/lib/workflow/engine";
import { ensureRehydrated } from "@/lib/workflow/store";
import type { WorkflowInput, ModelConfig } from "@/lib/workflow/types";

/**
 * Hardcoded list of valid model IDs for server-side validation.
 * Must match the MODEL_REGISTRY in /api/models/route.ts.
 */
const VALID_MODEL_IDS: ReadonlySet<string> = new Set([
  // Bedrock models
  "anthropic.claude-sonnet-4-5-v1:0",
  "anthropic.claude-opus-4-v1:0",
  // OpenAI models
  "gpt-4-turbo",
  // Gemini models
  "gemini-pro",
]);

/**
 * Validate that the modelOverride references a known model.
 * 
 * @param config - The model configuration to validate
 * @returns true if valid, false otherwise
 */
function isValidModelConfig(config: ModelConfig): boolean {
  return VALID_MODEL_IDS.has(config.modelId);
}

/**
 * POST /api/workflow/start
 * Start a new agentic team workflow.
 * 
 * Body: WorkflowInput
 * - title: string (required)
 * - description: string
 * - repoConfig: RepoConfig (required)
 * - sources: IntakeSource[]
 * - modelOverride?: ModelConfig (optional - for dev agent model selection)
 * 
 * @example
 * // Start workflow with default model
 * POST /api/workflow/start
 * { "title": "Feature", "repoConfig": { ... } }
 * 
 * // Start workflow with model override
 * POST /api/workflow/start
 * {
 *   "title": "Feature",
 *   "repoConfig": { ... },
 *   "modelOverride": {
 *     "provider": "bedrock",
 *     "modelId": "anthropic.claude-opus-4-v1:0"
 *   }
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body: WorkflowInput = await req.json();

    if (!body.title || !body.repoConfig) {
      return NextResponse.json(
        { error: "title and repoConfig are required" },
        { status: 400 }
      );
    }

    // Validate modelOverride if provided
    if (body.modelOverride) {
      // Validate provider is a valid type
      const validProviders = ["bedrock", "openai", "gemini"];
      if (!validProviders.includes(body.modelOverride.provider)) {
        console.warn(
          `[POST /api/workflow/start] Invalid model provider: ${body.modelOverride.provider}`
        );
        return NextResponse.json(
          {
            error: "Invalid model provider",
            details: `Provider must be one of: ${validProviders.join(", ")}`,
          },
          { status: 400 }
        );
      }

      // Validate modelId is a known model
      if (!isValidModelConfig(body.modelOverride)) {
        console.warn(
          `[POST /api/workflow/start] Invalid model selected: ${body.modelOverride.provider}:${body.modelOverride.modelId}`
        );
        return NextResponse.json(
          {
            error: "Invalid model selected",
            details: `Model "${body.modelOverride.modelId}" is not available. Use GET /api/models to see available models.`,
          },
          { status: 400 }
        );
      }

      // Log model override selection
      console.log(
        `[POST /api/workflow/start] Model override selected: ${body.modelOverride.provider}:${body.modelOverride.modelId}`
      );
    }

    // Defaults
    if (!body.sources) body.sources = [];
    if (!body.description) body.description = "";

    // Ensure rehydration so ticket counter is synced
    await ensureRehydrated();

    // Log workflow creation with model info
    const modelInfo = body.modelOverride
      ? `${body.modelOverride.provider}:${body.modelOverride.modelId}`
      : "default (Claude Sonnet 4.5)";
    console.log(
      `[POST /api/workflow/start] Starting workflow: "${body.title}" with model: ${modelInfo}`
    );

    const workflowId = await startWorkflow(body);

    return NextResponse.json({ workflowId });
  } catch (err) {
    console.error("[POST /api/workflow/start] Workflow start error:", err);
    return NextResponse.json(
      { error: `Failed to start workflow: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}
