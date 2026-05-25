'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { WebSocketMessage } from './useWebSocket';

interface TypingUser {
  userId: string;
  name: string;
}

interface TypingMessage {
  type: 'typing_start' | 'typing_stop';
  userId: string;
  chatId: string;
  timestamp: number;
}

interface UseTypingIndicatorOptions {
  chatId: string;
  userId: string;
  userName: string;
  send: (data: WebSocketMessage) => void;
  enabled?: boolean;
}

interface UseTypingIndicatorReturn {
  typingUsers: TypingUser[];
  isAnyoneTyping: boolean;
  handleIncomingMessage: (msg: WebSocketMessage) => void;
  sendTypingStart: () => void;
  sendTypingStop: () => void;
  clearUser: (userId: string) => void;
}

export function useTypingIndicator(options: UseTypingIndicatorOptions): UseTypingIndicatorReturn {
  const { chatId, userId, userName, send, enabled = true } = options;
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const timeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const lastSentRef = useRef<number>(0);
  const throttleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
      timeoutsRef.current.clear();
      if (throttleTimerRef.current) clearTimeout(throttleTimerRef.current);
    };
  }, []);

  const clearUser = useCallback((uid: string) => {
    const timeout = timeoutsRef.current.get(uid);
    if (timeout) {
      clearTimeout(timeout);
      timeoutsRef.current.delete(uid);
    }
    setTypingUsers((prev) => prev.filter((u) => u.userId !== uid));
  }, []);

  const handleIncomingMessage = useCallback((msg: WebSocketMessage) => {
    if (!enabled) return;

    const typingMsg = msg as unknown as TypingMessage;
    if (typingMsg.chatId !== chatId) return;
    if (typingMsg.userId === userId) return;

    if (typingMsg.type === 'typing_start') {
      setTypingUsers((prev) => {
        const exists = prev.find((u) => u.userId === typingMsg.userId);
        if (!exists) {
          return [...prev, { userId: typingMsg.userId, name: typingMsg.userId }];
        }
        return prev;
      });

      const existingTimeout = timeoutsRef.current.get(typingMsg.userId);
      if (existingTimeout) clearTimeout(existingTimeout);
      const timeout = setTimeout(() => {
        timeoutsRef.current.delete(typingMsg.userId);
        setTypingUsers((prev) => prev.filter((u) => u.userId !== typingMsg.userId));
      }, 3000);
      timeoutsRef.current.set(typingMsg.userId, timeout);
    } else if (typingMsg.type === 'typing_stop') {
      clearUser(typingMsg.userId);
    }
  }, [enabled, chatId, userId, clearUser]);

  const sendTypingStart = useCallback(() => {
    if (!enabled) return;
    const now = Date.now();
    if (now - lastSentRef.current < 2000) return;
    lastSentRef.current = now;
    send({
      type: 'typing_start',
      userId,
      userName,
      chatId,
      timestamp: now,
    });
  }, [enabled, send, userId, userName, chatId]);

  const sendTypingStop = useCallback(() => {
    if (!enabled) return;
    lastSentRef.current = 0;
    if (throttleTimerRef.current) {
      clearTimeout(throttleTimerRef.current);
      throttleTimerRef.current = null;
    }
    send({
      type: 'typing_stop',
      userId,
      userName,
      chatId,
      timestamp: Date.now(),
    });
  }, [enabled, send, userId, userName, chatId]);

  return {
    typingUsers,
    isAnyoneTyping: typingUsers.length > 0,
    handleIncomingMessage,
    sendTypingStart,
    sendTypingStop,
    clearUser,
  };
}
