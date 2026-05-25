import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TypingHandler } from '../typing-handler';
import { ConnectionRegistry } from '../connection-registry';
import type { AuthenticatedWebSocket, TypingEvent } from '../types';

function createMockWs(id: string): AuthenticatedWebSocket {
  return {
    id,
    readyState: 1, // OPEN
    send: vi.fn(),
    userId: undefined,
    chatId: undefined,
  } as unknown as AuthenticatedWebSocket;
}

describe('TypingHandler', () => {
  let registry: ConnectionRegistry;
  let handler: TypingHandler;

  beforeEach(() => {
    vi.useFakeTimers();
    registry = new ConnectionRegistry();
    handler = new TypingHandler(registry);
  });

  afterEach(() => {
    handler.cleanup();
    vi.useRealTimers();
  });

  it('should broadcast typing_start to other connections in same chat', () => {
    const ws1 = createMockWs('ws1');
    const ws2 = createMockWs('ws2');
    registry.addConnection('chat1', ws1, 'user1');
    registry.addConnection('chat1', ws2, 'user2');

    const event: TypingEvent = {
      type: 'typing_start',
      userId: 'user1',
      chatId: 'chat1',
      timestamp: Date.now(),
    };
    handler.handleTypingEvent(ws1, event);

    expect(ws2.send).toHaveBeenCalledWith(JSON.stringify(event));
    expect(ws1.send).not.toHaveBeenCalled();
  });

  it('should NOT broadcast to sender', () => {
    const ws1 = createMockWs('ws1');
    registry.addConnection('chat1', ws1, 'user1');

    const event: TypingEvent = {
      type: 'typing_start',
      userId: 'user1',
      chatId: 'chat1',
      timestamp: Date.now(),
    };
    handler.handleTypingEvent(ws1, event);

    expect(ws1.send).not.toHaveBeenCalled();
  });

  it('should auto-broadcast typing_stop after 3 seconds of inactivity', () => {
    const ws1 = createMockWs('ws1');
    const ws2 = createMockWs('ws2');
    registry.addConnection('chat1', ws1, 'user1');
    registry.addConnection('chat1', ws2, 'user2');

    const event: TypingEvent = {
      type: 'typing_start',
      userId: 'user1',
      chatId: 'chat1',
      timestamp: Date.now(),
    };
    handler.handleTypingEvent(ws1, event);

    // Clear mock to check for auto-stop
    vi.mocked(ws2.send).mockClear();

    // Advance time by 3 seconds
    vi.advanceTimersByTime(3000);

    expect(ws2.send).toHaveBeenCalledTimes(1);
    const sentMessage = JSON.parse(vi.mocked(ws2.send).mock.calls[0][0] as string);
    expect(sentMessage.type).toBe('typing_stop');
    expect(sentMessage.userId).toBe('user1');
  });

  it('should reset timer on repeated typing_start', () => {
    const ws1 = createMockWs('ws1');
    const ws2 = createMockWs('ws2');
    registry.addConnection('chat1', ws1, 'user1');
    registry.addConnection('chat1', ws2, 'user2');

    const event: TypingEvent = {
      type: 'typing_start',
      userId: 'user1',
      chatId: 'chat1',
      timestamp: Date.now(),
    };

    // Send typing_start
    handler.handleTypingEvent(ws1, event);

    // Advance 2 seconds (not enough to trigger timeout)
    vi.advanceTimersByTime(2000);

    // Send another typing_start (resets timer)
    vi.mocked(ws2.send).mockClear();
    handler.handleTypingEvent(ws1, event);

    // Advance 2 more seconds (4 total from first, but only 2 from second)
    vi.advanceTimersByTime(2000);

    // Should not have received typing_stop yet (timer was reset)
    const calls = vi.mocked(ws2.send).mock.calls;
    const stopMessages = calls.filter(call => {
      const msg = JSON.parse(call[0] as string);
      return msg.type === 'typing_stop';
    });
    expect(stopMessages.length).toBe(0);

    // Advance 1 more second (3 total from reset)
    vi.advanceTimersByTime(1000);

    // Now should have received typing_stop
    const allCalls = vi.mocked(ws2.send).mock.calls;
    const allStopMessages = allCalls.filter(call => {
      const msg = JSON.parse(call[0] as string);
      return msg.type === 'typing_stop';
    });
    expect(allStopMessages.length).toBe(1);
  });

  it('should broadcast typing_stop immediately when client sends it', () => {
    const ws1 = createMockWs('ws1');
    const ws2 = createMockWs('ws2');
    registry.addConnection('chat1', ws1, 'user1');
    registry.addConnection('chat1', ws2, 'user2');

    const stopEvent: TypingEvent = {
      type: 'typing_stop',
      userId: 'user1',
      chatId: 'chat1',
      timestamp: Date.now(),
    };
    handler.handleTypingEvent(ws1, stopEvent);

    expect(ws2.send).toHaveBeenCalledWith(JSON.stringify(stopEvent));
  });

  it('should clean up and broadcast stop on connection close', () => {
    const ws1 = createMockWs('ws1');
    const ws2 = createMockWs('ws2');
    registry.addConnection('chat1', ws1, 'user1');
    registry.addConnection('chat1', ws2, 'user2');

    // Start typing
    handler.handleTypingEvent(ws1, {
      type: 'typing_start',
      userId: 'user1',
      chatId: 'chat1',
      timestamp: Date.now(),
    });

    vi.mocked(ws2.send).mockClear();

    // Simulate disconnect
    handler.cleanupConnection(ws1);

    expect(ws2.send).toHaveBeenCalledTimes(1);
    const sentMessage = JSON.parse(vi.mocked(ws2.send).mock.calls[0][0] as string);
    expect(sentMessage.type).toBe('typing_stop');
  });

  it('should not broadcast to connections in different chats', () => {
    const ws1 = createMockWs('ws1');
    const ws2 = createMockWs('ws2');
    registry.addConnection('chat1', ws1, 'user1');
    registry.addConnection('chat2', ws2, 'user2');

    handler.handleTypingEvent(ws1, {
      type: 'typing_start',
      userId: 'user1',
      chatId: 'chat1',
      timestamp: Date.now(),
    });

    expect(ws2.send).not.toHaveBeenCalled();
  });
});
