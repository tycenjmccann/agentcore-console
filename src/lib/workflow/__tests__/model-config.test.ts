/**
 * Model Configuration System - Integration Tests
 * 
 * Tests for the complete workflow model configuration pipeline:
 * 1. Provider availability checking
 * 2. Model config validation
 * 3. WorkflowState model config integration
 * 4. Agent invocation with custom models
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import type {
  ModelConfig,
  WorkflowState,
  ProviderAvailability,
} from "@/lib/workflow/types";
import {
  toModelConfigPayload,
  validateModelConfig,
  getModelDisplayName,
  createModelConfig,
} from "@/lib/workflow/model-config";
import {
  getWorkflowModelConfig,
  invokeWorkflowAgent,
} from "@/lib/workflow/engine-model";
import { DEFAULT_MODEL_CONFIG, BEDROCK_MODELS, OPENAI_MODELS } from "@/lib/workflow/types";

describe("Model Configuration Utilities", () => {
  describe("toModelConfigPayload", () => {
    it("should transform Bedrock config correctly", () => {
      const config: ModelConfig = {
        type: "bedrock",
        config: { modelId: BEDROCK_MODELS.CLAUDE_SONNET_4_5 },
      };
      
      const payload = toModelConfigPayload(config);
      
      expect(payload).toHaveProperty("bedrockModelConfig");
      expect(payload).toEqual({
        bedrockModelConfig: { modelId: BEDROCK_MODELS.CLAUDE_SONNET_4_5 },
      });
    });

    it("should transform OpenAI config correctly", () => {
      const config: ModelConfig = {
        type: "openai",
        config: {
          modelId: OPENAI_MODELS.O3,
          apiKeyArn: "arn:aws:secretsmanager:us-east-1:123456789012:secret:openai-key",
        },
      };
      
      const payload = toModelConfigPayload(config);
      
      expect(payload).toHaveProperty("openAiModelConfig");
    });
  });

  describe("validateModelConfig", () => {
    it("should validate Bedrock config with model ID", () => {
      const config: ModelConfig = {
        type: "bedrock",
        config: { modelId: BEDROCK_MODELS.CLAUDE_HAIKU_4_5 },
      };
      
      const result = validateModelConfig(config);
      
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should reject Bedrock config without model ID", () => {
      const config: ModelConfig = {
        type: "bedrock",
        config: { modelId: "" },
      };
      
      const result = validateModelConfig(config);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Bedrock model ID is required");
    });

    it("should validate OpenAI config with API key ARN", () => {
      const config: ModelConfig = {
        type: "openai",
        config: {
          modelId: "gpt-4",
          apiKeyArn: "arn:aws:secretsmanager:us-east-1:123456789012:secret:openai-key",
        },
      };
      
      const result = validateModelConfig(config);
      
      expect(result.valid).toBe(true);
    });

    it("should reject OpenAI config with invalid ARN format", () => {
      const config: ModelConfig = {
        type: "openai",
        config: {
          modelId: "gpt-4",
          apiKeyArn: "not-an-arn",
        },
      };
      
      const result = validateModelConfig(config);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid OpenAI API key ARN format");
    });
  });

  describe("getModelDisplayName", () => {
    it("should format Bedrock model names", () => {
      const config: ModelConfig = {
        type: "bedrock",
        config: { modelId: BEDROCK_MODELS.CLAUDE_SONNET_4_5 },
      };
      
      const displayName = getModelDisplayName(config);
      
      expect(displayName).toContain("Bedrock");
      expect(displayName).toContain("Claude");
    });

    it("should format OpenAI model names", () => {
      const config: ModelConfig = {
        type: "openai",
        config: {
          modelId: OPENAI_MODELS.O3,
          apiKeyArn: "arn:aws:secretsmanager:us-east-1:123456789012:secret:key",
        },
      };
      
      const displayName = getModelDisplayName(config);
      
      expect(displayName).toBe("OpenAI: o3");
    });
  });
});

describe("Workflow Engine Model Integration", () => {
  describe("getWorkflowModelConfig", () => {
    it("should return workflow modelConfig when present and valid", () => {
      const workflow: WorkflowState = {
        id: "test-workflow",
        phase: "design",
        epicId: "TEAM-1",
        repoConfig: { layout: "monorepo", repos: [] },
        input: { title: "Test", description: "Test", repoConfig: { layout: "monorepo", repos: [] }, sources: [] },
        agentTasks: {},
        messages: [],
        humanNotifications: [],
        startedAt: new Date().toISOString(),
        modelConfig: {
          type: "bedrock",
          config: { modelId: BEDROCK_MODELS.NOVA_PRO },
        },
      };
      
      const config = getWorkflowModelConfig(workflow);
      
      expect(config.type).toBe("bedrock");
      expect(config.config.modelId).toBe(BEDROCK_MODELS.NOVA_PRO);
    });

    it("should return default config when modelConfig is missing", () => {
      const workflow: WorkflowState = {
        id: "test-workflow",
        phase: "design",
        epicId: "TEAM-1",
        repoConfig: { layout: "monorepo", repos: [] },
        input: { title: "Test", description: "Test", repoConfig: { layout: "monorepo", repos: [] }, sources: [] },
        agentTasks: {},
        messages: [],
        humanNotifications: [],
        startedAt: new Date().toISOString(),
      };
      
      const config = getWorkflowModelConfig(workflow);
      
      expect(config).toEqual(DEFAULT_MODEL_CONFIG);
    });

    it("should return default config when modelConfig is invalid", () => {
      const workflow: WorkflowState = {
        id: "test-workflow",
        phase: "design",
        epicId: "TEAM-1",
        repoConfig: { layout: "monorepo", repos: [] },
        input: { title: "Test", description: "Test", repoConfig: { layout: "monorepo", repos: [] }, sources: [] },
        agentTasks: {},
        messages: [],
        humanNotifications: [],
        startedAt: new Date().toISOString(),
        modelConfig: {
          type: "bedrock",
          config: { modelId: "" }, // Invalid: empty model ID
        },
      };
      
      const config = getWorkflowModelConfig(workflow);
      
      // Should fall back to default
      expect(config).toEqual(DEFAULT_MODEL_CONFIG);
    });
  });
});

describe("Provider Availability API", () => {
  it("should have correct contract shape", () => {
    const availability: ProviderAvailability = {
      bedrock: true,
      openai: false,
      gemini: false,
    };
    
    expect(availability).toHaveProperty("bedrock");
    expect(availability).toHaveProperty("openai");
    expect(availability).toHaveProperty("gemini");
    expect(typeof availability.bedrock).toBe("boolean");
  });
});
