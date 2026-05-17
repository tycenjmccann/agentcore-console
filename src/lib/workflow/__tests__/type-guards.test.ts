/**
 * Unit tests for ModelConfig type guards
 * 
 * To run these tests:
 * 1. Install vitest: npm install -D vitest @vitest/ui
 * 2. Add to package.json scripts: "test": "vitest"
 * 3. Run: npm test
 */

import { describe, it, expect } from "vitest";
import {
  isModelConfig,
  isBedrockConfig,
  isOpenAIConfig,
  isGeminiConfig,
  validateModelConfig
} from "../type-guards";
import type { ModelConfig } from "../types";

describe("isModelConfig", () => {
  it("returns true for valid BedrockConfig", () => {
    const config = {
      provider: "bedrock",
      modelId: "anthropic.claude-sonnet-4-5-v1:0",
      region: "us-east-1"
    };
    expect(isModelConfig(config)).toBe(true);
  });
  
  it("returns true for valid OpenAIConfig", () => {
    const config = {
      provider: "openai",
      modelId: "gpt-4-turbo"
    };
    expect(isModelConfig(config)).toBe(true);
  });
  
  it("returns true for valid GeminiConfig", () => {
    const config = {
      provider: "gemini",
      modelId: "gemini-pro",
      apiVersion: "v1"
    };
    expect(isModelConfig(config)).toBe(true);
  });
  
  it("returns false for null", () => {
    expect(isModelConfig(null)).toBe(false);
  });
  
  it("returns false for undefined", () => {
    expect(isModelConfig(undefined)).toBe(false);
  });
  
  it("returns false for string", () => {
    expect(isModelConfig("not a config")).toBe(false);
  });
  
  it("returns false for number", () => {
    expect(isModelConfig(123)).toBe(false);
  });
  
  it("returns false for array", () => {
    expect(isModelConfig([])).toBe(false);
  });
  
  it("returns false for missing provider", () => {
    const config = {
      modelId: "some-model"
    };
    expect(isModelConfig(config)).toBe(false);
  });
  
  it("returns false for missing modelId", () => {
    const config = {
      provider: "bedrock"
    };
    expect(isModelConfig(config)).toBe(false);
  });
  
  it("returns false for invalid provider", () => {
    const config = {
      provider: "invalid",
      modelId: "some-model"
    };
    expect(isModelConfig(config)).toBe(false);
  });
  
  it("returns false for non-string provider", () => {
    const config = {
      provider: 123,
      modelId: "some-model"
    };
    expect(isModelConfig(config)).toBe(false);
  });
  
  it("returns false for non-string modelId", () => {
    const config = {
      provider: "bedrock",
      modelId: 456
    };
    expect(isModelConfig(config)).toBe(false);
  });
});

describe("Provider-specific type guards", () => {
  const bedrockConfig: ModelConfig = {
    provider: "bedrock",
    modelId: "anthropic.claude-sonnet-4-5-v1:0"
  };
  
  const openaiConfig: ModelConfig = {
    provider: "openai",
    modelId: "gpt-4-turbo"
  };
  
  const geminiConfig: ModelConfig = {
    provider: "gemini",
    modelId: "gemini-pro"
  };
  
  describe("isBedrockConfig", () => {
    it("returns true for BedrockConfig", () => {
      expect(isBedrockConfig(bedrockConfig)).toBe(true);
    });
    
    it("returns false for OpenAIConfig", () => {
      expect(isBedrockConfig(openaiConfig)).toBe(false);
    });
    
    it("returns false for GeminiConfig", () => {
      expect(isBedrockConfig(geminiConfig)).toBe(false);
    });
    
    it("allows type narrowing", () => {
      if (isBedrockConfig(bedrockConfig)) {
        // TypeScript should know this is BedrockConfig
        expect(bedrockConfig.provider).toBe("bedrock");
        // region is optional but should be allowed
        const region: string | undefined = bedrockConfig.region;
        expect(region).toBeUndefined();
      }
    });
  });
  
  describe("isOpenAIConfig", () => {
    it("returns true for OpenAIConfig", () => {
      expect(isOpenAIConfig(openaiConfig)).toBe(true);
    });
    
    it("returns false for BedrockConfig", () => {
      expect(isOpenAIConfig(bedrockConfig)).toBe(false);
    });
    
    it("returns false for GeminiConfig", () => {
      expect(isOpenAIConfig(geminiConfig)).toBe(false);
    });
    
    it("allows type narrowing", () => {
      if (isOpenAIConfig(openaiConfig)) {
        // TypeScript should know this is OpenAIConfig
        expect(openaiConfig.provider).toBe("openai");
        // apiVersion is optional but should be allowed
        const apiVersion: string | undefined = openaiConfig.apiVersion;
        expect(apiVersion).toBeUndefined();
      }
    });
  });
  
  describe("isGeminiConfig", () => {
    it("returns true for GeminiConfig", () => {
      expect(isGeminiConfig(geminiConfig)).toBe(true);
    });
    
    it("returns false for BedrockConfig", () => {
      expect(isGeminiConfig(bedrockConfig)).toBe(false);
    });
    
    it("returns false for OpenAIConfig", () => {
      expect(isGeminiConfig(openaiConfig)).toBe(false);
    });
    
    it("allows type narrowing", () => {
      if (isGeminiConfig(geminiConfig)) {
        // TypeScript should know this is GeminiConfig
        expect(geminiConfig.provider).toBe("gemini");
        // apiVersion is optional but should be allowed
        const apiVersion: string | undefined = geminiConfig.apiVersion;
        expect(apiVersion).toBeUndefined();
      }
    });
  });
});

describe("validateModelConfig", () => {
  it("does not throw for valid BedrockConfig", () => {
    const config = {
      provider: "bedrock",
      modelId: "anthropic.claude-sonnet-4-5-v1:0",
      region: "us-east-1"
    };
    expect(() => validateModelConfig(config)).not.toThrow();
  });
  
  it("does not throw for valid BedrockConfig without region", () => {
    const config = {
      provider: "bedrock",
      modelId: "anthropic.claude-sonnet-4-5-v1:0"
    };
    expect(() => validateModelConfig(config)).not.toThrow();
  });
  
  it("does not throw for valid OpenAIConfig", () => {
    const config = {
      provider: "openai",
      modelId: "gpt-4-turbo",
      apiVersion: "2023-05-15"
    };
    expect(() => validateModelConfig(config)).not.toThrow();
  });
  
  it("does not throw for valid OpenAIConfig without apiVersion", () => {
    const config = {
      provider: "openai",
      modelId: "gpt-4-turbo"
    };
    expect(() => validateModelConfig(config)).not.toThrow();
  });
  
  it("does not throw for valid GeminiConfig", () => {
    const config = {
      provider: "gemini",
      modelId: "gemini-pro",
      apiVersion: "v1"
    };
    expect(() => validateModelConfig(config)).not.toThrow();
  });
  
  it("does not throw for valid GeminiConfig without apiVersion", () => {
    const config = {
      provider: "gemini",
      modelId: "gemini-pro"
    };
    expect(() => validateModelConfig(config)).not.toThrow();
  });
  
  it("throws for null", () => {
    expect(() => validateModelConfig(null)).toThrow("Invalid ModelConfig");
  });
  
  it("throws for undefined", () => {
    expect(() => validateModelConfig(undefined)).toThrow("Invalid ModelConfig");
  });
  
  it("throws for invalid config object", () => {
    const config = {
      invalid: "data"
    };
    expect(() => validateModelConfig(config)).toThrow("Invalid ModelConfig");
  });
  
  it("throws for missing provider", () => {
    const config = {
      modelId: "some-model"
    };
    expect(() => validateModelConfig(config)).toThrow("Invalid ModelConfig");
  });
  
  it("throws for missing modelId", () => {
    const config = {
      provider: "bedrock"
    };
    expect(() => validateModelConfig(config)).toThrow("Invalid ModelConfig");
  });
  
  it("throws for BedrockConfig with invalid region type", () => {
    const config = {
      provider: "bedrock",
      modelId: "anthropic.claude-sonnet-4-5-v1:0",
      region: 123
    };
    expect(() => validateModelConfig(config)).toThrow("region must be a string");
  });
  
  it("throws for OpenAIConfig with invalid apiVersion type", () => {
    const config = {
      provider: "openai",
      modelId: "gpt-4-turbo",
      apiVersion: 456
    };
    expect(() => validateModelConfig(config)).toThrow("apiVersion must be a string");
  });
  
  it("throws for GeminiConfig with invalid apiVersion type", () => {
    const config = {
      provider: "gemini",
      modelId: "gemini-pro",
      apiVersion: 789
    };
    expect(() => validateModelConfig(config)).toThrow("apiVersion must be a string");
  });
  
  it("asserts type after validation", () => {
    const config = {
      provider: "bedrock",
      modelId: "anthropic.claude-sonnet-4-5-v1:0"
    };
    
    validateModelConfig(config);
    
    // After validation, TypeScript should know this is ModelConfig
    expect(config.provider).toBe("bedrock");
    expect(config.modelId).toBe("anthropic.claude-sonnet-4-5-v1:0");
  });
});

describe("ModelConfig serialization", () => {
  it("BedrockConfig can be JSON serialized and deserialized", () => {
    const original: ModelConfig = {
      provider: "bedrock",
      modelId: "anthropic.claude-sonnet-4-5-v1:0",
      region: "us-west-2"
    };
    
    const json = JSON.stringify(original);
    const parsed = JSON.parse(json);
    
    expect(isModelConfig(parsed)).toBe(true);
    expect(isBedrockConfig(parsed)).toBe(true);
    expect(parsed).toEqual(original);
  });
  
  it("OpenAIConfig can be JSON serialized and deserialized", () => {
    const original: ModelConfig = {
      provider: "openai",
      modelId: "gpt-4-turbo",
      apiVersion: "2023-05-15"
    };
    
    const json = JSON.stringify(original);
    const parsed = JSON.parse(json);
    
    expect(isModelConfig(parsed)).toBe(true);
    expect(isOpenAIConfig(parsed)).toBe(true);
    expect(parsed).toEqual(original);
  });
  
  it("GeminiConfig can be JSON serialized and deserialized", () => {
    const original: ModelConfig = {
      provider: "gemini",
      modelId: "gemini-1.5-pro",
      apiVersion: "v1"
    };
    
    const json = JSON.stringify(original);
    const parsed = JSON.parse(json);
    
    expect(isModelConfig(parsed)).toBe(true);
    expect(isGeminiConfig(parsed)).toBe(true);
    expect(parsed).toEqual(original);
  });
});
