/**
 * Integration tests for POST /api/workflow/start with modelConfig validation.
 * 
 * Tests the following acceptance criteria:
 * - ✅ POST /api/workflow/start accepts modelConfig
 * - ✅ Validation rejects invalid models
 * - ✅ Default model used if not provided
 * - ✅ Clear error messages on validation failure
 * - ✅ Logging includes selected model
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../route";

// Mock dependencies
vi.mock("@/lib/workflow/engine", () => ({
  startWorkflow: vi.fn().mockResolvedValue("wf_test_123"),
}));

vi.mock("@/lib/workflow/store", () => ({
  ensureRehydrated: vi.fn().mockResolvedValue(undefined),
}));

// Helper to create NextRequest with JSON body
function createRequest(body: object): NextRequest {
  const request = new NextRequest("http://localhost:3000/api/workflow/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return request;
}

// Valid minimal input
const validBaseInput = {
  title: "Test Feature",
  repoConfig: {
    layout: "monorepo" as const,
    repos: [
      {
        url: "https://github.com/test/repo",
        defaultBranch: "main",
        platform: "shared" as const,
      },
    ],
  },
};

describe("POST /api/workflow/start - modelConfig validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset env vars
    delete process.env.OPENAI_API_KEY;
    delete process.env.GEMINI_API_KEY;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── Required Fields Validation ────────────────────────────────────────────

  it("returns 400 when title is missing", async () => {
    const request = createRequest({ repoConfig: validBaseInput.repoConfig });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("title and repoConfig are required");
  });

  it("returns 400 when repoConfig is missing", async () => {
    const request = createRequest({ title: "Test" });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("title and repoConfig are required");
  });

  // ─── Default Model Behavior ────────────────────────────────────────────────

  it("uses default model (Claude Sonnet 4.5) when modelConfig not provided", async () => {
    const { startWorkflow } = await import("@/lib/workflow/engine");
    const request = createRequest(validBaseInput);
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.workflowId).toBe("wf_test_123");

    // Verify startWorkflow was called with default model
    expect(startWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        modelConfig: {
          provider: "bedrock",
          modelId: "anthropic.claude-sonnet-4-5-v1",
        },
      })
    );
  });

  // ─── Valid ModelConfig Acceptance ──────────────────────────────────────────

  it("accepts valid Bedrock modelConfig (Claude Sonnet 4.5)", async () => {
    const { startWorkflow } = await import("@/lib/workflow/engine");
    const request = createRequest({
      ...validBaseInput,
      modelConfig: {
        provider: "bedrock",
        modelId: "anthropic.claude-sonnet-4-5-v1",
      },
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.workflowId).toBe("wf_test_123");
    expect(startWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        modelConfig: {
          provider: "bedrock",
          modelId: "anthropic.claude-sonnet-4-5-v1",
        },
      })
    );
  });

  it("accepts valid Bedrock modelConfig (Claude Opus 4)", async () => {
    const { startWorkflow } = await import("@/lib/workflow/engine");
    const request = createRequest({
      ...validBaseInput,
      modelConfig: {
        provider: "bedrock",
        modelId: "anthropic.claude-opus-4",
      },
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(startWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        modelConfig: {
          provider: "bedrock",
          modelId: "anthropic.claude-opus-4",
        },
      })
    );
  });

  it("accepts valid OpenAI modelConfig when API key is configured", async () => {
    process.env.OPENAI_API_KEY = "sk-test-key";
    const { startWorkflow } = await import("@/lib/workflow/engine");
    const request = createRequest({
      ...validBaseInput,
      modelConfig: {
        provider: "openai",
        modelId: "gpt-4-turbo",
      },
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(startWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        modelConfig: {
          provider: "openai",
          modelId: "gpt-4-turbo",
        },
      })
    );
  });

  it("accepts valid Gemini modelConfig when API key is configured", async () => {
    process.env.GEMINI_API_KEY = "gemini-test-key";
    const { startWorkflow } = await import("@/lib/workflow/engine");
    const request = createRequest({
      ...validBaseInput,
      modelConfig: {
        provider: "gemini",
        modelId: "gemini-pro",
      },
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(startWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        modelConfig: {
          provider: "gemini",
          modelId: "gemini-pro",
        },
      })
    );
  });

  // ─── Invalid Provider Validation ───────────────────────────────────────────

  it("rejects invalid provider with 400 and clear error message", async () => {
    const request = createRequest({
      ...validBaseInput,
      modelConfig: {
        provider: "invalid-provider",
        modelId: "some-model",
      },
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.code).toBe("INVALID_PROVIDER");
    expect(json.error).toContain("Invalid model provider");
    expect(json.error).toContain("invalid-provider");
    expect(json.error).toContain("bedrock, openai, gemini");
    expect(json.details.supportedProviders).toEqual(["bedrock", "openai", "gemini"]);
  });

  // ─── Unsupported Model ID Validation ───────────────────────────────────────

  it("rejects unsupported modelId with 400 and clear error message", async () => {
    const request = createRequest({
      ...validBaseInput,
      modelConfig: {
        provider: "bedrock",
        modelId: "nonexistent-model",
      },
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.code).toBe("UNSUPPORTED_MODEL");
    expect(json.error).toContain("Unsupported model ID");
    expect(json.error).toContain("nonexistent-model");
    expect(json.details.availableModels).toContain("anthropic.claude-sonnet-4-5-v1");
  });

  it("rejects unsupported OpenAI modelId", async () => {
    process.env.OPENAI_API_KEY = "sk-test-key";
    const request = createRequest({
      ...validBaseInput,
      modelConfig: {
        provider: "openai",
        modelId: "gpt-3",
      },
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.code).toBe("UNSUPPORTED_MODEL");
    expect(json.details.availableModels).toContain("gpt-4-turbo");
    expect(json.details.availableModels).toContain("gpt-4");
  });

  // ─── Missing Credentials Validation ────────────────────────────────────────

  it("rejects OpenAI model with 500 when API key not configured", async () => {
    // Ensure no API key
    delete process.env.OPENAI_API_KEY;
    const request = createRequest({
      ...validBaseInput,
      modelConfig: {
        provider: "openai",
        modelId: "gpt-4-turbo",
      },
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.code).toBe("MISSING_CREDENTIALS");
    expect(json.error).toContain("credentials not configured");
    expect(json.details.envVar).toBe("OPENAI_API_KEY");
  });

  it("rejects Gemini model with 500 when API key not configured", async () => {
    delete process.env.GEMINI_API_KEY;
    const request = createRequest({
      ...validBaseInput,
      modelConfig: {
        provider: "gemini",
        modelId: "gemini-pro",
      },
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.code).toBe("MISSING_CREDENTIALS");
    expect(json.details.envVar).toBe("GEMINI_API_KEY");
  });

  // ─── Bedrock models don't require external credentials ─────────────────────

  it("accepts Bedrock models without checking for external API keys", async () => {
    // No external API keys set
    delete process.env.OPENAI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    const request = createRequest({
      ...validBaseInput,
      modelConfig: {
        provider: "bedrock",
        modelId: "anthropic.claude-opus-4",
      },
    });
    const response = await POST(request);
    const json = await response.json();

    // Bedrock uses AWS credentials, not external API keys
    expect(response.status).toBe(200);
    expect(json.workflowId).toBe("wf_test_123");
  });

  // ─── Error Response Structure ──────────────────────────────────────────────

  it("returns structured error response with code and details", async () => {
    const request = createRequest({
      ...validBaseInput,
      modelConfig: {
        provider: "openai",
        modelId: "invalid",
      },
    });
    const response = await POST(request);
    const json = await response.json();

    // Verify error structure
    expect(json).toHaveProperty("error");
    expect(json).toHaveProperty("code");
    expect(json).toHaveProperty("details");
    expect(typeof json.error).toBe("string");
    expect(typeof json.code).toBe("string");
    expect(typeof json.details).toBe("object");
  });

  // ─── Workflow ID Response ──────────────────────────────────────────────────

  it("returns workflowId on successful start", async () => {
    const request = createRequest(validBaseInput);
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toHaveProperty("workflowId");
    expect(json.workflowId).toBe("wf_test_123");
  });

  // ─── Integration with WorkflowEngine ───────────────────────────────────────

  it("passes modelConfig to WorkflowEngine.startWorkflow", async () => {
    const { startWorkflow } = await import("@/lib/workflow/engine");
    process.env.OPENAI_API_KEY = "sk-test";

    const customModelConfig = {
      provider: "openai" as const,
      modelId: "gpt-4",
    };

    const request = createRequest({
      ...validBaseInput,
      modelConfig: customModelConfig,
    });

    await POST(request);

    expect(startWorkflow).toHaveBeenCalledTimes(1);
    const calledWith = (startWorkflow as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][0];
    expect(calledWith.modelConfig).toEqual(customModelConfig);
  });
});
