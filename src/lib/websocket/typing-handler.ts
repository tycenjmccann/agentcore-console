import type { AuthenticatedWebSocket, TypingEvent } from './types';
import type { ConnectionRegistry } from './connection-registry';

const TYPING_TIMEOUT_MS = 3000; // 3 seconds

/**
 * Manages typing indicator events with auto-timeout.
 * When a user sends typing_start, it broadcasts to others.
 * If no typing_start is received within 3s, auto-broadcasts typing_stop.
 */
export class TypingHandler {
  private typingTimers: Map<string, NodeJS.Timeout> = new Map();
  private registry: ConnectionRegistry;

  constructor(registry: ConnectionRegistry) {
    this.registry = registry;
  }

  /**
   * Handle an incoming typing event from a client
   */
  handleTypingEvent(ws: AuthenticatedWebSocket, event: TypingEvent): void {
    if (event.type === 'typing_start') {
      this.handleTypingStart(ws, event);
    } else if (event.type === 'typing_stop') {
      this.handleTypingStop(ws, event);
    }
  }

  private handleTypingStart(ws: AuthenticatedWebSocket, event: TypingEvent): void {
    const timerKey = `${event.chatId}:${event.userId}`;

    // Clear existing timer
    this.clearTimer(timerKey);

    // Broadcast typing_start to others
    this.broadcastToOthers(ws, event);

    // Set auto-stop timer (3 seconds)
    const timer = setTimeout(() => {
      this.typingTimers.delete(timerKey);
      const stopEvent: TypingEvent = {
        type: 'typing_stop',
        userId: event.userId,
        chatId: event.chatId,
        timestamp: Date.now(),
      };
      this.broadcastToOthers(ws, stopEvent);
    }, TYPING_TIMEOUT_MS);

    this.typingTimers.set(timerKey, timer);
  }

  private handleTypingStop(ws: AuthenticatedWebSocket, event: TypingEvent): void {
    const timerKey = `${event.chatId}:${event.userId}`;
    this.clearTimer(timerKey);
    this.broadcastToOthers(ws, event);
  }

  /**
   * Broadcast event to all other connections in the same chat
   */
  private broadcastToOthers(sender: AuthenticatedWebSocket, event: TypingEvent): void {
    const connections = this.registry.getConnections(event.chatId);
    const message = JSON.stringify(event);

    for (const conn of connections) {
      if (conn !== sender && conn.readyState === 1) { // WebSocket.OPEN = 1
        conn.send(message);
      }
    }
  }

  /**
   * Clean up timers for a disconnecting user
   */
  cleanupConnection(ws: AuthenticatedWebSocket): void {
    const meta = this.registry.getMetadata(ws);
    if (meta) {
      const timerKey = `${meta.chatId}:${meta.userId}`;
      this.clearTimer(timerKey);

      // Broadcast typing_stop to remaining participants
      const stopEvent: TypingEvent = {
        type: 'typing_stop',
        userId: meta.userId,
        chatId: meta.chatId,
        timestamp: Date.now(),
      };
      const connections = this.registry.getConnections(meta.chatId);
      const message = JSON.stringify(stopEvent);
      for (const conn of connections) {
        if (conn !== ws && conn.readyState === 1) {
          conn.send(message);
        }
      }
    }
  }

  private clearTimer(timerKey: string): void {
    const existing = this.typingTimers.get(timerKey);
    if (existing) {
      clearTimeout(existing);
      this.typingTimers.delete(timerKey);
    }
  }

  /**
   * Clear all timers (for shutdown)
   */
  cleanup(): void {
    for (const timer of this.typingTimers.values()) {
      clearTimeout(timer);
    }
    this.typingTimers.clear();
  }
}
