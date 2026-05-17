/**
 * Integration tests for model override in invokeHarnessAgent
 * Tests TEAM-86: Model override propagation to harness invocations
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { invokeHarnessAgent, DEFAULT_MODEL_ID } from "../agentcore-sdk";
import type { ModelConfig } from "../workflow/types";

// Mock the AWS SDK clients
vi.mock("@aws-sdk/client-bedrock-agentcore", () => ({
  BedrockAgentCoreClient: vi.fn(),
  InvokeHarnessCommand: vi.fn(),
}));

describe("invokeHarnessAgent - Model Override", () => {
  const mockHarnessArn = "arn:aws:bedrock-agentcore:us-east-1:123456789012:harness/test-harness";
  const mockSessionId = "test-session-123";
  const mockPrompt = "Test prompt for agent";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should use harness default model when no override provided", async () => {
    // Mock implementation that captures the command input
    let capturedCommandInput: any;
    const { InvokeHarnessCommand } = await import("@aws-sdk/client-bedrock-agentcore");
    
    vi.mocked(InvokeHarnessCommand).mockImplementation((input: any) => {
      capturedCommandInput = input;
      return {} as any;
    });

    await invokeHarnessAgent({
      harnessArn: mockHarnessArn,
      prompt: mockPrompt,
      sessionId: mockSessionId,
    });

    // Verify no model field was added to command input
    expect(capturedCommandInput).toBeDefined();
    expect(capturedCommandInput.model).toBeUndefined();
  });

  it("should apply Bedrock model override when provided", async () => {
    const bedrockConfig: ModelConfig = {
      provider: "bedrock",
      modelId: "anthropic.claude-opus-v1:0",
      region: "us-west-2",
    };

    let capturedCommandInput: any;
    const { InvokeHarnessCommand } = await import("@aws-sdk/client-bedrock-agentcore");
    
    vi.mocked(InvokeHarnessCommand).mockImplementation((input: any) => {
      capturedCommandInput = input;
      return {} as any;
    });

    await invokeHarnessAgent({
      harnessArn: mockHarnessArn,
      prompt: mockPrompt,
      sessionId: mockSessionId,
      modelConfig: bedrockConfig,
    });

    // Verify model override was applied
    expect(capturedCommandInput.model).toBeDefined();
    expect(capturedCommandInput.model.bedrockModelConfig).toEqual({
      modelId: "anthropic.claude-opus-v1:0",
      region: "us-west-2",
    });
  });

  it("should use default region when Bedrock config has no region", async () => {
    const bedrockConfig: ModelConfig = {
      provider: "bedrock",
      modelId: "anthropic.claude-sonnet-4-5-v1:0",
    };

    let capturedCommandInput: any;
    const { InvokeHarnessCommand } = await import("@aws-sdk/client-bedrock-agentcore");
    
    vi.mocked(InvokeHarnessCommand).mockImplementation((input: any) => {
      capturedCommandInput = input;
      return {} as any;
    });

    await invokeHarnessAgent({
      harnessArn: mockHarnessArn,
      prompt: mockPrompt,
      sessionId: mockSessionId,
      modelConfig: bedrockConfig,
      region: "eu-west-1",
    });

    // Should use the region from params
    expect(capturedCommandInput.model.bedrockModelConfig.region).toBe("eu-west-1");
  });

  it("should warn and skip non-Bedrock providers", async () => {
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    
    const openaiConfig: ModelConfig = {
      provider: "openai",
      modelId: "gpt-4-turbo",
    };

    let capturedCommandInput: any;
    const { InvokeHarnessCommand } = await import("@aws-sdk/client-bedrock-agentcore");
    
    vi.mocked(InvokeHarnessCommand).mockImplementation((input: any) => {
      capturedCommandInput = input;
      return {} as any;
    });

    await invokeHarnessAgent({
      harnessArn: mockHarnessArn,
      prompt: mockPrompt,
      sessionId: mockSessionId,
      modelConfig: openaiConfig,
    });

    // Should not apply model override
    expect(capturedCommandInput.model).toBeUndefined();
    
    // Should log warning
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Non-Bedrock model providers")
    );
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining("openai")
    );

    consoleWarnSpy.mockRestore();
  });

  it("should log model selection when override applied", async () => {
    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    
    const bedrockConfig: ModelConfig = {
      provider: "bedrock",
      modelId: "anthropic.claude-opus-v1:0",
    };

    const { InvokeHarnessCommand } = await import("@aws-sdk/client-bedrock-agentcore");
    vi.mocked(InvokeHarnessCommand).mockImplementation(() => ({} as any));

    await invokeHarnessAgent({
      harnessArn: mockHarnessArn,
      prompt: mockPrompt,
      sessionId: mockSessionId,
      modelConfig: bedrockConfig,
    });

    // Should log model selection
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("[ModelOverride]")
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("anthropic.claude-opus-v1:0")
    );

    consoleLogSpy.mockRestore();
  });

  it("should handle all Bedrock model formats", async () => {
    const models = [
      "anthropic.claude-sonnet-4-5-v1:0",
      "anthropic.claude-opus-v1:0",
      "global.anthropic.claude-sonnet-4-5-20250929-v1:0",
    ];

    for (const modelId of models) {
      let capturedCommandInput: any;
      const { InvokeHarnessCommand } = await import("@aws-sdk/client-bedrock-agentcore");
      
      vi.mocked(InvokeHarnessCommand).mockImplementation((input: any) => {
        capturedCommandInput = input;
        return {} as any;
      });

      await invokeHarnessAgent({
        harnessArn: mockHarnessArn,
        prompt: mockPrompt,
        sessionId: mockSessionId,
        modelConfig: {
          provider: "bedrock",
          modelId,
        },
      });

      expect(capturedCommandInput.model.bedrockModelConfig.modelId).toBe(modelId);
    }
  });

  it("should preserve other command inputs when applying model override", async () => {
    const bedrockConfig: ModelConfig = {
      provider: "bedrock",
      modelId: "anthropic.claude-opus-v1:0",
    };

    const systemPrompt = "You are a helpful assistant.";
    const history = [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there!" },
    ];

    let capturedCommandInput: any;
    const { InvokeHarnessCommand } = await import("@aws-sdk/client-bedrock-agentcore");
    
    vi.mocked(InvokeHarnessCommand).mockImplementation((input: any) => {
      capturedCommandInput = input;
      return {} as any;
    });

    await invokeHarnessAgent({
      harnessArn: mockHarnessArn,
      prompt: mockPrompt,
      sessionId: mockSessionId,
      systemPrompt,
      history,
      modelConfig: bedrockConfig,
    });

    // Verify all fields preserved
    expect(capturedCommandInput.harnessArn).toBe(mockHarnessArn);
    expect(capturedCommandInput.runtimeSessionId).toBe(mockSessionId);
    expect(capturedCommandInput.system).toEqual([{ text: systemPrompt }]);
    expect(capturedCommandInput.messages).toHaveLength(3); // 2 history + 1 new
    expect(capturedCommandInput.model).toBeDefined();
  });
});
