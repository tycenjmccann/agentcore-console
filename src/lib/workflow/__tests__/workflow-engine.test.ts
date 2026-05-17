/**
 * Integration Tests for Model Configuration in Workflow Engine
 */

import { describe, it, expect } from '@jest/globals';
import {
  shouldReceiveModelOverride,
  getModelConfigForAgent,
  validateModelConfig,
  modelConfigToInvokeParams,
  extractModelConfigFromInput,
  createModelSelectionLog,
} from '../workflow-engine';
import { ModelConfig } from '../types';

describe('Workflow Engine - Model Configuration', () => {
  describe('shouldReceiveModelOverride', () => {
    it('returns true for dev agents', () => {
      expect(shouldReceiveModelOverride('team-backend-dev')).toBe(true);
      expect(shouldReceiveModelOverride('team-api-dev')).toBe(true);
      expect(shouldReceiveModelOverride('team-frontend-dev')).toBe(true);
    });

    it('returns false for system agents', () => {
      expect(shouldReceiveModelOverride('team-requirements')).toBe(false);
      expect(shouldReceiveModelOverride('team-ios-designer')).toBe(false);
      expect(shouldReceiveModelOverride('team-backend-designer')).toBe(false);
    });
  });

  describe('validateModelConfig', () => {
    it('accepts valid configs for all providers', () => {
      expect(validateModelConfig({ provider: 'bedrock', modelId: 'claude-3' })).toBeNull();
      expect(validateModelConfig({ provider: 'openai', modelId: 'gpt-4' })).toBeNull();
      expect(validateModelConfig({ provider: 'gemini', modelId: 'gemini-pro' })).toBeNull();
    });

    it('rejects invalid configs', () => {
      expect(validateModelConfig(null)).toContain('must be an object');
      expect(validateModelConfig({ modelId: 'test' })).toContain('must have a provider');
      expect(validateModelConfig({ provider: 'invalid', modelId: 'test' })).toContain('Invalid provider');
      expect(validateModelConfig({ provider: 'bedrock' })).toContain('must have a modelId');
    });
  });

  describe('modelConfigToInvokeParams', () => {
    it('converts all providers correctly', () => {
      const bedrock: ModelConfig = { provider: 'bedrock', modelId: 'claude-opus-4' };
      const bedrockParams = modelConfigToInvokeParams(bedrock);
      expect(bedrockParams.modelProvider).toBe('bedrock');
      expect(bedrockParams.modelOverride).toHaveProperty('bedrockModelConfig');

      const openai: ModelConfig = { provider: 'openai', modelId: 'gpt-4-turbo' };
      const openaiParams = modelConfigToInvokeParams(openai);
      expect(openaiParams.modelProvider).toBe('openai');
      expect(openaiParams.modelOverride).toHaveProperty('openAiModelConfig');

      const gemini: ModelConfig = { provider: 'gemini', modelId: 'gemini-pro' };
      const geminiParams = modelConfigToInvokeParams(gemini);
      expect(geminiParams.modelProvider).toBe('gemini');
      expect(geminiParams.modelOverride).toHaveProperty('geminiModelConfig');
    });
  });

  describe('Integration: Workflow Model Override', () => {
    it('workflow without modelConfig uses default', () => {
      const input = { title: 'Test', description: 'Test', repoConfig: { layout: 'monorepo' as const, repos: [] }, sources: [] };
      const config = extractModelConfigFromInput(input);
      expect(config).toBeUndefined();
      
      const devConfig = getModelConfigForAgent('team-backend-dev', config);
      expect(devConfig.provider).toBe('bedrock');
    });

    it('workflow with modelConfig applies to dev agents only', () => {
      const custom: ModelConfig = { provider: 'openai', modelId: 'gpt-4-turbo' };
      const input = { modelConfig: custom };
      const config = extractModelConfigFromInput(input);
      
      const devConfig = getModelConfigForAgent('team-backend-dev', config);
      expect(devConfig).toEqual(custom);
      
      const systemConfig = getModelConfigForAgent('team-ios-designer', config);
      expect(systemConfig.provider).toBe('bedrock');
    });
  });
});
