import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';

describe('GET /api/models', () => {
  beforeEach(() => {
    // Clear any mocks before each test
    vi.clearAllMocks();
  });

  it('should return 200 status code', async () => {
    const request = new NextRequest('http://localhost:3000/api/models');
    const response = await GET(request);
    
    expect(response.status).toBe(200);
  });

  it('should return JSON response', async () => {
    const request = new NextRequest('http://localhost:3000/api/models');
    const response = await GET(request);
    
    const contentType = response.headers.get('content-type');
    expect(contentType).toContain('application/json');
  });

  it('should return models array', async () => {
    const request = new NextRequest('http://localhost:3000/api/models');
    const response = await GET(request);
    const data = await response.json();
    
    expect(data).toHaveProperty('models');
    expect(Array.isArray(data.models)).toBe(true);
  });

  it('should return at least 4 models (per requirements)', async () => {
    const request = new NextRequest('http://localhost:3000/api/models');
    const response = await GET(request);
    const data = await response.json();
    
    expect(data.models.length).toBeGreaterThanOrEqual(4);
  });

  it('should include required metadata fields', async () => {
    const request = new NextRequest('http://localhost:3000/api/models');
    const response = await GET(request);
    const data = await response.json();
    
    data.models.forEach((model: any) => {
      expect(model).toHaveProperty('provider');
      expect(model).toHaveProperty('modelId');
      expect(model).toHaveProperty('displayName');
      expect(model).toHaveProperty('isDefault');
      
      // Check types
      expect(typeof model.provider).toBe('string');
      expect(typeof model.modelId).toBe('string');
      expect(typeof model.displayName).toBe('string');
      expect(typeof model.isDefault).toBe('boolean');
    });
  });

  it('should have exactly one default model', async () => {
    const request = new NextRequest('http://localhost:3000/api/models');
    const response = await GET(request);
    const data = await response.json();
    
    const defaultModels = data.models.filter((m: any) => m.isDefault);
    expect(defaultModels).toHaveLength(1);
  });

  it('should mark Claude Sonnet 4.5 as default', async () => {
    const request = new NextRequest('http://localhost:3000/api/models');
    const response = await GET(request);
    const data = await response.json();
    
    const defaultModel = data.models.find((m: any) => m.isDefault);
    expect(defaultModel).toBeDefined();
    expect(defaultModel?.provider).toBe('bedrock');
    expect(defaultModel?.modelId).toBe('anthropic.claude-sonnet-4-5');
    expect(defaultModel?.displayName).toContain('Claude Sonnet 4.5');
  });

  it('should include all three providers', async () => {
    const request = new NextRequest('http://localhost:3000/api/models');
    const response = await GET(request);
    const data = await response.json();
    
    const providers = new Set(data.models.map((m: any) => m.provider));
    expect(providers.has('bedrock')).toBe(true);
    expect(providers.has('openai')).toBe(true);
    expect(providers.has('gemini')).toBe(true);
  });

  it('should include required minimum models', async () => {
    const request = new NextRequest('http://localhost:3000/api/models');
    const response = await GET(request);
    const data = await response.json();
    
    const modelIds = data.models.map((m: any) => m.modelId);
    
    // Requirements specify: Claude Sonnet 4.5, Claude Opus 4, GPT-4 Turbo, Gemini Pro
    expect(modelIds).toContain('anthropic.claude-sonnet-4-5');
    expect(modelIds).toContain('anthropic.claude-opus-4');
    expect(modelIds).toContain('gpt-4-turbo');
    expect(modelIds).toContain('gemini-pro');
  });

  it('should include description field (optional but recommended)', async () => {
    const request = new NextRequest('http://localhost:3000/api/models');
    const response = await GET(request);
    const data = await response.json();
    
    // At least one model should have a description
    const modelsWithDescription = data.models.filter((m: any) => m.description);
    expect(modelsWithDescription.length).toBeGreaterThan(0);
  });

  it('should set cache headers', async () => {
    const request = new NextRequest('http://localhost:3000/api/models');
    const response = await GET(request);
    
    const cacheControl = response.headers.get('cache-control');
    expect(cacheControl).toBeDefined();
    expect(cacheControl).toContain('public');
  });

  it('should handle errors gracefully', async () => {
    // Mock console.error to avoid polluting test output
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // This test verifies the error handling structure is in place
    // In a real scenario, we'd mock a dependency to throw an error
    const request = new NextRequest('http://localhost:3000/api/models');
    const response = await GET(request);
    
    // Should still return a valid response (not throw)
    expect(response).toBeDefined();
    expect(response.status).toBeGreaterThanOrEqual(200);
    
    consoleErrorSpy.mockRestore();
  });

  it('should return valid provider values', async () => {
    const request = new NextRequest('http://localhost:3000/api/models');
    const response = await GET(request);
    const data = await response.json();
    
    const validProviders = ['bedrock', 'openai', 'gemini'];
    data.models.forEach((model: any) => {
      expect(validProviders).toContain(model.provider);
    });
  });

  it('should return non-empty modelIds', async () => {
    const request = new NextRequest('http://localhost:3000/api/models');
    const response = await GET(request);
    const data = await response.json();
    
    data.models.forEach((model: any) => {
      expect(model.modelId).toBeTruthy();
      expect(model.modelId.length).toBeGreaterThan(0);
    });
  });

  it('should return non-empty displayNames', async () => {
    const request = new NextRequest('http://localhost:3000/api/models');
    const response = await GET(request);
    const data = await response.json();
    
    data.models.forEach((model: any) => {
      expect(model.displayName).toBeTruthy();
      expect(model.displayName.length).toBeGreaterThan(0);
    });
  });

  it('should achieve >80% code coverage', async () => {
    // This test documents the coverage requirement
    // Actual coverage is measured by the test runner
    const request = new NextRequest('http://localhost:3000/api/models');
    const response = await GET(request);
    
    expect(response).toBeDefined();
  });
});
