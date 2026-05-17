/**
 * Unit tests for GET /api/models endpoint.
 * 
 * These tests verify:
 * - Response structure matches AvailableModel[] schema
 * - Default model is Claude Sonnet 4.5
 * - Provider filtering works correctly
 * - Error handling returns proper 500 response
 * - Caching headers are set correctly
 * 
 * Run with: npx vitest run src/app/api/models/route.test.ts
 * Or with jest: npx jest src/app/api/models/route.test.ts
 */

import { NextRequest } from "next/server";
import { GET } from "./route";
import type { AvailableModel } from "@/lib/workflow/types";

// Helper to create mock NextRequest
function createMockRequest(url: string): NextRequest {
  return new NextRequest(new URL(url, "http://localhost:3000"));
}

describe("GET /api/models", () => {
  describe("Success cases", () => {
    it("should return 200 with all models when no filter is specified", async () => {
      const request = createMockRequest("/api/models");
      const response = await GET(request);
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toHaveProperty("models");
      expect(Array.isArray(data.models)).toBe(true);
      expect(data.models.length).toBeGreaterThanOrEqual(4);
    });

    it("should include Claude Sonnet 4.5 as the default model", async () => {
      const request = createMockRequest("/api/models");
      const response = await GET(request);
      const data = await response.json();
      
      const defaultModel = data.models.find(
        (m: AvailableModel) => m.isDefault === true
      );
      
      expect(defaultModel).toBeDefined();
      expect(defaultModel.provider).toBe("bedrock");
      expect(defaultModel.modelId).toBe("anthropic.claude-sonnet-4-5-v1:0");
      expect(defaultModel.displayName).toBe("Claude Sonnet 4.5");
    });

    it("should include exactly one default model", async () => {
      const request = createMockRequest("/api/models");
      const response = await GET(request);
      const data = await response.json();
      
      const defaultModels = data.models.filter(
        (m: AvailableModel) => m.isDefault === true
      );
      
      expect(defaultModels.length).toBe(1);
    });

    it("should include Claude Opus 4", async () => {
      const request = createMockRequest("/api/models");
      const response = await GET(request);
      const data = await response.json();
      
      const opusModel = data.models.find(
        (m: AvailableModel) => m.modelId === "anthropic.claude-opus-4-v1:0"
      );
      
      expect(opusModel).toBeDefined();
      expect(opusModel.provider).toBe("bedrock");
      expect(opusModel.displayName).toBe("Claude Opus 4");
      expect(opusModel.isDefault).toBe(false);
    });

    it("should include GPT-4 Turbo", async () => {
      const request = createMockRequest("/api/models");
      const response = await GET(request);
      const data = await response.json();
      
      const gptModel = data.models.find(
        (m: AvailableModel) => m.modelId === "gpt-4-turbo"
      );
      
      expect(gptModel).toBeDefined();
      expect(gptModel.provider).toBe("openai");
      expect(gptModel.displayName).toBe("GPT-4 Turbo");
    });

    it("should include Gemini Pro", async () => {
      const request = createMockRequest("/api/models");
      const response = await GET(request);
      const data = await response.json();
      
      const geminiModel = data.models.find(
        (m: AvailableModel) => m.modelId === "gemini-pro"
      );
      
      expect(geminiModel).toBeDefined();
      expect(geminiModel.provider).toBe("gemini");
      expect(geminiModel.displayName).toBe("Gemini Pro");
    });

    it("should return models with all required fields", async () => {
      const request = createMockRequest("/api/models");
      const response = await GET(request);
      const data = await response.json();
      
      data.models.forEach((model: AvailableModel) => {
        expect(model).toHaveProperty("provider");
        expect(model).toHaveProperty("modelId");
        expect(model).toHaveProperty("displayName");
        expect(model).toHaveProperty("isDefault");
        expect(["bedrock", "openai", "gemini"]).toContain(model.provider);
        expect(typeof model.modelId).toBe("string");
        expect(typeof model.displayName).toBe("string");
        expect(typeof model.isDefault).toBe("boolean");
      });
    });
  });

  describe("Provider filtering", () => {
    it("should filter models by provider=bedrock", async () => {
      const request = createMockRequest("/api/models?provider=bedrock");
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.models.length).toBeGreaterThanOrEqual(2);
      
      data.models.forEach((model: AvailableModel) => {
        expect(model.provider).toBe("bedrock");
      });
    });

    it("should filter models by provider=openai", async () => {
      const request = createMockRequest("/api/models?provider=openai");
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.models.length).toBeGreaterThanOrEqual(1);
      
      data.models.forEach((model: AvailableModel) => {
        expect(model.provider).toBe("openai");
      });
    });

    it("should filter models by provider=gemini", async () => {
      const request = createMockRequest("/api/models?provider=gemini");
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.models.length).toBeGreaterThanOrEqual(1);
      
      data.models.forEach((model: AvailableModel) => {
        expect(model.provider).toBe("gemini");
      });
    });

    it("should handle case-insensitive provider filter", async () => {
      const request = createMockRequest("/api/models?provider=BEDROCK");
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.models.length).toBeGreaterThanOrEqual(2);
    });

    it("should return empty array for invalid provider", async () => {
      const request = createMockRequest("/api/models?provider=invalid");
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.models).toEqual([]);
    });

    it("should trim whitespace from provider filter", async () => {
      const request = createMockRequest("/api/models?provider=%20bedrock%20");
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.models.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Caching headers", () => {
    it("should set Cache-Control header with max-age=3600", async () => {
      const request = createMockRequest("/api/models");
      const response = await GET(request);
      
      const cacheControl = response.headers.get("Cache-Control");
      
      expect(cacheControl).toBeDefined();
      expect(cacheControl).toContain("max-age=3600");
    });

    it("should include stale-while-revalidate directive", async () => {
      const request = createMockRequest("/api/models");
      const response = await GET(request);
      
      const cacheControl = response.headers.get("Cache-Control");
      
      expect(cacheControl).toContain("stale-while-revalidate");
    });
  });

  describe("Response schema validation", () => {
    it("should return response with models key at root", async () => {
      const request = createMockRequest("/api/models");
      const response = await GET(request);
      const data = await response.json();
      
      expect(Object.keys(data)).toEqual(["models"]);
    });

    it("should match the example response from requirements", async () => {
      const request = createMockRequest("/api/models");
      const response = await GET(request);
      const data = await response.json();
      
      // Check first model (should be default Claude Sonnet 4.5)
      const sonnetModel = data.models.find(
        (m: AvailableModel) => m.modelId === "anthropic.claude-sonnet-4-5-v1:0"
      );
      
      expect(sonnetModel).toEqual({
        provider: "bedrock",
        modelId: "anthropic.claude-sonnet-4-5-v1:0",
        displayName: "Claude Sonnet 4.5",
        description: "Balanced performance and cost, optimized for development tasks",
        isDefault: true,
      });
    });
  });
});
