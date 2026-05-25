import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWebSocket } from '@/hooks/useWebSocket';

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  url: string;
  readyState = WebSocket.CONNECTING;
  onopen: ((ev: Event) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  sentMessages: string[] = [];

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(data: string) {
    this.sentMessages.push(data);
  }

  close() {
    this.readyState = WebSocket.CLOSED;
  }

  simulateOpen() {
    this.readyState = WebSocket.OPEN;
    this.onopen?.(new Event('open'));
  }

  simulateMessage(data: Record<string, unknown>) {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(data) }));
  }

  simulateClose() {
    this.readyState = WebSocket.CLOSED;
    this.onclose?.(new CloseEvent('close'));
  }
}

describe('useWebSocket', () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.stubGlobal('WebSocket', MockWebSocket);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('starts disconnected when not enabled', () => {
    const { result } = renderHook(() => useWebSocket({ enabled: false, url: 'ws://test' }));
    expect(result.current.connectionState).toBe('disconnected');
    expect(result.current.isConnected).toBe(false);
    expect(MockWebSocket.instances).toHaveLength(0);
  });

  it('starts disconnected when no url provided', () => {
    const { result } = renderHook(() => useWebSocket({ enabled: true }));
    expect(result.current.connectionState).toBe('disconnected');
    expect(MockWebSocket.instances).toHaveLength(0);
  });

  it('connects and transitions to connected state', () => {
    const { result } = renderHook(() => useWebSocket({ url: 'ws://test', enabled: true }));
    expect(result.current.connectionState).toBe('connecting');

    act(() => {
      MockWebSocket.instances[0].simulateOpen();
    });

    expect(result.current.connectionState).toBe('connected');
    expect(result.current.isConnected).toBe(true);
  });

  it('receives messages and calls onMessage', () => {
    const onMessage = vi.fn();
    const { result } = renderHook(() => useWebSocket({ url: 'ws://test', onMessage }));

    act(() => {
      MockWebSocket.instances[0].simulateOpen();
    });

    act(() => {
      MockWebSocket.instances[0].simulateMessage({ type: 'test', payload: 'hello' });
    });

    expect(onMessage).toHaveBeenCalledWith({ type: 'test', payload: 'hello' });
    expect(result.current.lastMessage).toEqual({ type: 'test', payload: 'hello' });
  });

  it('sends data when connected', () => {
    const { result } = renderHook(() => useWebSocket({ url: 'ws://test' }));

    act(() => {
      MockWebSocket.instances[0].simulateOpen();
    });

    act(() => {
      result.current.send({ type: 'ping' });
    });

    expect(MockWebSocket.instances[0].sentMessages).toEqual([JSON.stringify({ type: 'ping' })]);
  });

  it('reconnects with exponential backoff on close', () => {
    renderHook(() => useWebSocket({ url: 'ws://test' }));
    const firstWs = MockWebSocket.instances[0];

    act(() => {
      firstWs.simulateOpen();
    });

    act(() => {
      firstWs.simulateClose();
    });

    expect(MockWebSocket.instances).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(MockWebSocket.instances).toHaveLength(2);

    act(() => {
      MockWebSocket.instances[1].simulateClose();
    });

    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(MockWebSocket.instances).toHaveLength(2);

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(MockWebSocket.instances).toHaveLength(3);
  });

  it('cleans up on unmount', () => {
    const { unmount } = renderHook(() => useWebSocket({ url: 'ws://test' }));

    act(() => {
      MockWebSocket.instances[0].simulateOpen();
    });

    const ws = MockWebSocket.instances[0];
    unmount();

    expect(ws.readyState).toBe(WebSocket.CLOSED);
  });
});
