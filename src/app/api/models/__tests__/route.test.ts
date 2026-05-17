/**
 * Integration tests for GET /api/models
 * 
 * Tests the models API endpoint for correct response format,
 * content validation, and error handling.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET, OPTIONS, type ModelsResponse, type AvailableModel } from "../route";
import { DEFAULT_MODEL } from "@/lib/workflow/types";

// Mock console methods for clean test output
beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("GET /api/models", () => {
  describe("successful responses", () => {
    it("should return 200 status code", async () => {
      const response = await GET();
      expect(response.status).toBe(200);
    });

    it("should return JSON content type", async () => {
      const response = await GET();
      expect(response.headers.get("Content-Type")).toBe("application/json");
    });

    it("should include cache headers", async () => {
      const response = await GET();
      expect(response.headers.get("Cache-Control")).toContain("max-age=300");
    });

    it("should return ModelsResponse structure", async () => {
      const response = await GET();
      const data: ModelsResponse = await response.json();

      expect(data).toHaveProperty("models");
      expect(data).toHaveProperty("defaultModel");
      expect(Array.isArray(data.models)).toBe(true);
    });
  });

  describe("models list content", () => {
    it("should include at least one model", async () => {
      const response = await GET();
      const data: ModelsResponse = await response.json();

      expect(data.models.length).toBeGreaterThan(0);
    });

    it("should have exactly one default model", async () => {
      const response = await GET();
      const data: ModelsResponse = await response.json();

      const defaultModels = data.models.filter((m) => m.isDefault);
      expect(defaultModels.length).toBe(1);
    });

    it("should include Claude Sonnet 4.5 as default", async () => {
      const response = await GET();
      const data: ModelsResponse = await response.json();

      const defaultModel = data.models.find((m) => m.isDefault);
      expect(defaultModel).toBeDefined();
      expect(defaultModel?.provider).toBe("bedrock");
      expect(defaultModel?.modelId).toBe("anthropic.claude-sonnet-4-5-v1");
      expect(defaultModel?.displayName).toBe("Claude Sonnet 4.5");
    });

    it("should include all required model properties", async () => {
      const response = await GET();
      const data: ModelsResponse = await response.json();

      data.models.forEach((model: AvailableModel) => {
        expect(model).toHaveProperty("provider");
        expect(model).toHaveProperty("modelId");
        expect(model).toHaveProperty("displayName");
        expect(model).toHaveProperty("description");
        expect(model).toHaveProperty("isDefault");
        expect(typeof model.provider).toBe("string");
        expect(typeof model.modelId).toBe("string");
        expect(typeof model.displayName).toBe("string");
        expect(typeof model.description).toBe("string");
        expect(typeof model.isDefault).toBe("boolean");
      });
    });

    it("should include Bedrock models", async () => {
      const response = await GET();
      const data: ModelsResponse = await response.json();

      const bedrockModels = data.models.filter((m) => m.provider === "bedrock");
      expect(bedrockModels.length).toBeGreaterThan(0);
    });

    it("should include OpenAI models", async () => {
      const response = await GET();
      const data: ModelsResponse = await response.json();

      const openaiModels = data.models.filter((m) => m.provider === "openai");
      expect(openaiModels.length).toBeGreaterThan(0);
    });

    it("should include Gemini models", async () => {
      const response = await GET();
      const data: ModelsResponse = await response.json();

      const geminiModels = data.models.filter((m) => m.provider === "gemini");
      expect(geminiModels.length).toBeGreaterThan(0);
    });

    it("should have valid provider values", async () => {
      const response = await GET();
      const data: ModelsResponse = await response.json();
      const validProviders = ["bedrock", "openai", "gemini"];

      data.models.forEach((model) => {
        expect(validProviders).toContain(model.provider);
      });
    });
  });

  describe("default model configuration", () => {
    it("should return the correct default model", async () => {
      const response = await GET();
      const data: ModelsResponse = await response.json();

      expect(data.defaultModel).toEqual(DEFAULT_MODEL);
    });

    it("should have default model matching isDefault in models list", async () => {
      const response = await GET();
      const data: ModelsResponse = await response.json();

      const defaultInList = data.models.find((m) => m.isDefault);
      expect(defaultInList?.provider).toBe(data.defaultModel.provider);
      expect(defaultInList?.modelId).toBe(data.defaultModel.modelId);
    });
  });

  describe("response time", () => {
    it("should respond in less than 100ms", async () => {
      const startTime = performance.now();
      await GET();
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(100);
    });
  });
});

describe("OPTIONS /api/models", () => {
  it("should return 204 status code", async () => {
    const response = await OPTIONS();
    expect(response.status).toBe(204);
  });

  it("should include CORS headers", async () => {
    const response = await OPTIONS();

    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain("GET");
    expect(response.headers.get("Access-Control-Allow-Headers")).toContain("Content-Type");
  });

  it("should include max-age for preflight caching", async () => {
    const response = await OPTIONS();
    expect(response.headers.get("Access-Control-Max-Age")).toBe("86400");
  });
});
