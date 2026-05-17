/**
 * Tests for Model Configuration Utilities
 */

import {
  modelConfigToAgentCoreFormat,
  isDevAgent,
  validateModelConfig,
  getEffectiveModelConfig,
  getModelDisplayName,
  UnsupportedModelError,
  SUPPORTED_MODELS,
  DEV_AGENT_IDS,
} from "../model-utils";
import { DEFAULT_MODEL } from "../types";
import type { ModelConfig, BedrockModelConfig, OpenAIModelConfig, GeminiModelConfig } from "../types";

describe("modelConfigToAgentCoreFormat", () => {
  describe("Bedrock models", () => {
    it("should return modelId directly for Bedrock provider", () => {
      const config: BedrockModelConfig = {
        provider: "bedrock",
        modelId: "anthropic.claude-opus-4",
      };
      expect(modelConfigToAgentCoreFormat(config)).toBe("anthropic.claude-opus-4");
    });

    it("should handle Claude Sonnet model", () => {
      const config: BedrockModelConfig = {
        provider: "bedrock",
        modelId: "anthropic.claude-sonnet-4-5-v1",
      };
      expect(modelConfigToAgentCoreFormat(config)).toBe("anthropic.claude-sonnet-4-5-v1");
    });

    it("should handle global model IDs", () => {
      const config: BedrockModelConfig = {
        provider: "bedrock",
        modelId: "global.anthropic.claude-sonnet-4-5-20250929-v1:0",
      };
      expect(modelConfigToAgentCoreFormat(config)).toBe("global.anthropic.claude-sonnet-4-5-20250929-v1:0");
    });
  });

  describe("OpenAI models", () => {
    it("should prefix with openai: for OpenAI provider", () => {
      const config: OpenAIModelConfig = {
        provider: "openai",
        modelId: "gpt-4-turbo",
      };
      expect(modelConfigToAgentCoreFormat(config)).toBe("openai:gpt-4-turbo");
    });

    it("should handle gpt-4 model", () => {
      const config: OpenAIModelConfig = {
        provider: "openai",
        modelId: "gpt-4",
      };
      expect(modelConfigToAgentCoreFormat(config)).toBe("openai:gpt-4");
    });

    it("should handle gpt-4o model", () => {
      const config: OpenAIModelConfig = {
        provider: "openai",
        modelId: "gpt-4o",
      };
      expect(modelConfigToAgentCoreFormat(config)).toBe("openai:gpt-4o");
    });
  });

  describe("Gemini models", () => {
    it("should prefix with gemini: for Gemini provider", () => {
      const config: GeminiModelConfig = {
        provider: "gemini",
        modelId: "gemini-pro",
      };
      expect(modelConfigToAgentCoreFormat(config)).toBe("gemini:gemini-pro");
    });

    it("should handle gemini-ultra model", () => {
      const config: GeminiModelConfig = {
        provider: "gemini",
        modelId: "gemini-ultra",
      };
      expect(modelConfigToAgentCoreFormat(config)).toBe("gemini:gemini-ultra");
    });

    it("should handle gemini-1.5-pro model", () => {
      const config: GeminiModelConfig = {
        provider: "gemini",
        modelId: "gemini-1.5-pro",
      };
      expect(modelConfigToAgentCoreFormat(config)).toBe("gemini:gemini-1.5-pro");
    });
  });

  describe("Unknown/unsupported models", () => {
    it("should warn but not throw for unknown Bedrock model", () => {
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation();
      const config: BedrockModelConfig = {
        provider: "bedrock",
        modelId: "unknown.model-v1",
      };
      const result = modelConfigToAgentCoreFormat(config);
      expect(result).toBe("unknown.model-v1");
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});

describe("isDevAgent", () => {
  describe("known dev agents", () => {
    it("should return true for team-backend-dev", () => {
      expect(isDevAgent("team-backend-dev")).toBe(true);
    });

    it("should return true for team-api-dev", () => {
      expect(isDevAgent("team-api-dev")).toBe(true);
    });

    it("should return true for team-frontend-dev", () => {
      expect(isDevAgent("team-frontend-dev")).toBe(true);
    });
  });

  describe("non-dev agents", () => {
    it("should return false for team-requirements-analyst", () => {
      expect(isDevAgent("team-requirements-analyst")).toBe(false);
    });

    it("should return false for team-ios-designer", () => {
      expect(isDevAgent("team-ios-designer")).toBe(false);
    });

    it("should return false for team-backend-designer", () => {
      expect(isDevAgent("team-backend-designer")).toBe(false);
    });

    it("should return false for team-security-reviewer", () => {
      expect(isDevAgent("team-security-reviewer")).toBe(false);
    });

    it("should return false for team-legal-compliance", () => {
      expect(isDevAgent("team-legal-compliance")).toBe(false);
    });

    it("should return false for team-analytics-designer", () => {
      expect(isDevAgent("team-analytics-designer")).toBe(false);
    });
  });

  describe("unknown agents", () => {
    it("should return false for unknown agent ID", () => {
      expect(isDevAgent("unknown-agent")).toBe(false);
    });

    it("should return false for empty string", () => {
      expect(isDevAgent("")).toBe(false);
    });
  });
});

describe("validateModelConfig", () => {
  describe("valid configurations", () => {
    it("should validate Bedrock config", () => {
      const config: BedrockModelConfig = {
        provider: "bedrock",
        modelId: "anthropic.claude-sonnet-4-5-v1",
      };
      const result = validateModelConfig(config);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should validate OpenAI config when API key is set", () => {
      const originalEnv = process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = "test-key";
      
      const config: OpenAIModelConfig = {
        provider: "openai",
        modelId: "gpt-4-turbo",
      };
      const result = validateModelConfig(config);
      expect(result.isValid).toBe(true);
      
      process.env.OPENAI_API_KEY = originalEnv;
    });

    it("should validate Gemini config when API key is set", () => {
      const originalEnv = process.env.GEMINI_API_KEY;
      process.env.GEMINI_API_KEY = "test-key";
      
      const config: GeminiModelConfig = {
        provider: "gemini",
        modelId: "gemini-pro",
      };
      const result = validateModelConfig(config);
      expect(result.isValid).toBe(true);
      
      process.env.GEMINI_API_KEY = originalEnv;
    });
  });

  describe("invalid configurations", () => {
    it("should reject missing modelId", () => {
      const config = {
        provider: "bedrock",
        modelId: "",
      } as BedrockModelConfig;
      const result = validateModelConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Model ID is required");
    });

    it("should reject OpenAI without API key", () => {
      const originalEnv = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;
      
      const config: OpenAIModelConfig = {
        provider: "openai",
        modelId: "gpt-4",
      };
      const result = validateModelConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("OpenAI API key");
      
      process.env.OPENAI_API_KEY = originalEnv;
    });

    it("should reject Gemini without API key", () => {
      const originalEnv = process.env.GEMINI_API_KEY;
      delete process.env.GEMINI_API_KEY;
      
      const config: GeminiModelConfig = {
        provider: "gemini",
        modelId: "gemini-pro",
      };
      const result = validateModelConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Gemini API key");
      
      process.env.GEMINI_API_KEY = originalEnv;
    });
  });
});

describe("getEffectiveModelConfig", () => {
  it("should return provided config when given", () => {
    const config: BedrockModelConfig = {
      provider: "bedrock",
      modelId: "anthropic.claude-opus-4",
    };
    expect(getEffectiveModelConfig(config)).toEqual(config);
  });

  it("should return DEFAULT_MODEL when config is undefined", () => {
    expect(getEffectiveModelConfig(undefined)).toEqual(DEFAULT_MODEL);
  });

  it("should return DEFAULT_MODEL when config is null-ish", () => {
    expect(getEffectiveModelConfig(undefined)).toEqual(DEFAULT_MODEL);
  });
});

describe("getModelDisplayName", () => {
  it("should format Bedrock model display name", () => {
    const config: BedrockModelConfig = {
      provider: "bedrock",
      modelId: "anthropic.claude-sonnet-4-5-v1",
    };
    expect(getModelDisplayName(config)).toBe("Bedrock: anthropic.claude-sonnet-4-5-v1");
  });

  it("should format OpenAI model display name", () => {
    const config: OpenAIModelConfig = {
      provider: "openai",
      modelId: "gpt-4-turbo",
    };
    expect(getModelDisplayName(config)).toBe("OpenAI: gpt-4-turbo");
  });

  it("should format Gemini model display name", () => {
    const config: GeminiModelConfig = {
      provider: "gemini",
      modelId: "gemini-pro",
    };
    expect(getModelDisplayName(config)).toBe("Gemini: gemini-pro");
  });
});

describe("DEV_AGENT_IDS", () => {
  it("should include all dev agents", () => {
    expect(DEV_AGENT_IDS).toContain("team-backend-dev");
    expect(DEV_AGENT_IDS).toContain("team-api-dev");
    expect(DEV_AGENT_IDS).toContain("team-frontend-dev");
  });

  it("should not include design agents", () => {
    expect(DEV_AGENT_IDS).not.toContain("team-ios-designer");
    expect(DEV_AGENT_IDS).not.toContain("team-backend-designer");
  });

  it("should have exactly 3 agents", () => {
    expect(DEV_AGENT_IDS.length).toBe(3);
  });
});

describe("SUPPORTED_MODELS", () => {
  it("should have models for all providers", () => {
    expect(SUPPORTED_MODELS.bedrock.length).toBeGreaterThan(0);
    expect(SUPPORTED_MODELS.openai.length).toBeGreaterThan(0);
    expect(SUPPORTED_MODELS.gemini.length).toBeGreaterThan(0);
  });

  it("should include DEFAULT_MODEL in Bedrock list", () => {
    expect(SUPPORTED_MODELS.bedrock).toContain(DEFAULT_MODEL.modelId);
  });

  it("should include Claude Opus in Bedrock list", () => {
    expect(SUPPORTED_MODELS.bedrock).toContain("anthropic.claude-opus-4");
  });
});
