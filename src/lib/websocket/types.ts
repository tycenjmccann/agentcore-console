import type WebSocket from 'ws';

export interface TypingEvent {
  type: 'typing_start' | 'typing_stop';
  userId: string;
  chatId: string;
  timestamp: number;
}

export interface WebSocketMessage {
  type: string;
  [key: string]: unknown;
}

export interface AuthenticatedWebSocket extends WebSocket {
  isAlive?: boolean;
  userId?: string;
  chatId?: string;
}

export interface ConnectionMetadata {
  userId: string;
  chatId: string;
  connectedAt: number;
}
