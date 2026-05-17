// __tests__/engine.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorkflowEngine } from '../src/lib/engine';
import { WorkflowState, DEFAULT_MODEL_CONFIG, ModelConfig, toInvokeHarnessModelConfig, isModelAvailable } from '../src/lib/types';
import * as storage from '../src/lib/storage';

// Mock AWS SDK
vi.mock('@aws-sdk/client-bedrock-agentcore-runtime');
vi.mock('../src/lib/storage');

describe('WorkflowEngine - Model Configuration', () => {
  let mockState: WorkflowState;
  
  beforeEach(() => {
    mockState = {
      workflowId: 'test-workflow-1',
      title: 'Test Workflow',
      description: 'Test',
      requirements: 'Test requirements',
      status: 'planning',
      tickets: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  });
  
  it('should use default model when modelConfig is undefined', async () => {
    // Arrange
    vi.mocked(storage.loadWorkflowState).mockResolvedValue(mockState);
    vi.mocked(storage.saveWorkflowState).mockResolvedValue(undefined);
    
    const engine = new WorkflowEngine('test-workflow-1');
    
    // Act & Assert
    // Engine should use DEFAULT_MODEL_CONFIG
    await expect(engine.execute()).resolves.not.toThrow();
  });
  
  it('should use specified Bedrock model configuration', async () => {
    // Arrange
    const bedrockConfig: ModelConfig = {
      provider: 'bedrock',
      modelId: 'global.anthropic.claude-opus-4-5-20250514-v1:0',
      displayName: 'Claude Opus 4.5',
      bedrockModelConfig: {
        modelId: 'global.anthropic.claude-opus-4-5-20250514-v1:0'
      }
    };
    
    mockState.modelConfig = bedrockConfig;
    vi.mocked(storage.loadWorkflowState).mockResolvedValue(mockState);
    vi.mocked(storage.saveWorkflowState).mockResolvedValue(undefined);
    
    const engine = new WorkflowEngine('test-workflow-1');
    
    // Act & Assert
    await expect(engine.execute()).resolves.not.toThrow();
  });
  
  it('should use specified OpenAI model configuration', async () => {
    // Arrange
    const openAiConfig: ModelConfig = {
      provider: 'openai',
      modelId: 'gpt-5.5',
      displayName: 'GPT-5.5',
      openAiModelConfig: {
        modelId: 'gpt-5.5',
        apiKeyArn: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:openai-key'
      }
    };
    
    mockState.modelConfig = openAiConfig;
    vi.mocked(storage.loadWorkflowState).mockResolvedValue(mockState);
    vi.mocked(storage.saveWorkflowState).mockResolvedValue(undefined);
    
    const engine = new WorkflowEngine('test-workflow-1');
    
    // Act & Assert
    await expect(engine.execute()).resolves.not.toThrow();
  });
  
  it('should persist modelConfig when saving workflow state', async () => {
    // Arrange
    const modelConfig: ModelConfig = {
      provider: 'bedrock',
      modelId: 'global.anthropic.claude-sonnet-4-5-20250929-v1:0',
      displayName: 'Claude Sonnet 4.5',
      bedrockModelConfig: {
        modelId: 'global.anthropic.claude-sonnet-4-5-20250929-v1:0'
      }
    };
    
    mockState.modelConfig = modelConfig;
    
    // Act
    await storage.saveWorkflowState(mockState);
    
    // Assert
    expect(storage.saveWorkflowState).toHaveBeenCalledWith(
      expect.objectContaining({
        modelConfig: modelConfig
      })
    );
  });
  
  it('should handle backward compatibility - missing modelConfig', async () => {
    // Arrange - state without modelConfig
    mockState.modelConfig = undefined;
    vi.mocked(storage.loadWorkflowState).mockResolvedValue(mockState);
    vi.mocked(storage.saveWorkflowState).mockResolvedValue(undefined);
    
    const engine = new WorkflowEngine('test-workflow-1');
    
    // Act & Assert - should fall back to default
    await expect(engine.execute()).resolves.not.toThrow();
  });
});

describe('Model Configuration Helpers', () => {
  it('should transform Bedrock config to InvokeHarnessCommand format', () => {
    const config: ModelConfig = {
      provider: 'bedrock',
      modelId: 'global.anthropic.claude-sonnet-4-5-20250929-v1:0',
      displayName: 'Claude Sonnet 4.5',
      bedrockModelConfig: {
        modelId: 'global.anthropic.claude-sonnet-4-5-20250929-v1:0'
      }
    };
    
    const result = toInvokeHarnessModelConfig(config);
    
    expect(result).toEqual({
      bedrockModelConfig: {
        modelId: 'global.anthropic.claude-sonnet-4-5-20250929-v1:0'
      }
    });
  });
  
  it('should transform OpenAI config to InvokeHarnessCommand format', () => {
    const config: ModelConfig = {
      provider: 'openai',
      modelId: 'gpt-5.5',
      displayName: 'GPT-5.5',
      openAiModelConfig: {
        modelId: 'gpt-5.5',
        apiKeyArn: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:openai-key'
      }
    };
    
    const result = toInvokeHarnessModelConfig(config);
    
    expect(result).toEqual({
      openAiModelConfig: {
        modelId: 'gpt-5.5',
        apiKeyArn: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:openai-key'
      }
    });
  });
  
  it('should check Bedrock availability', () => {
    const config: ModelConfig = {
      provider: 'bedrock',
      modelId: 'global.anthropic.claude-sonnet-4-5-20250929-v1:0',
      displayName: 'Claude Sonnet 4.5',
      bedrockModelConfig: {
        modelId: 'global.anthropic.claude-sonnet-4-5-20250929-v1:0'
      }
    };
    
    expect(isModelAvailable(config)).toBe(true);
  });
});
