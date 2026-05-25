import { describe, it, expect } from 'vitest';
import { authenticateUpgrade, extractChatId } from '../auth';
import type { IncomingMessage } from 'http';

function createMockRequest(url: string, headers: Record<string, string> = {}): IncomingMessage {
  return {
    url,
    headers: { host: 'localhost:3000', ...headers },
  } as unknown as IncomingMessage;
}

describe('authenticateUpgrade', () => {
  it('should authenticate with valid token query param', () => {
    const req = createMockRequest('/api/ws/chat?token=user123:session456&chatId=chat1');
    const result = authenticateUpgrade(req);
    expect(result.authenticated).toBe(true);
    expect(result.userId).toBe('user123');
  });

  it('should authenticate with Authorization header (Bearer)', () => {
    const req = createMockRequest('/api/ws/chat?chatId=chat1', {
      authorization: 'Bearer user456:token789',
    });
    const result = authenticateUpgrade(req);
    expect(result.authenticated).toBe(true);
    expect(result.userId).toBe('user456');
  });

  it('should authenticate with raw Authorization header', () => {
    const req = createMockRequest('/api/ws/chat?chatId=chat1', {
      authorization: 'user789:tokenABC',
    });
    const result = authenticateUpgrade(req);
    expect(result.authenticated).toBe(true);
    expect(result.userId).toBe('user789');
  });

  it('should reject missing token', () => {
    const req = createMockRequest('/api/ws/chat?chatId=chat1');
    const result = authenticateUpgrade(req);
    expect(result.authenticated).toBe(false);
    expect(result.error).toContain('Missing');
  });

  it('should reject empty token', () => {
    const req = createMockRequest('/api/ws/chat?token=&chatId=chat1');
    const result = authenticateUpgrade(req);
    expect(result.authenticated).toBe(false);
  });

  it('should reject invalid token format (no colon)', () => {
    const req = createMockRequest('/api/ws/chat?token=invalidtoken&chatId=chat1');
    const result = authenticateUpgrade(req);
    expect(result.authenticated).toBe(false);
    expect(result.error).toContain('Invalid token format');
  });

  it('should reject token with empty userId', () => {
    const req = createMockRequest('/api/ws/chat?token=:session456&chatId=chat1');
    const result = authenticateUpgrade(req);
    expect(result.authenticated).toBe(false);
  });
});

describe('extractChatId', () => {
  it('should extract chatId from query params', () => {
    const req = createMockRequest('/api/ws/chat?token=user:sess&chatId=chat123');
    expect(extractChatId(req)).toBe('chat123');
  });

  it('should return null if chatId is missing', () => {
    const req = createMockRequest('/api/ws/chat?token=user:sess');
    expect(extractChatId(req)).toBeNull();
  });
});
