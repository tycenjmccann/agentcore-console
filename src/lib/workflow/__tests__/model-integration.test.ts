/**
 * Tests for Model Integration
 */

import {
  getModelOverrideForAgent,
  extractModelConfig,
  logModelInvocation,
} from "../model-integration";
import { setWorkflow, getWorkflow } from "../store";
import { DEFAULT_MODEL } from "../types";
import type { WorkflowState, BedrockModelConfig, OpenAIModelConfig } from "../types";

// Mock the store module
jest.mock("../store", () => ({
  getWorkflow: jest.fn(),
  setWorkflow: jest.fn(),
}));

const mockGetWorkflow = getWorkflow as jest.MockedFunction<typeof getWorkflow>;

describe("getModelOverrideForAgent", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation();
  });

  afterEach(() => {
    (console.log as jest.Mock).mockRestore();
  });

  describe("dev agents with model override", () => {
    const testCases = [
      { agentId: "team-backend-dev", name: "backend dev" },
      { agentId: "team-api-dev", name: "API dev" },
      { agentId: "team-frontend-dev", name: "frontend dev" },
    ];

    testCases.forEach(({ agentId, name }) => {
      it(`should return model override for ${name} with non-default model`, () => {
        const modelConfig: BedrockModelConfig = {
          provider: "bedrock",
          modelId: "anthropic.claude-opus-4",
        };
        mockGetWorkflow.mockReturnValue({
          id: "wf_test",
          modelConfig,
        } as WorkflowState);

        const result = getModelOverrideForAgent("wf_test", agentId);

        expect(result).toBe("anthropic.claude-opus-4");
        expect(console.log).toHaveBeenCalled();
      });

      it(`should return OpenAI format for ${name} with OpenAI model`, () => {
        const modelConfig: OpenAIModelConfig = {
          provider: "openai",
          modelId: "gpt-4-turbo",
        };
        mockGetWorkflow.mockReturnValue({
          id: "wf_test",
          modelConfig,
        } as WorkflowState);

        const result = getModelOverrideForAgent("wf_test", agentId);

        expect(result).toBe("openai:gpt-4-turbo");
      });
    });
  });

  describe("dev agents without model override", () => {
    it("should return undefined when model config is default", () => {
      mockGetWorkflow.mockReturnValue({
        id: "wf_test",
        modelConfig: DEFAULT_MODEL,
      } as WorkflowState);

      const result = getModelOverrideForAgent("wf_test", "team-backend-dev");

      expect(result).toBeUndefined();
    });

    it("should return undefined when no model config", () => {
      mockGetWorkflow.mockReturnValue({
        id: "wf_test",
        modelConfig: undefined,
      } as unknown as WorkflowState);

      const result = getModelOverrideForAgent("wf_test", "team-backend-dev");

      expect(result).toBeUndefined();
    });

    it("should return undefined when workflow not found", () => {
      mockGetWorkflow.mockReturnValue(undefined);

      const result = getModelOverrideForAgent("wf_nonexistent", "team-backend-dev");

      expect(result).toBeUndefined();
    });
  });

  describe("non-dev agents", () => {
    const nonDevAgents = [
      "team-requirements-analyst",
      "team-ios-designer",
      "team-android-designer",
      "team-backend-designer",
      "team-security-reviewer",
      "team-legal-compliance",
      "team-localization",
      "team-analytics-designer",
    ];

    nonDevAgents.forEach((agentId) => {
      it(`should return undefined for ${agentId} even with custom model`, () => {
        const modelConfig: BedrockModelConfig = {
          provider: "bedrock",
          modelId: "anthropic.claude-opus-4",
        };
        mockGetWorkflow.mockReturnValue({
          id: "wf_test",
          modelConfig,
        } as WorkflowState);

        const result = getModelOverrideForAgent("wf_test", agentId);

        expect(result).toBeUndefined();
      });
    });
  });
});

describe("extractModelConfig", () => {
  beforeEach(() => {
    jest.spyOn(console, "log").mockImplementation();
  });

  afterEach(() => {
    (console.log as jest.Mock).mockRestore();
  });

  it("should return provided config when given", () => {
    const config: BedrockModelConfig = {
      provider: "bedrock",
      modelId: "anthropic.claude-opus-4",
    };

    const result = extractModelConfig(config);

    expect(result).toEqual(config);
  });

  it("should return DEFAULT_MODEL when no config provided", () => {
    const result = extractModelConfig(undefined);

    expect(result).toEqual(DEFAULT_MODEL);
  });

  it("should log the model config", () => {
    const config: BedrockModelConfig = {
      provider: "bedrock",
      modelId: "anthropic.claude-opus-4",
    };

    extractModelConfig(config);

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("Workflow model config:")
    );
  });
});

describe("logModelInvocation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation();
  });

  afterEach(() => {
    (console.log as jest.Mock).mockRestore();
  });

  it("should log with model override when provided", () => {
    mockGetWorkflow.mockReturnValue({
      id: "wf_test",
      modelConfig: {
        provider: "bedrock",
        modelId: "anthropic.claude-opus-4",
      },
    } as WorkflowState);

    logModelInvocation("wf_test", "team-backend-dev", "anthropic.claude-opus-4");

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("Model override applied")
    );
  });

  it("should log without override when not provided", () => {
    mockGetWorkflow.mockReturnValue({
      id: "wf_test",
      modelConfig: DEFAULT_MODEL,
    } as WorkflowState);

    logModelInvocation("wf_test", "team-backend-dev", undefined);

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("Using harness default model")
    );
  });
});
