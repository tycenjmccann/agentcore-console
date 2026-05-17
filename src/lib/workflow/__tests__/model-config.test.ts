/**
 * Unit tests for ModelConfig type system and type guards
 * 
 * Tests the discriminated union types and type guards for model configuration.
 * Run with: npx vitest run src/lib/workflow/__tests__/model-config.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  type ModelConfig,
  type BedrockModelConfig,
  type OpenAIModelConfig,
  type GeminiModelConfig,
  type WorkflowInput,
  DEFAULT_MODEL,
  isBedrockModel,
  isOpenAIModel,
  isGeminiModel,
} from '../types';

describe('ModelConfig Types', () => {
  describe('BedrockModelConfig', () => {
    it('should create a valid Bedrock config', () => {
      const config: BedrockModelConfig = {
        provider: 'bedrock',
        modelId: 'anthropic.claude-sonnet-4-5-v1',
      };
      expect(config.provider).toBe('bedrock');
      expect(config.modelId).toBe('anthropic.claude-sonnet-4-5-v1');
    });

    it('should work with Claude Opus model ID', () => {
      const config: BedrockModelConfig = {
        provider: 'bedrock',
        modelId: 'anthropic.claude-opus-4',
      };
      expect(config.provider).toBe('bedrock');
      expect(config.modelId).toBe('anthropic.claude-opus-4');
    });
  });

  describe('OpenAIModelConfig', () => {
    it('should create a valid OpenAI config without apiKey', () => {
      const config: OpenAIModelConfig = {
        provider: 'openai',
        modelId: 'gpt-4-turbo',
      };
      expect(config.provider).toBe('openai');
      expect(config.modelId).toBe('gpt-4-turbo');
      expect(config.apiKey).toBeUndefined();
    });

    it('should create a valid OpenAI config with apiKey', () => {
      const config: OpenAIModelConfig = {
        provider: 'openai',
        modelId: 'gpt-4',
        apiKey: 'sk-test-key',
      };
      expect(config.provider).toBe('openai');
      expect(config.modelId).toBe('gpt-4');
      expect(config.apiKey).toBe('sk-test-key');
    });
  });

  describe('GeminiModelConfig', () => {
    it('should create a valid Gemini config without apiKey', () => {
      const config: GeminiModelConfig = {
        provider: 'gemini',
        modelId: 'gemini-pro',
      };
      expect(config.provider).toBe('gemini');
      expect(config.modelId).toBe('gemini-pro');
      expect(config.apiKey).toBeUndefined();
    });

    it('should create a valid Gemini config with apiKey', () => {
      const config: GeminiModelConfig = {
        provider: 'gemini',
        modelId: 'gemini-ultra',
        apiKey: 'test-api-key',
      };
      expect(config.provider).toBe('gemini');
      expect(config.modelId).toBe('gemini-ultra');
      expect(config.apiKey).toBe('test-api-key');
    });
  });

  describe('ModelConfig discriminated union', () => {
    it('should accept BedrockModelConfig', () => {
      const config: ModelConfig = {
        provider: 'bedrock',
        modelId: 'anthropic.claude-sonnet-4-5-v1',
      };
      expect(config.provider).toBe('bedrock');
    });

    it('should accept OpenAIModelConfig', () => {
      const config: ModelConfig = {
        provider: 'openai',
        modelId: 'gpt-4-turbo',
      };
      expect(config.provider).toBe('openai');
    });

    it('should accept GeminiModelConfig', () => {
      const config: ModelConfig = {
        provider: 'gemini',
        modelId: 'gemini-pro',
      };
      expect(config.provider).toBe('gemini');
    });

    it('should allow type narrowing with switch statement', () => {
      const configs: ModelConfig[] = [
        { provider: 'bedrock', modelId: 'anthropic.claude-sonnet-4-5-v1' },
        { provider: 'openai', modelId: 'gpt-4-turbo', apiKey: 'test' },
        { provider: 'gemini', modelId: 'gemini-pro' },
      ];

      const results = configs.map((config) => {
        switch (config.provider) {
          case 'bedrock':
            return `Bedrock: ${config.modelId}`;
          case 'openai':
            return `OpenAI: ${config.modelId}`;
          case 'gemini':
            return `Gemini: ${config.modelId}`;
        }
      });

      expect(results).toEqual([
        'Bedrock: anthropic.claude-sonnet-4-5-v1',
        'OpenAI: gpt-4-turbo',
        'Gemini: gemini-pro',
      ]);
    });
  });
});

describe('DEFAULT_MODEL', () => {
  it('should be a Bedrock model', () => {
    expect(DEFAULT_MODEL.provider).toBe('bedrock');
  });

  it('should default to Claude Sonnet 4.5', () => {
    expect(DEFAULT_MODEL.modelId).toBe('anthropic.claude-sonnet-4-5-v1');
  });

  it('should be assignable to ModelConfig', () => {
    const config: ModelConfig = DEFAULT_MODEL;
    expect(config.provider).toBe('bedrock');
  });

  it('should be immutable (as const)', () => {
    // TypeScript ensures this at compile time
    // At runtime we just verify the values are correct
    expect(Object.isFrozen(DEFAULT_MODEL)).toBe(false); // as const doesn't freeze
    expect(DEFAULT_MODEL.provider).toBe('bedrock');
    expect(DEFAULT_MODEL.modelId).toBe('anthropic.claude-sonnet-4-5-v1');
  });
});

describe('Type Guards', () => {
  describe('isBedrockModel', () => {
    it('should return true for Bedrock configs', () => {
      const config: ModelConfig = {
        provider: 'bedrock',
        modelId: 'anthropic.claude-sonnet-4-5-v1',
      };
      expect(isBedrockModel(config)).toBe(true);
    });

    it('should return false for OpenAI configs', () => {
      const config: ModelConfig = {
        provider: 'openai',
        modelId: 'gpt-4-turbo',
      };
      expect(isBedrockModel(config)).toBe(false);
    });

    it('should return false for Gemini configs', () => {
      const config: ModelConfig = {
        provider: 'gemini',
        modelId: 'gemini-pro',
      };
      expect(isBedrockModel(config)).toBe(false);
    });

    it('should narrow type to BedrockModelConfig', () => {
      const config: ModelConfig = {
        provider: 'bedrock',
        modelId: 'anthropic.claude-opus-4',
      };

      if (isBedrockModel(config)) {
        // TypeScript should know config is BedrockModelConfig here
        expect(config.modelId).toBe('anthropic.claude-opus-4');
        // config.apiKey would be a compile error (not available on BedrockModelConfig)
      }
    });
  });

  describe('isOpenAIModel', () => {
    it('should return true for OpenAI configs', () => {
      const config: ModelConfig = {
        provider: 'openai',
        modelId: 'gpt-4-turbo',
      };
      expect(isOpenAIModel(config)).toBe(true);
    });

    it('should return false for Bedrock configs', () => {
      const config: ModelConfig = {
        provider: 'bedrock',
        modelId: 'anthropic.claude-sonnet-4-5-v1',
      };
      expect(isOpenAIModel(config)).toBe(false);
    });

    it('should return false for Gemini configs', () => {
      const config: ModelConfig = {
        provider: 'gemini',
        modelId: 'gemini-pro',
      };
      expect(isOpenAIModel(config)).toBe(false);
    });

    it('should narrow type to OpenAIModelConfig', () => {
      const config: ModelConfig = {
        provider: 'openai',
        modelId: 'gpt-4',
        apiKey: 'sk-test',
      };

      if (isOpenAIModel(config)) {
        // TypeScript should know config is OpenAIModelConfig here
        expect(config.apiKey).toBe('sk-test');
      }
    });
  });

  describe('isGeminiModel', () => {
    it('should return true for Gemini configs', () => {
      const config: ModelConfig = {
        provider: 'gemini',
        modelId: 'gemini-pro',
      };
      expect(isGeminiModel(config)).toBe(true);
    });

    it('should return false for Bedrock configs', () => {
      const config: ModelConfig = {
        provider: 'bedrock',
        modelId: 'anthropic.claude-sonnet-4-5-v1',
      };
      expect(isGeminiModel(config)).toBe(false);
    });

    it('should return false for OpenAI configs', () => {
      const config: ModelConfig = {
        provider: 'openai',
        modelId: 'gpt-4-turbo',
      };
      expect(isGeminiModel(config)).toBe(false);
    });

    it('should narrow type to GeminiModelConfig', () => {
      const config: ModelConfig = {
        provider: 'gemini',
        modelId: 'gemini-ultra',
        apiKey: 'test-key',
      };

      if (isGeminiModel(config)) {
        // TypeScript should know config is GeminiModelConfig here
        expect(config.apiKey).toBe('test-key');
      }
    });
  });

  describe('Type guard exhaustiveness', () => {
    it('should cover all providers with type guards', () => {
      const configs: ModelConfig[] = [
        { provider: 'bedrock', modelId: 'test' },
        { provider: 'openai', modelId: 'test' },
        { provider: 'gemini', modelId: 'test' },
      ];

      for (const config of configs) {
        const isSomeProvider =
          isBedrockModel(config) ||
          isOpenAIModel(config) ||
          isGeminiModel(config);

        expect(isSomeProvider).toBe(true);
      }
    });

    it('should ensure exactly one type guard returns true', () => {
      const configs: ModelConfig[] = [
        { provider: 'bedrock', modelId: 'test' },
        { provider: 'openai', modelId: 'test' },
        { provider: 'gemini', modelId: 'test' },
      ];

      for (const config of configs) {
        const trueCount = [
          isBedrockModel(config),
          isOpenAIModel(config),
          isGeminiModel(config),
        ].filter(Boolean).length;

        expect(trueCount).toBe(1);
      }
    });
  });
});

describe('WorkflowInput with modelConfig', () => {
  const baseInput: Omit<WorkflowInput, 'modelConfig'> = {
    title: 'Test Feature',
    description: 'Test description',
    repoConfig: {
      layout: 'monorepo',
      repos: [
        {
          url: 'https://github.com/test/repo',
          defaultBranch: 'main',
          platform: 'shared',
        },
      ],
    },
    sources: [],
  };

  it('should accept WorkflowInput without modelConfig', () => {
    const input: WorkflowInput = { ...baseInput };
    expect(input.modelConfig).toBeUndefined();
  });

  it('should accept WorkflowInput with Bedrock modelConfig', () => {
    const input: WorkflowInput = {
      ...baseInput,
      modelConfig: {
        provider: 'bedrock',
        modelId: 'anthropic.claude-opus-4',
      },
    };
    expect(input.modelConfig?.provider).toBe('bedrock');
    expect(input.modelConfig?.modelId).toBe('anthropic.claude-opus-4');
  });

  it('should accept WorkflowInput with OpenAI modelConfig', () => {
    const input: WorkflowInput = {
      ...baseInput,
      modelConfig: {
        provider: 'openai',
        modelId: 'gpt-4-turbo',
      },
    };
    expect(input.modelConfig?.provider).toBe('openai');
  });

  it('should accept WorkflowInput with Gemini modelConfig', () => {
    const input: WorkflowInput = {
      ...baseInput,
      modelConfig: {
        provider: 'gemini',
        modelId: 'gemini-pro',
      },
    };
    expect(input.modelConfig?.provider).toBe('gemini');
  });

  it('should accept WorkflowInput with DEFAULT_MODEL', () => {
    const input: WorkflowInput = {
      ...baseInput,
      modelConfig: DEFAULT_MODEL,
    };
    expect(input.modelConfig).toEqual(DEFAULT_MODEL);
  });

  it('should support type narrowing on modelConfig', () => {
    const input: WorkflowInput = {
      ...baseInput,
      modelConfig: {
        provider: 'openai',
        modelId: 'gpt-4',
        apiKey: 'test-key',
      },
    };

    if (input.modelConfig && isOpenAIModel(input.modelConfig)) {
      expect(input.modelConfig.apiKey).toBe('test-key');
    }
  });
});
