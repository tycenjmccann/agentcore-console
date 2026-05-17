import { NextRequest, NextResponse } from "next/server";
import { startWorkflow } from "@/lib/workflow/engine";
import { ensureRehydrated } from "@/lib/workflow/store";
import type { WorkflowInput, ModelConfig, ModelProvider } from "@/lib/workflow/types";
import { DEFAULT_MODEL } from "@/lib/workflow/types";

// ─── Available Models Configuration ──────────────────────────────────────────

/**
 * List of supported model providers.
 */
const SUPPORTED_PROVIDERS: ModelProvider[] = ["bedrock", "openai", "gemini"];

/**
 * List of available model IDs per provider.
 * This must stay in sync with GET /api/models.
 */
const AVAILABLE_MODELS: Record<ModelProvider, string[]> = {
  bedrock: [
    "anthropic.claude-sonnet-4-5-v1",
    "anthropic.claude-opus-4",
  ],
  openai: [
    "gpt-4-turbo",
    "gpt-4",
  ],
  gemini: [
    "gemini-pro",
  ],
};

// ─── Validation Types ────────────────────────────────────────────────────────

interface ValidationError {
  code: "INVALID_PROVIDER" | "UNSUPPORTED_MODEL" | "MISSING_CREDENTIALS";
  message: string;
  details?: Record<string, unknown>;
}

interface ValidationResult {
  valid: boolean;
  modelConfig: ModelConfig;
  error?: ValidationError;
}

// ─── Logging ─────────────────────────────────────────────────────────────────

/**
 * Structured logger for workflow operations.
 */
function logRequest(level: "info" | "warn" | "error", message: string, data?: Record<string, unknown>) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    service: "workflow-start",
    message,
    ...data,
  };
  if (level === "error") {
    console.error(JSON.stringify(entry));
  } else if (level === "warn") {
    console.warn(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

// ─── Model Validation ────────────────────────────────────────────────────────

/**
 * Check if external provider (OpenAI, Gemini) has API key configured.
 */
function hasExternalProviderCredentials(provider: "openai" | "gemini"): boolean {
  if (provider === "openai") {
    return !!process.env.OPENAI_API_KEY;
  }
  if (provider === "gemini") {
    return !!process.env.GEMINI_API_KEY;
  }
  return false;
}

/**
 * Validate the modelConfig against available models and provider credentials.
 * 
 * @param modelConfig - The model configuration to validate (may be undefined)
 * @returns ValidationResult with either the validated config or an error
 */
function validateModelConfig(modelConfig?: ModelConfig): ValidationResult {
  // If no modelConfig provided, use default
  if (!modelConfig) {
    logRequest("info", "No modelConfig provided, using default model", {
      defaultModel: DEFAULT_MODEL,
    });
    return {
      valid: true,
      modelConfig: DEFAULT_MODEL,
    };
  }

  const { provider } = modelConfig;

  // Validate provider is supported
  if (!SUPPORTED_PROVIDERS.includes(provider)) {
    return {
      valid: false,
      modelConfig: DEFAULT_MODEL,
      error: {
        code: "INVALID_PROVIDER",
        message: `Invalid model provider: "${provider}". Supported providers: ${SUPPORTED_PROVIDERS.join(", ")}.`,
        details: { provider, supportedProviders: SUPPORTED_PROVIDERS },
      },
    };
  }

  // Validate modelId is in available models list
  const availableModelsForProvider = AVAILABLE_MODELS[provider];
  if (!availableModelsForProvider.includes(modelConfig.modelId)) {
    return {
      valid: false,
      modelConfig: DEFAULT_MODEL,
      error: {
        code: "UNSUPPORTED_MODEL",
        message: `Unsupported model ID: "${modelConfig.modelId}" for provider "${provider}". Available models: ${availableModelsForProvider.join(", ")}.`,
        details: {
          provider,
          modelId: modelConfig.modelId,
          availableModels: availableModelsForProvider,
        },
      },
    };
  }

  // For external providers (OpenAI, Gemini), check API key configuration
  if ((provider === "openai" || provider === "gemini") && !hasExternalProviderCredentials(provider)) {
    return {
      valid: false,
      modelConfig: DEFAULT_MODEL,
      error: {
        code: "MISSING_CREDENTIALS",
        message: `External provider "${provider}" credentials not configured. Please configure the ${provider.toUpperCase()}_API_KEY environment variable.`,
        details: {
          provider,
          envVar: `${provider.toUpperCase()}_API_KEY`,
        },
      },
    };
  }

  // Validation passed
  logRequest("info", "Model configuration validated successfully", {
    provider: modelConfig.provider,
    modelId: modelConfig.modelId,
  });

  return {
    valid: true,
    modelConfig,
  };
}

// ─── Route Handler ───────────────────────────────────────────────────────────

/**
 * POST /api/workflow/start
 * 
 * Start a new agentic team workflow.
 * 
 * Body: WorkflowInput
 * - title: string (required)
 * - description: string (optional, defaults to "")
 * - repoConfig: RepoConfig (required)
 * - sources: IntakeSource[] (optional, defaults to [])
 * - modelConfig: ModelConfig (optional, defaults to Claude Sonnet 4.5)
 * 
 * @returns { workflowId: string } on success
 * @returns { error: string, code?: string, details?: object } on failure
 */
export async function POST(req: NextRequest) {
  const startTime = performance.now();

  try {
    const body: WorkflowInput = await req.json();

    // Validate required fields
    if (!body.title || !body.repoConfig) {
      logRequest("warn", "Missing required fields", {
        hasTitle: !!body.title,
        hasRepoConfig: !!body.repoConfig,
      });
      return NextResponse.json(
        { error: "title and repoConfig are required" },
        { status: 400 }
      );
    }

    // Set defaults for optional fields
    if (!body.sources) body.sources = [];
    if (!body.description) body.description = "";

    // Validate modelConfig
    const validationResult = validateModelConfig(body.modelConfig);
    if (!validationResult.valid && validationResult.error) {
      const { code, message, details } = validationResult.error;
      logRequest("warn", "Model validation failed", {
        code,
        message,
        inputModelConfig: body.modelConfig,
      });

      // Return appropriate status code based on error type
      const statusCode = code === "MISSING_CREDENTIALS" ? 500 : 400;
      return NextResponse.json(
        { error: message, code, details },
        { status: statusCode }
      );
    }

    // Use the validated model config (either the provided one or the default)
    body.modelConfig = validationResult.modelConfig;

    // Log the selected model
    logRequest("info", "Starting workflow with model selection", {
      title: body.title,
      modelProvider: body.modelConfig.provider,
      modelId: body.modelConfig.modelId,
      isDefaultModel: 
        body.modelConfig.provider === DEFAULT_MODEL.provider &&
        body.modelConfig.modelId === DEFAULT_MODEL.modelId,
    });

    // Ensure rehydration so ticket counter is synced
    await ensureRehydrated();

    // Start the workflow
    const workflowId = await startWorkflow(body);

    const durationMs = Math.round(performance.now() - startTime);
    logRequest("info", "Workflow started successfully", {
      workflowId,
      durationMs,
      modelProvider: body.modelConfig.provider,
      modelId: body.modelConfig.modelId,
    });

    return NextResponse.json({ workflowId });
  } catch (err) {
    const durationMs = Math.round(performance.now() - startTime);
    logRequest("error", "Workflow start failed", {
      error: (err as Error).message,
      stack: (err as Error).stack,
      durationMs,
    });

    return NextResponse.json(
      { error: `Failed to start workflow: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}
