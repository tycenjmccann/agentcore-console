'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

export interface WebSocketMessage {
  type: string;
  [key: string]: unknown;
}

interface UseWebSocketOptions {
  url?: string;
  onMessage?: (msg: WebSocketMessage) => void;
  enabled?: boolean;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  send: (data: WebSocketMessage) => void;
  lastMessage: WebSocketMessage | null;
  connectionState: ConnectionState;
}

export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const { url, onMessage, enabled = true } = options;
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelayRef = useRef(1000);
  const mountedRef = useRef(true);
  const onMessageRef = useRef(onMessage);

  onMessageRef.current = onMessage;

  const resolvedUrl = url || process.env.NEXT_PUBLIC_WS_URL || '';

  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!resolvedUrl || !enabled || !mountedRef.current) return;

    cleanup();
    setConnectionState('connecting');

    try {
      const ws = new WebSocket(resolvedUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        setConnectionState('connected');
        reconnectDelayRef.current = 1000;
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const data = JSON.parse(event.data) as WebSocketMessage;
          setLastMessage(data);
          onMessageRef.current?.(data);
        } catch {
          // Ignore non-JSON messages
        }
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        wsRef.current = null;
        setConnectionState('reconnecting');
        const delay = reconnectDelayRef.current;
        reconnectDelayRef.current = Math.min(delay * 2, 5000);
        reconnectTimeoutRef.current = setTimeout(() => {
          if (mountedRef.current) connect();
        }, delay);
      };

      ws.onerror = () => {
        // onclose will fire after onerror, triggering reconnection
      };
    } catch {
      if (!mountedRef.current) return;
      setConnectionState('disconnected');
    }
  }, [resolvedUrl, enabled, cleanup]);

  useEffect(() => {
    mountedRef.current = true;
    if (resolvedUrl && enabled) {
      connect();
    } else {
      setConnectionState('disconnected');
    }
    return () => {
      mountedRef.current = false;
      cleanup();
      setConnectionState('disconnected');
    };
  }, [resolvedUrl, enabled, connect, cleanup]);

  const send = useCallback((data: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  return {
    isConnected: connectionState === 'connected',
    send,
    lastMessage,
    connectionState,
  };
}
