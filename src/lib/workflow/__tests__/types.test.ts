/**
 * Unit tests for ModelConfig type system
 * Tests type guards and validation logic
 */

import { describe, it, expect } from "@jest/globals";
import {
  ModelConfig,
  BedrockConfig,
  OpenAIConfig,
  GeminiConfig,
  isBedrockConfig,
  isOpenAIConfig,
  isGeminiConfig,
} from "../types";

describe("ModelConfig Type Guards", () => {
  describe("isBedrockConfig", () => {
    it("should return true for valid Bedrock config", () => {
      const config: ModelConfig = {
        provider: "bedrock",
        modelId: "anthropic.claude-sonnet-4-5-v1:0",
      };

      expect(isBedrockConfig(config)).toBe(true);
    });

    it("should return true for Bedrock config with region", () => {
      const config: ModelConfig = {
        provider: "bedrock",
        modelId: "anthropic.claude-opus-4-0-v1:0",
        region: "us-west-2",
      };

      expect(isBedrockConfig(config)).toBe(true);
      if (isBedrockConfig(config)) {
        expect(config.region).toBe("us-west-2");
      }
    });

    it("should return false for OpenAI config", () => {
      const config: ModelConfig = {
        provider: "openai",
        modelId: "gpt-4-turbo",
      };

      expect(isBedrockConfig(config)).toBe(false);
    });

    it("should return false for Gemini config", () => {
      const config: ModelConfig = {
        provider: "gemini",
        modelId: "gemini-pro",
      };

      expect(isBedrockConfig(config)).toBe(false);
    });
  });

  describe("isOpenAIConfig", () => {
    it("should return true for valid OpenAI config", () => {
      const config: ModelConfig = {
        provider: "openai",
        modelId: "gpt-4-turbo",
      };

      expect(isOpenAIConfig(config)).toBe(true);
    });

    it("should return false for Bedrock config", () => {
      const config: ModelConfig = {
        provider: "bedrock",
        modelId: "anthropic.claude-sonnet-4-5-v1:0",
      };

      expect(isOpenAIConfig(config)).toBe(false);
    });

    it("should return false for Gemini config", () => {
      const config: ModelConfig = {
        provider: "gemini",
        modelId: "gemini-pro",
      };

      expect(isOpenAIConfig(config)).toBe(false);
    });
  });

  describe("isGeminiConfig", () => {
    it("should return true for valid Gemini config", () => {
      const config: ModelConfig = {
        provider: "gemini",
        modelId: "gemini-pro",
      };

      expect(isGeminiConfig(config)).toBe(true);
    });

    it("should return false for Bedrock config", () => {
      const config: ModelConfig = {
        provider: "bedrock",
        modelId: "anthropic.claude-sonnet-4-5-v1:0",
      };

      expect(isGeminiConfig(config)).toBe(false);
    });

    it("should return false for OpenAI config", () => {
      const config: ModelConfig = {
        provider: "openai",
        modelId: "gpt-4-turbo",
      };

      expect(isGeminiConfig(config)).toBe(false);
    });
  });

  describe("Type narrowing", () => {
    it("should narrow type correctly for Bedrock", () => {
      const config: ModelConfig = {
        provider: "bedrock",
        modelId: "anthropic.claude-sonnet-4-5-v1:0",
        region: "us-east-1",
      };

      if (isBedrockConfig(config)) {
        // TypeScript should infer config as BedrockConfig here
        expect(config.provider).toBe("bedrock");
        expect(config.region).toBeDefined();
      } else {
        fail("Expected Bedrock config");
      }
    });

    it("should narrow type correctly for OpenAI", () => {
      const config: ModelConfig = {
        provider: "openai",
        modelId: "gpt-4",
      };

      if (isOpenAIConfig(config)) {
        // TypeScript should infer config as OpenAIConfig here
        expect(config.provider).toBe("openai");
        expect(config.modelId).toBe("gpt-4");
      } else {
        fail("Expected OpenAI config");
      }
    });

    it("should narrow type correctly for Gemini", () => {
      const config: ModelConfig = {
        provider: "gemini",
        modelId: "gemini-pro",
      };

      if (isGeminiConfig(config)) {
        // TypeScript should infer config as GeminiConfig here
        expect(config.provider).toBe("gemini");
        expect(config.modelId).toBe("gemini-pro");
      } else {
        fail("Expected Gemini config");
      }
    });
  });

  describe("ModelConfig variants", () => {
    it("should handle all Bedrock model IDs", () => {
      const models: BedrockConfig[] = [
        {
          provider: "bedrock",
          modelId: "anthropic.claude-sonnet-4-5-v1:0",
        },
        {
          provider: "bedrock",
          modelId: "anthropic.claude-opus-4-0-v1:0",
        },
        {
          provider: "bedrock",
          modelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
        },
      ];

      models.forEach((model) => {
        expect(isBedrockConfig(model)).toBe(true);
        expect(model.provider).toBe("bedrock");
      });
    });

    it("should handle all OpenAI model IDs", () => {
      const models: OpenAIConfig[] = [
        { provider: "openai", modelId: "gpt-4-turbo" },
        { provider: "openai", modelId: "gpt-4" },
        { provider: "openai", modelId: "gpt-3.5-turbo" },
      ];

      models.forEach((model) => {
        expect(isOpenAIConfig(model)).toBe(true);
        expect(model.provider).toBe("openai");
      });
    });

    it("should handle all Gemini model IDs", () => {
      const models: GeminiConfig[] = [
        { provider: "gemini", modelId: "gemini-pro" },
        { provider: "gemini", modelId: "gemini-pro-vision" },
      ];

      models.forEach((model) => {
        expect(isGeminiConfig(model)).toBe(true);
        expect(model.provider).toBe("gemini");
      });
    });
  });
});
