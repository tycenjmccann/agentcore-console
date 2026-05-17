/**
 * Tests for Workflow Engine Model Configuration
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  WorkflowEngine,
  buildModelParameter,
  getWorkflowModelConfig,
  populateApiKeyArns
} from '../src/lib/workflow-engine';
import {
  WorkflowState,
  ModelConfig,
  DEFAULT_MODEL_CONFIG
} from '../src/types/workflow';

describe('buildModelParameter', () => {
  it('should build Bedrock model parameter correctly', () => {
    const config: ModelConfig = {
      provider: 'bedrock',
      modelId: 'test-model',
      displayName: 'Test Model',
      bedrockModelConfig: { modelId: 'test-model' }
    };
    
    const result = buildModelParameter(config);
    
    expect(result).toEqual({
      bedrockModelConfig: { modelId: 'test-model' }
    });
  });
  
  it('should build OpenAI model parameter correctly', () => {
    const config: ModelConfig = {
      provider: 'openai',
      modelId: 'gpt-5.5',
      displayName: 'GPT-5.5',
      openAiModelConfig: {
        modelId: 'gpt-5.5',
        apiKeyArn: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:openai-key'
      }
    };
    
    const result = buildModelParameter(config);
    
    expect(result).toEqual({
      openAiModelConfig: {
        modelId: 'gpt-5.5',
        apiKeyArn: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:openai-key'
      }
    });
  });
  
  it('should build Gemini model parameter correctly', () => {
    const config: ModelConfig = {
      provider: 'gemini',
      modelId: 'gemini-2.5-pro',
      displayName: 'Gemini 2.5 Pro',
      geminiModelConfig: {
        modelId: 'gemini-2.5-pro',
        apiKeyArn: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:gemini-key'
      }
    };
    
    const result = buildModelParameter(config);
    
    expect(result).toEqual({
      geminiModelConfig: {
        modelId: 'gemini-2.5-pro',
        apiKeyArn: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:gemini-key'
      }
    });
  });
  
  it('should throw error for missing provider config', () => {
    const config: any = {
      provider: 'bedrock',
      modelId: 'test-model',
      displayName: 'Test Model'
      // Missing bedrockModelConfig
    };
    
    expect(() => buildModelParameter(config)).toThrow(
      'Bedrock model config missing bedrockModelConfig field'
    );
  });
});

describe('getWorkflowModelConfig', () => {
  it('should return workflow model config when present', () => {
    const customConfig: ModelConfig = {
      provider: 'openai',
      modelId: 'gpt-5.5',
      displayName: 'GPT-5.5',
      openAiModelConfig: {
        modelId: 'gpt-5.5',
        apiKeyArn: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:openai-key'
      }
    };
    
    const workflowState: WorkflowState = {
      workflowId: 'test-workflow',
      status: 'pending',
      requirements: 'Test requirements',
      tickets: [],
      modelConfig: customConfig,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const result = getWorkflowModelConfig(workflowState);
    
    expect(result).toEqual(customConfig);
  });
  
  it('should fallback to default when modelConfig is undefined', () => {
    const workflowState: WorkflowState = {
      workflowId: 'test-workflow',
      status: 'pending',
      requirements: 'Test requirements',
      tickets: [],
      // modelConfig is undefined
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const result = getWorkflowModelConfig(workflowState);
    
    expect(result).toEqual(DEFAULT_MODEL_CONFIG);
    expect(result.provider).toBe('bedrock');
    expect(result.displayName).toBe('Claude Sonnet 4.5');
  });
});

describe('populateApiKeyArns', () => {
  beforeEach(() => {
    // Clear env vars
    delete process.env.OPENAI_API_KEY_ARN;
    delete process.env.GEMINI_API_KEY_ARN;
  });
  
  it('should populate OpenAI API key from environment', () => {
    process.env.OPENAI_API_KEY_ARN = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:openai-key';
    
    const config: ModelConfig = {
      provider: 'openai',
      modelId: 'gpt-5.5',
      displayName: 'GPT-5.5',
      openAiModelConfig: {
        modelId: 'gpt-5.5',
        apiKeyArn: '' // Empty, should be populated
      }
    };
    
    const result = populateApiKeyArns(config);
    
    expect(result.openAiModelConfig?.apiKeyArn).toBe(
      'arn:aws:secretsmanager:us-east-1:123456789012:secret:openai-key'
    );
  });
  
  it('should populate Gemini API key from environment', () => {
    process.env.GEMINI_API_KEY_ARN = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:gemini-key';
    
    const config: ModelConfig = {
      provider: 'gemini',
      modelId: 'gemini-2.5-pro',
      displayName: 'Gemini 2.5 Pro',
      geminiModelConfig: {
        modelId: 'gemini-2.5-pro',
        apiKeyArn: ''
      }
    };
    
    const result = populateApiKeyArns(config);
    
    expect(result.geminiModelConfig?.apiKeyArn).toBe(
      'arn:aws:secretsmanager:us-east-1:123456789012:secret:gemini-key'
    );
  });
  
  it('should not modify Bedrock config', () => {
    const config: ModelConfig = {
      provider: 'bedrock',
      modelId: 'test-model',
      displayName: 'Test Model',
      bedrockModelConfig: { modelId: 'test-model' }
    };
    
    const result = populateApiKeyArns(config);
    
    expect(result).toEqual(config);
  });
  
  it('should throw error if OpenAI key not configured', () => {
    const config: ModelConfig = {
      provider: 'openai',
      modelId: 'gpt-5.5',
      displayName: 'GPT-5.5',
      openAiModelConfig: {
        modelId: 'gpt-5.5',
        apiKeyArn: ''
      }
    };
    
    expect(() => populateApiKeyArns(config)).toThrow(
      'OpenAI model selected but OPENAI_API_KEY_ARN environment variable not set'
    );
  });
  
  it('should throw error if Gemini key not configured', () => {
    const config: ModelConfig = {
      provider: 'gemini',
      modelId: 'gemini-2.5-pro',
      displayName: 'Gemini 2.5 Pro',
      geminiModelConfig: {
        modelId: 'gemini-2.5-pro',
        apiKeyArn: ''
      }
    };
    
    expect(() => populateApiKeyArns(config)).toThrow(
      'Gemini model selected but GEMINI_API_KEY_ARN environment variable not set'
    );
  });
});

describe('WorkflowEngine backward compatibility', () => {
  it('should handle legacy workflows without modelConfig', () => {
    const legacyWorkflow: WorkflowState = {
      workflowId: 'legacy-workflow',
      status: 'pending',
      requirements: 'Legacy requirements',
      tickets: [],
      // No modelConfig field
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Should not throw
    const modelConfig = getWorkflowModelConfig(legacyWorkflow);
    
    expect(modelConfig).toEqual(DEFAULT_MODEL_CONFIG);
  });
});
