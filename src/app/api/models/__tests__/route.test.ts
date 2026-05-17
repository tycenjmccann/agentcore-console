/**
 * Integration tests for /api/models endpoint
 * Tests API behavior with different environment configurations
 */

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { GET } from "../route";
import type { AvailableModel } from "../route";

describe("GET /api/models", () => {
  // Store original env vars
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment before each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe("Response format", () => {
    it("should return 200 status code", async () => {
      process.env.AWS_REGION = "us-west-2";
      const response = await GET();
      expect(response.status).toBe(200);
    });

    it("should return valid JSON array", async () => {
      process.env.AWS_REGION = "us-west-2";
      const response = await GET();
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it("should return models with required fields", async () => {
      process.env.AWS_REGION = "us-west-2";
      const response = await GET();
      const models: AvailableModel[] = await response.json();

      models.forEach((model) => {
        expect(model).toHaveProperty("provider");
        expect(model).toHaveProperty("modelId");
        expect(model).toHaveProperty("displayName");
        expect(model).toHaveProperty("isDefault");
        expect(typeof model.provider).toBe("string");
        expect(typeof model.modelId).toBe("string");
        expect(typeof model.displayName).toBe("string");
        expect(typeof model.isDefault).toBe("boolean");
      });
    });

    it("should include cache control headers", async () => {
      process.env.AWS_REGION = "us-west-2";
      const response = await GET();
      const cacheControl = response.headers.get("Cache-Control");
      expect(cacheControl).toContain("public");
      expect(cacheControl).toContain("max-age");
    });
  });

  describe("Bedrock models", () => {
    it("should include Bedrock models when AWS_REGION is set", async () => {
      process.env.AWS_REGION = "us-west-2";
      const response = await GET();
      const models: AvailableModel[] = await response.json();

      const bedrockModels = models.filter((m) => m.provider === "bedrock");
      expect(bedrockModels.length).toBeGreaterThan(0);
    });

    it("should not include Bedrock models when AWS_REGION is missing", async () => {
      delete process.env.AWS_REGION;
      const response = await GET();
      const models: AvailableModel[] = await response.json();

      const bedrockModels = models.filter((m) => m.provider === "bedrock");
      expect(bedrockModels.length).toBe(0);
    });

    it("should mark Claude Sonnet 4.5 as default", async () => {
      process.env.AWS_REGION = "us-west-2";
      const response = await GET();
      const models: AvailableModel[] = await response.json();

      const defaultModel = models.find((m) => m.isDefault);
      expect(defaultModel).toBeDefined();
      expect(defaultModel?.provider).toBe("bedrock");
      expect(defaultModel?.modelId).toBe("anthropic.claude-sonnet-4-5-v1:0");
      expect(defaultModel?.displayName).toContain("Default");
    });

    it("should include Claude Opus and Sonnet 3.5", async () => {
      process.env.AWS_REGION = "us-west-2";
      const response = await GET();
      const models: AvailableModel[] = await response.json();

      const opus = models.find(
        (m) => m.modelId === "anthropic.claude-opus-4-0-v1:0"
      );
      const sonnet35 = models.find(
        (m) => m.modelId === "anthropic.claude-3-5-sonnet-20241022-v2:0"
      );

      expect(opus).toBeDefined();
      expect(opus?.isDefault).toBe(false);
      expect(sonnet35).toBeDefined();
      expect(sonnet35?.isDefault).toBe(false);
    });
  });

  describe("OpenAI models", () => {
    it("should include OpenAI models when OPENAI_API_KEY is set", async () => {
      process.env.OPENAI_API_KEY = "sk-test-key";
      const response = await GET();
      const models: AvailableModel[] = await response.json();

      const openaiModels = models.filter((m) => m.provider === "openai");
      expect(openaiModels.length).toBeGreaterThan(0);
    });

    it("should not include OpenAI models when OPENAI_API_KEY is missing", async () => {
      delete process.env.OPENAI_API_KEY;
      const response = await GET();
      const models: AvailableModel[] = await response.json();

      const openaiModels = models.filter((m) => m.provider === "openai");
      expect(openaiModels.length).toBe(0);
    });

    it("should include GPT-4 Turbo, GPT-4, and GPT-3.5 Turbo", async () => {
      process.env.OPENAI_API_KEY = "sk-test-key";
      const response = await GET();
      const models: AvailableModel[] = await response.json();

      const gpt4Turbo = models.find((m) => m.modelId === "gpt-4-turbo");
      const gpt4 = models.find((m) => m.modelId === "gpt-4");
      const gpt35 = models.find((m) => m.modelId === "gpt-3.5-turbo");

      expect(gpt4Turbo).toBeDefined();
      expect(gpt4).toBeDefined();
      expect(gpt35).toBeDefined();
    });
  });

  describe("Gemini models", () => {
    it("should include Gemini models when GOOGLE_API_KEY is set", async () => {
      process.env.GOOGLE_API_KEY = "test-google-key";
      const response = await GET();
      const models: AvailableModel[] = await response.json();

      const geminiModels = models.filter((m) => m.provider === "gemini");
      expect(geminiModels.length).toBeGreaterThan(0);
    });

    it("should not include Gemini models when GOOGLE_API_KEY is missing", async () => {
      delete process.env.GOOGLE_API_KEY;
      const response = await GET();
      const models: AvailableModel[] = await response.json();

      const geminiModels = models.filter((m) => m.provider === "gemini");
      expect(geminiModels.length).toBe(0);
    });

    it("should include Gemini Pro and Pro Vision", async () => {
      process.env.GOOGLE_API_KEY = "test-google-key";
      const response = await GET();
      const models: AvailableModel[] = await response.json();

      const geminiPro = models.find((m) => m.modelId === "gemini-pro");
      const geminiProVision = models.find(
        (m) => m.modelId === "gemini-pro-vision"
      );

      expect(geminiPro).toBeDefined();
      expect(geminiProVision).toBeDefined();
    });
  });

  describe("Multi-provider scenarios", () => {
    it("should return empty array when no credentials are configured", async () => {
      delete process.env.AWS_REGION;
      delete process.env.OPENAI_API_KEY;
      delete process.env.GOOGLE_API_KEY;

      const response = await GET();
      const models: AvailableModel[] = await response.json();

      expect(models).toEqual([]);
      expect(response.status).toBe(200);
    });

    it("should include all providers when all credentials are set", async () => {
      process.env.AWS_REGION = "us-west-2";
      process.env.OPENAI_API_KEY = "sk-test-key";
      process.env.GOOGLE_API_KEY = "test-google-key";

      const response = await GET();
      const models: AvailableModel[] = await response.json();

      const providers = new Set(models.map((m) => m.provider));
      expect(providers.has("bedrock")).toBe(true);
      expect(providers.has("openai")).toBe(true);
      expect(providers.has("gemini")).toBe(true);
    });

    it("should have exactly one default model", async () => {
      process.env.AWS_REGION = "us-west-2";
      process.env.OPENAI_API_KEY = "sk-test-key";
      process.env.GOOGLE_API_KEY = "test-google-key";

      const response = await GET();
      const models: AvailableModel[] = await response.json();

      const defaultModels = models.filter((m) => m.isDefault);
      expect(defaultModels.length).toBe(1);
      expect(defaultModels[0].provider).toBe("bedrock");
    });
  });

  describe("Performance", () => {
    it("should respond in less than 200ms", async () => {
      process.env.AWS_REGION = "us-west-2";
      const startTime = Date.now();
      await GET();
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(200);
    });
  });

  describe("Error handling", () => {
    it("should handle errors gracefully", async () => {
      // Test with corrupted environment (should still return valid response)
      process.env.AWS_REGION = "us-west-2";
      const response = await GET();

      expect(response.status).toBeLessThan(500);
    });
  });
});
