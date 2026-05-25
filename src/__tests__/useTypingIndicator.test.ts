import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';

describe('useTypingIndicator', () => {
  const mockSend = vi.fn();
  const defaultOptions = {
    chatId: 'chat-1',
    userId: 'local-user',
    userName: 'You',
    send: mockSend,
    enabled: true,
  };

  beforeEach(() => {
    vi.useFakeTimers();
    mockSend.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with empty typing users', () => {
    const { result } = renderHook(() => useTypingIndicator(defaultOptions));
    expect(result.current.typingUsers).toEqual([]);
    expect(result.current.isAnyoneTyping).toBe(false);
  });

  it('adds a user on typing_start message', () => {
    const { result } = renderHook(() => useTypingIndicator(defaultOptions));

    act(() => {
      result.current.handleIncomingMessage({
        type: 'typing_start',
        userId: 'user-1',
        chatId: 'chat-1',
        timestamp: Date.now(),
      });
    });

    expect(result.current.typingUsers).toHaveLength(1);
    expect(result.current.typingUsers[0].userId).toBe('user-1');
    expect(result.current.isAnyoneTyping).toBe(true);
  });

  it('removes a user on typing_stop message', () => {
    const { result } = renderHook(() => useTypingIndicator(defaultOptions));

    act(() => {
      result.current.handleIncomingMessage({
        type: 'typing_start',
        userId: 'user-1',
        chatId: 'chat-1',
        timestamp: Date.now(),
      });
    });

    act(() => {
      result.current.handleIncomingMessage({
        type: 'typing_stop',
        userId: 'user-1',
        chatId: 'chat-1',
        timestamp: Date.now(),
      });
    });

    expect(result.current.typingUsers).toHaveLength(0);
    expect(result.current.isAnyoneTyping).toBe(false);
  });

  it('removes user after 3s timeout', () => {
    const { result } = renderHook(() => useTypingIndicator(defaultOptions));

    act(() => {
      result.current.handleIncomingMessage({
        type: 'typing_start',
        userId: 'user-1',
        chatId: 'chat-1',
        timestamp: Date.now(),
      });
    });

    expect(result.current.typingUsers).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current.typingUsers).toHaveLength(0);
  });

  it('throttles sendTypingStart to at most once per 2s', () => {
    const { result } = renderHook(() => useTypingIndicator(defaultOptions));

    act(() => {
      result.current.sendTypingStart();
    });
    expect(mockSend).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.sendTypingStart();
    });
    expect(mockSend).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    act(() => {
      result.current.sendTypingStart();
    });
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it('sendTypingStop sends immediately', () => {
    const { result } = renderHook(() => useTypingIndicator(defaultOptions));

    act(() => {
      result.current.sendTypingStop();
    });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'typing_stop', userId: 'local-user', chatId: 'chat-1' })
    );
  });

  it('manages multiple typing users', () => {
    const { result } = renderHook(() => useTypingIndicator(defaultOptions));

    act(() => {
      result.current.handleIncomingMessage({
        type: 'typing_start',
        userId: 'user-1',
        chatId: 'chat-1',
        timestamp: Date.now(),
      });
      result.current.handleIncomingMessage({
        type: 'typing_start',
        userId: 'user-2',
        chatId: 'chat-1',
        timestamp: Date.now(),
      });
    });

    expect(result.current.typingUsers).toHaveLength(2);

    act(() => {
      result.current.clearUser('user-1');
    });

    expect(result.current.typingUsers).toHaveLength(1);
    expect(result.current.typingUsers[0].userId).toBe('user-2');
  });

  it('ignores messages from other chats', () => {
    const { result } = renderHook(() => useTypingIndicator(defaultOptions));

    act(() => {
      result.current.handleIncomingMessage({
        type: 'typing_start',
        userId: 'user-1',
        chatId: 'other-chat',
        timestamp: Date.now(),
      });
    });

    expect(result.current.typingUsers).toHaveLength(0);
  });

  it('ignores messages from self', () => {
    const { result } = renderHook(() => useTypingIndicator(defaultOptions));

    act(() => {
      result.current.handleIncomingMessage({
        type: 'typing_start',
        userId: 'local-user',
        chatId: 'chat-1',
        timestamp: Date.now(),
      });
    });

    expect(result.current.typingUsers).toHaveLength(0);
  });
});
