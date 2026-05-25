import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { HeartbeatManager } from '../heartbeat';
import { ConnectionRegistry } from '../connection-registry';
import type { AuthenticatedWebSocket } from '../types';

function createMockWs(id: string): AuthenticatedWebSocket {
  return {
    id,
    readyState: 1,
    isAlive: true,
    ping: vi.fn(),
    terminate: vi.fn(),
    send: vi.fn(),
  } as unknown as AuthenticatedWebSocket;
}

describe('HeartbeatManager', () => {
  let registry: ConnectionRegistry;
  let heartbeat: HeartbeatManager;

  beforeEach(() => {
    vi.useFakeTimers();
    registry = new ConnectionRegistry();
    heartbeat = new HeartbeatManager(registry);
  });

  afterEach(() => {
    heartbeat.stop();
    vi.useRealTimers();
  });

  it('should ping connections every 30 seconds', () => {
    const ws = createMockWs('ws1');
    registry.addConnection('chat1', ws, 'user1');
    heartbeat.addConnection(ws);
    heartbeat.start();

    vi.advanceTimersByTime(30000);
    expect(ws.ping).toHaveBeenCalled();
  });

  it('should terminate connections that do not respond to ping', () => {
    const ws = createMockWs('ws1');
    registry.addConnection('chat1', ws, 'user1');
    heartbeat.addConnection(ws);
    heartbeat.start();

    // First ping - sets isAlive to false
    vi.advanceTimersByTime(30000);
    expect(ws.isAlive).toBe(false);

    // Second ping - connection still not alive, should terminate
    vi.advanceTimersByTime(30000);
    expect(ws.terminate).toHaveBeenCalled();
  });

  it('should not terminate connections that respond with pong', () => {
    const ws = createMockWs('ws1');
    registry.addConnection('chat1', ws, 'user1');
    heartbeat.addConnection(ws);
    heartbeat.start();

    // First ping
    vi.advanceTimersByTime(30000);
    expect(ws.isAlive).toBe(false);

    // Simulate pong
    heartbeat.markAlive(ws);
    expect(ws.isAlive).toBe(true);

    // Second ping - should not terminate
    vi.advanceTimersByTime(30000);
    expect(ws.terminate).not.toHaveBeenCalled();
  });

  it('should stop monitoring after stop() is called', () => {
    const ws = createMockWs('ws1');
    heartbeat.addConnection(ws);
    heartbeat.start();
    heartbeat.stop();

    vi.advanceTimersByTime(60000);
    expect(ws.ping).not.toHaveBeenCalled();
  });
});
