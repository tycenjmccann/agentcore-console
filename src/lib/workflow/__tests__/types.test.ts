/**
 * Unit tests for ModelConfig type system
 * Tests type guards and validation logic
 */

import { describe, it, expect } from "@jest/globals";
import type { ModelConfig, BedrockConfig, OpenAIConfig, GeminiConfig } from "../types";
import { isBedrockConfig, isOpenAIConfig, isGeminiConfig } from "../types";

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
        modelId: "gemini-2.0-flash-exp",
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

  describe("Type discrimination in switch statements", () => {
    it("should correctly discriminate Bedrock config", () => {
      const config: ModelConfig = {
        provider: "bedrock",
        modelId: "anthropic.claude-sonnet-4-5-v1:0",
        region: "us-east-1",
      };

      let result: string;
      switch (config.provider) {
        case "bedrock":
          // TypeScript should narrow to BedrockConfig here
          result = `Bedrock: ${config.modelId} in ${config.region ?? "default region"}`;
          break;
        case "openai":
          result = `OpenAI: ${config.modelId}`;
          break;
        case "gemini":
          result = `Gemini: ${config.modelId}`;
          break;
      }

      expect(result).toBe("Bedrock: anthropic.claude-sonnet-4-5-v1:0 in us-east-1");
    });

    it("should correctly discriminate OpenAI config", () => {
      const config: ModelConfig = {
        provider: "openai",
        modelId: "gpt-4o",
      };

      let result: string;
      if (isOpenAIConfig(config)) {
        result = `OpenAI: ${config.modelId}`;
      } else {
        result = "Not OpenAI";
      }

      expect(result).toBe("OpenAI: gpt-4o");
    });
  });

  describe("ModelConfig serialization", () => {
    it("should serialize and deserialize Bedrock config", () => {
      const config: BedrockConfig = {
        provider: "bedrock",
        modelId: "anthropic.claude-opus-4-0-v1:0",
      };

      const json = JSON.stringify(config);
      const parsed = JSON.parse(json) as ModelConfig;

      expect(parsed.provider).toBe("bedrock");
      expect(parsed.modelId).toBe("anthropic.claude-opus-4-0-v1:0");
      expect(isBedrockConfig(parsed)).toBe(true);
    });

    it("should serialize and deserialize OpenAI config", () => {
      const config: OpenAIConfig = {
        provider: "openai",
        modelId: "gpt-4-turbo",
      };

      const json = JSON.stringify(config);
      const parsed = JSON.parse(json) as ModelConfig;

      expect(parsed.provider).toBe("openai");
      expect(parsed.modelId).toBe("gpt-4-turbo");
      expect(isOpenAIConfig(parsed)).toBe(true);
    });

    it("should serialize and deserialize Gemini config", () => {
      const config: GeminiConfig = {
        provider: "gemini",
        modelId: "gemini-1.5-pro",
      };

      const json = JSON.stringify(config);
      const parsed = JSON.parse(json) as ModelConfig;

      expect(parsed.provider).toBe("gemini");
      expect(parsed.modelId).toBe("gemini-1.5-pro");
      expect(isGeminiConfig(parsed)).toBe(true);
    });
  });
});

describe("WorkflowInput with modelOverride", () => {
  it("should accept WorkflowInput without modelOverride", () => {
    const input = {
      title: "Test Workflow",
      description: "Test description",
      repoConfig: {
        layout: "monorepo" as const,
        repos: [],
      },
      sources: [],
      // modelOverride is optional
    };

    expect(input.title).toBe("Test Workflow");
    expect(input.modelOverride).toBeUndefined();
  });

  it("should accept WorkflowInput with Bedrock modelOverride", () => {
    const input = {
      title: "Test Workflow",
      description: "Test description",
      repoConfig: {
        layout: "monorepo" as const,
        repos: [],
      },
      sources: [],
      modelOverride: {
        provider: "bedrock" as const,
        modelId: "anthropic.claude-opus-4-0-v1:0",
        region: "us-west-2",
      },
    };

    expect(input.modelOverride).toBeDefined();
    expect(input.modelOverride?.provider).toBe("bedrock");
    if (input.modelOverride && isBedrockConfig(input.modelOverride)) {
      expect(input.modelOverride.region).toBe("us-west-2");
    }
  });

  it("should accept WorkflowInput with OpenAI modelOverride", () => {
    const input = {
      title: "Test Workflow",
      description: "Test description",
      repoConfig: {
        layout: "monorepo" as const,
        repos: [],
      },
      sources: [],
      modelOverride: {
        provider: "openai" as const,
        modelId: "gpt-4-turbo",
      },
    };

    expect(input.modelOverride).toBeDefined();
    expect(input.modelOverride?.provider).toBe("openai");
  });

  it("should accept WorkflowInput with Gemini modelOverride", () => {
    const input = {
      title: "Test Workflow",
      description: "Test description",
      repoConfig: {
        layout: "monorepo" as const,
        repos: [],
      },
      sources: [],
      modelOverride: {
        provider: "gemini" as const,
        modelId: "gemini-2.0-flash-exp",
      },
    };

    expect(input.modelOverride).toBeDefined();
    expect(input.modelOverride?.provider).toBe("gemini");
  });
});
