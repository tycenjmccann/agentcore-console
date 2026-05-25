import { describe, it, expect, beforeEach } from 'vitest';
import { ConnectionRegistry } from '../connection-registry';
import type { AuthenticatedWebSocket } from '../types';

function createMockWs(id: string): AuthenticatedWebSocket {
  return { id, readyState: 1 } as unknown as AuthenticatedWebSocket;
}

describe('ConnectionRegistry', () => {
  let registry: ConnectionRegistry;

  beforeEach(() => {
    registry = new ConnectionRegistry();
  });

  it('should add a connection to a chat', () => {
    const ws = createMockWs('ws1');
    registry.addConnection('chat1', ws, 'user1');
    expect(registry.getConnectionCount('chat1')).toBe(1);
  });

  it('should track multiple connections in the same chat', () => {
    const ws1 = createMockWs('ws1');
    const ws2 = createMockWs('ws2');
    registry.addConnection('chat1', ws1, 'user1');
    registry.addConnection('chat1', ws2, 'user2');
    expect(registry.getConnectionCount('chat1')).toBe(2);
  });

  it('should remove a connection', () => {
    const ws = createMockWs('ws1');
    registry.addConnection('chat1', ws, 'user1');
    registry.removeConnection(ws);
    expect(registry.getConnectionCount('chat1')).toBe(0);
  });

  it('should clean up empty chats on removal', () => {
    const ws = createMockWs('ws1');
    registry.addConnection('chat1', ws, 'user1');
    registry.removeConnection(ws);
    expect(registry.getActiveChatIds()).not.toContain('chat1');
  });

  it('should return connections for a chat', () => {
    const ws1 = createMockWs('ws1');
    const ws2 = createMockWs('ws2');
    registry.addConnection('chat1', ws1, 'user1');
    registry.addConnection('chat1', ws2, 'user2');
    const connections = registry.getConnections('chat1');
    expect(connections.size).toBe(2);
    expect(connections.has(ws1)).toBe(true);
    expect(connections.has(ws2)).toBe(true);
  });

  it('should return empty set for unknown chat', () => {
    const connections = registry.getConnections('nonexistent');
    expect(connections.size).toBe(0);
  });

  it('should get total connection count', () => {
    registry.addConnection('chat1', createMockWs('ws1'), 'user1');
    registry.addConnection('chat2', createMockWs('ws2'), 'user2');
    registry.addConnection('chat2', createMockWs('ws3'), 'user3');
    expect(registry.getTotalConnectionCount()).toBe(3);
  });

  it('should store and retrieve metadata', () => {
    const ws = createMockWs('ws1');
    registry.addConnection('chat1', ws, 'user1');
    const meta = registry.getMetadata(ws);
    expect(meta?.userId).toBe('user1');
    expect(meta?.chatId).toBe('chat1');
    expect(meta?.connectedAt).toBeGreaterThan(0);
  });
});
