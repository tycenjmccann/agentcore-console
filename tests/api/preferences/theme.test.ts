import { describe, it, expect, beforeEach } from '@jest/globals';

/**
 * Integration tests for Theme Preferences API
 * 
 * Run with: npm test tests/api/preferences/theme.test.ts
 */

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';
const API_ENDPOINT = `${BASE_URL}/api/preferences/theme`;

describe('Theme Preferences API', () => {
  const testSessionId = `test-session-${Date.now()}`;
  
  const fetchWithSession = async (url: string, options: RequestInit = {}) => {
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'x-session-id': testSessionId,
      },
    });
  };
  
  beforeEach(async () => {
    // Reset theme preference before each test
    await fetchWithSession(API_ENDPOINT, { method: 'DELETE' });
  });
  
  describe('GET /api/preferences/theme', () => {
    it('should return system default when no preference is set', async () => {
      const response = await fetchWithSession(API_ENDPOINT);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.theme).toBe('system');
    });
    
    it('should return the previously set theme', async () => {
      // Set theme to dark
      await fetchWithSession(API_ENDPOINT, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: 'dark' }),
      });
      
      // Get theme
      const response = await fetchWithSession(API_ENDPOINT);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.theme).toBe('dark');
    });
  });
  
  describe('PUT /api/preferences/theme', () => {
    it('should set theme to light', async () => {
      const response = await fetchWithSession(API_ENDPOINT, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: 'light' }),
      });
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.theme).toBe('light');
      expect(data.updated).toBe(true);
    });
    
    it('should set theme to dark', async () => {
      const response = await fetchWithSession(API_ENDPOINT, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: 'dark' }),
      });
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.theme).toBe('dark');
      expect(data.updated).toBe(true);
    });
    
    it('should set theme to system', async () => {
      const response = await fetchWithSession(API_ENDPOINT, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: 'system' }),
      });
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.theme).toBe('system');
      expect(data.updated).toBe(true);
    });
    
    it('should reject invalid theme values', async () => {
      const response = await fetchWithSession(API_ENDPOINT, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: 'invalid' }),
      });
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid theme value');
    });
    
    it('should reject empty theme values', async () => {
      const response = await fetchWithSession(API_ENDPOINT, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: '' }),
      });
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid theme value');
    });
    
    it('should reject missing theme field', async () => {
      const response = await fetchWithSession(API_ENDPOINT, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid theme value');
    });
  });
  
  describe('DELETE /api/preferences/theme', () => {
    it('should reset theme to default', async () => {
      // First set a theme
      await fetchWithSession(API_ENDPOINT, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: 'dark' }),
      });
      
      // Delete the theme
      const deleteResponse = await fetchWithSession(API_ENDPOINT, {
        method: 'DELETE',
      });
      const deleteData = await deleteResponse.json();
      
      expect(deleteResponse.status).toBe(200);
      expect(deleteData.deleted).toBe(true);
      
      // Verify it returns to system default
      const getResponse = await fetchWithSession(API_ENDPOINT);
      const getData = await getResponse.json();
      
      expect(getData.theme).toBe('system');
    });
  });
  
  describe('Session Isolation', () => {
    it('should maintain separate preferences per session', async () => {
      const session1 = `test-session-1-${Date.now()}`;
      const session2 = `test-session-2-${Date.now()}`;
      
      // Set light theme for session 1
      await fetch(API_ENDPOINT, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': session1,
        },
        body: JSON.stringify({ theme: 'light' }),
      });
      
      // Set dark theme for session 2
      await fetch(API_ENDPOINT, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': session2,
        },
        body: JSON.stringify({ theme: 'dark' }),
      });
      
      // Verify session 1 still has light
      const response1 = await fetch(API_ENDPOINT, {
        headers: { 'x-session-id': session1 },
      });
      const data1 = await response1.json();
      expect(data1.theme).toBe('light');
      
      // Verify session 2 still has dark
      const response2 = await fetch(API_ENDPOINT, {
        headers: { 'x-session-id': session2 },
      });
      const data2 = await response2.json();
      expect(data2.theme).toBe('dark');
    });
  });
});