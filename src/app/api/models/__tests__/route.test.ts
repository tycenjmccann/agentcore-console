/**
 * Integration tests for GET /api/models endpoint
 * Tests environment-based model availability and response format
 */

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { GET } from "../route";
import { NextRequest } from "next/server";
import type { AvailableModel } from "../route";

describe("GET /api/models", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment before each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe("Response format validation", () => {
    it("should return 200 status code", async () => {
      process.env.AWS_REGION = "us-east-1";
      
      const request = new NextRequest("http://localhost:3000/api/models");
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it("should return valid JSON array", async () => {
      process.env.AWS_REGION = "us-east-1";
      
      const request = new NextRequest("http://localhost:3000/api/models");
      const response = await GET(request);
      const data = await response.json();

      expect(Array.isArray(data)).toBe(true);
    });

    it("should return models with required fields", async () => {
      process.env.AWS_REGION = "us-east-1";
      
      const request = new NextRequest("http://localhost:3000/api/models");
      const response = await GET(request);
      const data: AvailableModel[] = await response.json();

      expect(data.length).toBeGreaterThan(0);
      
      data.forEach((model) => {
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

    it("should set cache headers", async () => {
      process.env.AWS_REGION = "us-east-1";
      
      const request = new NextRequest("http://localhost:3000/api/models");
      const response = await GET(request);

      const cacheControl = response.headers.get("Cache-Control");
      expect(cacheControl).toContain("max-age");
    });
  });

  describe("Environment-based availability", () => {
    it("should return Bedrock models when AWS_REGION is set", async () => {
      process.env.AWS_REGION = "us-east-1";
      delete process.env.OPENAI_API_KEY;
      delete process.env.GOOGLE_API_KEY;
      
      const request = new NextRequest("http://localhost:3000/api/models");
      const response = await GET(request);
      const data: AvailableModel[] = await response.json();

      const bedrockModels = data.filter((m) => m.provider === "bedrock");
      expect(bedrockModels.length).toBeGreaterThan(0);
      
      const openaiModels = data.filter((m) => m.provider === "openai");
      expect(openaiModels.length).toBe(0);
      
      const geminiModels = data.filter((m) => m.provider === "gemini");
      expect(geminiModels.length).toBe(0);
    });

    it("should return OpenAI models when OPENAI_API_KEY is set", async () => {
      delete process.env.AWS_REGION;
      process.env.OPENAI_API_KEY = "sk-test-key";
      delete process.env.GOOGLE_API_KEY;
      
      const request = new NextRequest("http://localhost:3000/api/models");
      const response = await GET(request);
      const data: AvailableModel[] = await response.json();

      const openaiModels = data.filter((m) => m.provider === "openai");
      expect(openaiModels.length).toBeGreaterThan(0);
      
      const bedrockModels = data.filter((m) => m.provider === "bedrock");
      expect(bedrockModels.length).toBe(0);
    });

    it("should return Gemini models when GOOGLE_API_KEY is set", async () => {
      delete process.env.AWS_REGION;
      delete process.env.OPENAI_API_KEY;
      process.env.GOOGLE_API_KEY = "test-api-key";
      
      const request = new NextRequest("http://localhost:3000/api/models");
      const response = await GET(request);
      const data: AvailableModel[] = await response.json();

      const geminiModels = data.filter((m) => m.provider === "gemini");
      expect(geminiModels.length).toBeGreaterThan(0);
      
      const bedrockModels = data.filter((m) => m.provider === "bedrock");
      expect(bedrockModels.length).toBe(0);
    });

    it("should return all models when all providers are configured", async () => {
      process.env.AWS_REGION = "us-east-1";
      process.env.OPENAI_API_KEY = "sk-test-key";
      process.env.GOOGLE_API_KEY = "test-api-key";
      
      const request = new NextRequest("http://localhost:3000/api/models");
      const response = await GET(request);
      const data: AvailableModel[] = await response.json();

      const bedrockModels = data.filter((m) => m.provider === "bedrock");
      expect(bedrockModels.length).toBeGreaterThan(0);
      
      const openaiModels = data.filter((m) => m.provider === "openai");
      expect(openaiModels.length).toBeGreaterThan(0);
      
      const geminiModels = data.filter((m) => m.provider === "gemini");
      expect(geminiModels.length).toBeGreaterThan(0);
    });

    it("should return empty array when no providers configured", async () => {
      delete process.env.AWS_REGION;
      delete process.env.OPENAI_API_KEY;
      delete process.env.GOOGLE_API_KEY;
      
      const request = new NextRequest("http://localhost:3000/api/models");
      const response = await GET(request);
      const data: AvailableModel[] = await response.json();

      expect(data).toEqual([]);
      expect(response.status).toBe(200); // Still return 200, not an error
    });
  });

  describe("Default model", () => {
    it("should mark Claude Sonnet 4.5 as default", async () => {
      process.env.AWS_REGION = "us-east-1";
      
      const request = new NextRequest("http://localhost:3000/api/models");
      const response = await GET(request);
      const data: AvailableModel[] = await response.json();

      const defaultModels = data.filter((m) => m.isDefault);
      expect(defaultModels.length).toBe(1);
      
      const defaultModel = defaultModels[0];
      expect(defaultModel.provider).toBe("bedrock");
      expect(defaultModel.modelId).toBe("anthropic.claude-sonnet-4-5-v1:0");
      expect(defaultModel.displayName).toContain("Default");
    });

    it("should only have one default model", async () => {
      process.env.AWS_REGION = "us-east-1";
      process.env.OPENAI_API_KEY = "sk-test-key";
      process.env.GOOGLE_API_KEY = "test-api-key";
      
      const request = new NextRequest("http://localhost:3000/api/models");
      const response = await GET(request);
      const data: AvailableModel[] = await response.json();

      const defaultModels = data.filter((m) => m.isDefault);
      expect(defaultModels.length).toBe(1);
    });
  });

  describe("Performance", () => {
    it("should respond in less than 200ms", async () => {
      process.env.AWS_REGION = "us-east-1";
      process.env.OPENAI_API_KEY = "sk-test-key";
      process.env.GOOGLE_API_KEY = "test-api-key";
      
      const request = new NextRequest("http://localhost:3000/api/models");
      
      const startTime = Date.now();
      await GET(request);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(200);
    });
  });

  describe("Model metadata", () => {
    it("should include descriptions for all models", async () => {
      process.env.AWS_REGION = "us-east-1";
      
      const request = new NextRequest("http://localhost:3000/api/models");
      const response = await GET(request);
      const data: AvailableModel[] = await response.json();

      data.forEach((model) => {
        expect(model.description).toBeDefined();
        expect(typeof model.description).toBe("string");
        expect(model.description!.length).toBeGreaterThan(0);
      });
    });

    it("should have unique model IDs", async () => {
      process.env.AWS_REGION = "us-east-1";
      process.env.OPENAI_API_KEY = "sk-test-key";
      process.env.GOOGLE_API_KEY = "test-api-key";
      
      const request = new NextRequest("http://localhost:3000/api/models");
      const response = await GET(request);
      const data: AvailableModel[] = await response.json();

      const modelIds = data.map((m) => m.modelId);
      const uniqueIds = new Set(modelIds);
      
      expect(modelIds.length).toBe(uniqueIds.size);
    });
  });
});
