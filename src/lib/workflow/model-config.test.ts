import { describe, it, expect } from 'vitest';
import {
  isValidModelConfig,
  isValidModelId,
  validateModelConfig,
  getDefaultModelConfig,
} from './model-config';
import type { ModelConfig } from './types';

describe('ModelConfig Type System', () => {
  describe('isValidModelConfig', () => {
    it('should validate valid Bedrock config', () => {
      const config = { provider: 'bedrock', modelId: 'anthropic.claude-sonnet-4-5' };
      expect(isValidModelConfig(config)).toBe(true);
    });

    it('should validate valid OpenAI config', () => {
      const config = { provider: 'openai', modelId: 'gpt-4-turbo' };
      expect(isValidModelConfig(config)).toBe(true);
    });

    it('should validate valid Gemini config', () => {
      const config = { provider: 'gemini', modelId: 'gemini-pro' };
      expect(isValidModelConfig(config)).toBe(true);
    });

    it('should reject null or undefined', () => {
      expect(isValidModelConfig(null)).toBe(false);
      expect(isValidModelConfig(undefined)).toBe(false);
    });

    it('should reject non-object values', () => {
      expect(isValidModelConfig('string')).toBe(false);
      expect(isValidModelConfig(123)).toBe(false);
      expect(isValidModelConfig(true)).toBe(false);
    });

    it('should reject config missing provider', () => {
      const config = { modelId: 'gpt-4' };
      expect(isValidModelConfig(config)).toBe(false);
    });

    it('should reject config missing modelId', () => {
      const config = { provider: 'openai' };
      expect(isValidModelConfig(config)).toBe(false);
    });

    it('should reject invalid provider', () => {
      const config = { provider: 'invalid-provider', modelId: 'some-model' };
      expect(isValidModelConfig(config)).toBe(false);
    });

    it('should reject empty modelId', () => {
      const config = { provider: 'bedrock', modelId: '' };
      expect(isValidModelConfig(config)).toBe(false);
    });

    it('should reject whitespace-only modelId', () => {
      const config = { provider: 'bedrock', modelId: '   ' };
      expect(isValidModelConfig(config)).toBe(false);
    });
  });

  describe('isValidModelId', () => {
    describe('Bedrock provider', () => {
      it('should validate standard Bedrock model IDs', () => {
        expect(isValidModelId('bedrock', 'anthropic.claude-sonnet-4-5')).toBe(true);
        expect(isValidModelId('bedrock', 'anthropic.claude-opus-4')).toBe(true);
        expect(isValidModelId('bedrock', 'meta.llama3-70b')).toBe(true);
      });

      it('should reject invalid Bedrock model IDs', () => {
        expect(isValidModelId('bedrock', 'invalid')).toBe(false);
        expect(isValidModelId('bedrock', 'gpt-4')).toBe(false);
        expect(isValidModelId('bedrock', '')).toBe(false);
      });
    });

    describe('OpenAI provider', () => {
      it('should validate standard OpenAI model IDs', () => {
        expect(isValidModelId('openai', 'gpt-4')).toBe(true);
        expect(isValidModelId('openai', 'gpt-4-turbo')).toBe(true);
        expect(isValidModelId('openai', 'gpt-3.5-turbo')).toBe(true);
        expect(isValidModelId('openai', 'o1-preview')).toBe(true);
        expect(isValidModelId('openai', 'o1-mini')).toBe(true);
      });

      it('should reject invalid OpenAI model IDs', () => {
        expect(isValidModelId('openai', 'anthropic.claude')).toBe(false);
        expect(isValidModelId('openai', 'gemini-pro')).toBe(false);
        expect(isValidModelId('openai', 'invalid')).toBe(false);
        expect(isValidModelId('openai', '')).toBe(false);
      });
    });

    describe('Gemini provider', () => {
      it('should validate standard Gemini model IDs', () => {
        expect(isValidModelId('gemini', 'gemini-pro')).toBe(true);
        expect(isValidModelId('gemini', 'gemini-1.5-pro')).toBe(true);
        expect(isValidModelId('gemini', 'gemini-ultra')).toBe(true);
      });

      it('should reject invalid Gemini model IDs', () => {
        expect(isValidModelId('gemini', 'gpt-4')).toBe(false);
        expect(isValidModelId('gemini', 'anthropic.claude')).toBe(false);
        expect(isValidModelId('gemini', 'invalid')).toBe(false);
        expect(isValidModelId('gemini', '')).toBe(false);
      });
    });
  });

  describe('validateModelConfig', () => {
    it('should validate complete valid configs', () => {
      const configs: ModelConfig[] = [
        { provider: 'bedrock', modelId: 'anthropic.claude-sonnet-4-5' },
        { provider: 'openai', modelId: 'gpt-4-turbo' },
        { provider: 'gemini', modelId: 'gemini-pro' },
      ];

      configs.forEach(config => {
        const result = validateModelConfig(config);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });
    });

    it('should reject invalid structure', () => {
      const result = validateModelConfig({ invalid: 'config' });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid model configuration structure');
    });

    it('should reject invalid model ID with descriptive error', () => {
      const result = validateModelConfig({
        provider: 'openai',
        modelId: 'anthropic.claude',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid model ID');
      expect(result.error).toContain('anthropic.claude');
      expect(result.error).toContain('openai');
    });
  });

  describe('getDefaultModelConfig', () => {
    it('should return Claude Sonnet 4.5 on Bedrock', () => {
      const config = getDefaultModelConfig();
      expect(config.provider).toBe('bedrock');
      expect(config.modelId).toBe('anthropic.claude-sonnet-4-5');
    });

    it('should return a valid config', () => {
      const config = getDefaultModelConfig();
      expect(isValidModelConfig(config)).toBe(true);
      const validation = validateModelConfig(config);
      expect(validation.valid).toBe(true);
    });
  });

  describe('Discriminated union type checking', () => {
    it('should allow type narrowing based on provider', () => {
      const config: ModelConfig = { provider: 'bedrock', modelId: 'anthropic.claude-sonnet-4-5' };
      
      if (config.provider === 'bedrock') {
        // TypeScript should know this is Bedrock config
        expect(config.modelId).toBe('anthropic.claude-sonnet-4-5');
      }
    });

    it('should handle all provider variants', () => {
      const configs: ModelConfig[] = [
        { provider: 'bedrock', modelId: 'anthropic.claude-sonnet-4-5' },
        { provider: 'openai', modelId: 'gpt-4' },
        { provider: 'gemini', modelId: 'gemini-pro' },
      ];

      configs.forEach(config => {
        switch (config.provider) {
          case 'bedrock':
            expect(config.modelId).toContain('.');
            break;
          case 'openai':
            expect(config.modelId).toMatch(/^(gpt|o1)/);
            break;
          case 'gemini':
            expect(config.modelId).toContain('gemini');
            break;
        }
      });
    });
  });

  describe('Edge cases and validation boundaries', () => {
    it('should handle model IDs with special characters correctly', () => {
      expect(isValidModelId('bedrock', 'anthropic.claude-sonnet-4-5')).toBe(true);
      expect(isValidModelId('openai', 'gpt-3.5-turbo')).toBe(true);
      expect(isValidModelId('gemini', 'gemini-1.5-pro')).toBe(true);
    });

    it('should reject model IDs with invalid format', () => {
      expect(isValidModelId('bedrock', 'no-dot-in-name')).toBe(false);
      expect(isValidModelId('openai', 'not-gpt-model')).toBe(false);
      expect(isValidModelId('gemini', 'not-gemini')).toBe(false);
    });

    it('should handle extra properties gracefully', () => {
      const config = { 
        provider: 'bedrock', 
        modelId: 'anthropic.claude-sonnet-4-5',
        extraProp: 'should-be-ignored' 
      };
      expect(isValidModelConfig(config)).toBe(true);
    });
  });
});
