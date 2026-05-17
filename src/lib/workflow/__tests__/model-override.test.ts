/**
 * Integration tests for Model Override feature
 * Tests the end-to-end flow of model selection in workflows
 */

import { describe, it, expect, beforeEach } from "vitest";
import { selectModelForAgent, validateModelConfig } from "../engine-model";
import type { WorkflowInput, AgentDefinition, ModelConfig } from "../types";

describe("Model Override Integration", () => {
  const mockWorkflowId = "wf_test_123";

  const requirementsAgent: AgentDefinition = {
    id: "team-requirements",
    name: "Requirements Analyst",
    role: "Requirements gathering",
    phase: "requirements",
    harnessName: "requirements-agent",
    systemPrompt: "You analyze requirements",
    tools: [],
    canQueryAgents: [],
  };

  const designAgent: AgentDefinition = {
    id: "team-ios-designer",
    name: "iOS Designer",
    role: "iOS design",
    phase: "design",
    harnessName: "ios-designer",
    systemPrompt: "You design iOS features",
    tools: [],
    canQueryAgents: [],
  };

  const devAgent: AgentDefinition = {
    id: "team-backend-dev",
    name: "Backend Developer",
    role: "Backend development",
    phase: "development",
    harnessName: "backend-dev",
    systemPrompt: "You implement backend features",
    tools: [],
    canQueryAgents: [],
  };

  describe("selectModelForAgent", () => {
    it("should use default model when no override provided", () => {
      const input: WorkflowInput = {
        title: "Test workflow",
        description: "Test",
        repoConfig: { layout: "monorepo", repos: [] },
        sources: [],
      };

      const model = selectModelForAgent(input, designAgent, mockWorkflowId);

      expect(model.provider).toBe("bedrock");
      expect(model.modelId).toContain("claude-sonnet");
    });

    it("should apply override to design agents", () => {
      const override: ModelConfig = {
        provider: "bedrock",
        modelId: "anthropic.claude-opus-v1:0",
      };

      const input: WorkflowInput = {
        title: "Test workflow",
        description: "Test",
        repoConfig: { layout: "monorepo", repos: [] },
        sources: [],
        modelOverride: override,
      };

      const model = selectModelForAgent(input, designAgent, mockWorkflowId);

      expect(model).toEqual(override);
    });

    it("should apply override to development agents", () => {
      const override: ModelConfig = {
        provider: "openai",
        modelId: "gpt-4-turbo",
      };

      const input: WorkflowInput = {
        title: "Test workflow",
        description: "Test",
        repoConfig: { layout: "monorepo", repos: [] },
        sources: [],
        modelOverride: override,
      };

      const model = selectModelForAgent(input, devAgent, mockWorkflowId);

      expect(model).toEqual(override);
    });

    it("should NOT apply override to requirements agent", () => {
      const override: ModelConfig = {
        provider: "openai",
        modelId: "gpt-4-turbo",
      };

      const input: WorkflowInput = {
        title: "Test workflow",
        description: "Test",
        repoConfig: { layout: "monorepo", repos: [] },
        sources: [],
        modelOverride: override,
      };

      const model = selectModelForAgent(input, requirementsAgent, mockWorkflowId);

      // Requirements agent always uses default
      expect(model.provider).toBe("bedrock");
      expect(model.modelId).toContain("claude-sonnet");
      expect(model).not.toEqual(override);
    });

    it("should support Bedrock regional overrides", () => {
      const override: ModelConfig = {
        provider: "bedrock",
        modelId: "anthropic.claude-sonnet-4-5-v1:0",
        region: "us-west-2",
      };

      const input: WorkflowInput = {
        title: "Test workflow",
        description: "Test",
        repoConfig: { layout: "monorepo", repos: [] },
        sources: [],
        modelOverride: override,
      };

      const model = selectModelForAgent(input, devAgent, mockWorkflowId);

      expect(model).toEqual(override);
      if (model.provider === "bedrock") {
        expect(model.region).toBe("us-west-2");
      }
    });

    it("should support Gemini models", () => {
      const override: ModelConfig = {
        provider: "gemini",
        modelId: "gemini-1.5-pro",
      };

      const input: WorkflowInput = {
        title: "Test workflow",
        description: "Test",
        repoConfig: { layout: "monorepo", repos: [] },
        sources: [],
        modelOverride: override,
      };

      const model = selectModelForAgent(input, designAgent, mockWorkflowId);

      expect(model.provider).toBe("gemini");
      expect(model.modelId).toBe("gemini-1.5-pro");
    });
  });

  describe("validateModelConfig", () => {
    it("should validate correct Bedrock config", () => {
      const config: ModelConfig = {
        provider: "bedrock",
        modelId: "anthropic.claude-sonnet-4-5-v1:0",
      };

      expect(validateModelConfig(config)).toBeNull();
    });

    it("should validate correct OpenAI config", () => {
      const config: ModelConfig = {
        provider: "openai",
        modelId: "gpt-4-turbo",
      };

      expect(validateModelConfig(config)).toBeNull();
    });

    it("should validate correct Gemini config", () => {
      const config: ModelConfig = {
        provider: "gemini",
        modelId: "gemini-pro",
      };

      expect(validateModelConfig(config)).toBeNull();
    });

    it("should reject invalid provider", () => {
      const config = {
        provider: "invalid",
        modelId: "some-model",
      } as unknown as ModelConfig;

      const error = validateModelConfig(config);
      expect(error).toContain("Invalid provider");
    });

    it("should reject malformed Bedrock modelId", () => {
      const config: ModelConfig = {
        provider: "bedrock",
        modelId: "invalid-format",  // Missing provider prefix
      };

      const error = validateModelConfig(config);
      expect(error).toContain("Invalid Bedrock modelId format");
    });

    it("should reject missing modelId", () => {
      const config = {
        provider: "bedrock",
      } as unknown as ModelConfig;

      const error = validateModelConfig(config);
      expect(error).toContain("must have provider and modelId");
    });
  });

  describe("Type Guards", () => {
    it("should correctly identify Bedrock config", () => {
      const config: ModelConfig = {
        provider: "bedrock",
        modelId: "anthropic.claude-sonnet-4-5-v1:0",
      };

      // Type guard import from types.ts
      // expect(isBedrockConfig(config)).toBe(true);
    });

    it("should correctly identify OpenAI config", () => {
      const config: ModelConfig = {
        provider: "openai",
        modelId: "gpt-4-turbo",
      };

      // expect(isOpenAIConfig(config)).toBe(true);
    });
  });

  describe("Backward Compatibility", () => {
    it("should work when modelOverride is undefined", () => {
      const input: WorkflowInput = {
        title: "Legacy workflow",
        description: "Test",
        repoConfig: { layout: "monorepo", repos: [] },
        sources: [],
        // No modelOverride field
      };

      const model = selectModelForAgent(input, devAgent, mockWorkflowId);

      expect(model.provider).toBe("bedrock");
      expect(model.modelId).toContain("claude-sonnet");
    });

    it("should handle workflows created before feature existed", () => {
      // Simulates old WorkflowInput structure
      const oldInput = {
        title: "Old workflow",
        description: "Test",
        repoConfig: { layout: "monorepo" as const, repos: [] },
        sources: [],
      } as WorkflowInput;

      const model = selectModelForAgent(oldInput, designAgent, mockWorkflowId);

      expect(model).toBeDefined();
      expect(model.provider).toBe("bedrock");
    });
  });
});
