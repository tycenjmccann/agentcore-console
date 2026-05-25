import type { AuthenticatedWebSocket, ConnectionMetadata } from './types';

/**
 * In-memory connection registry keyed by chatId.
 * Tracks all active WebSocket connections grouped by chat room.
 */
export class ConnectionRegistry {
  private connections: Map<string, Set<AuthenticatedWebSocket>> = new Map();
  private metadata: WeakMap<AuthenticatedWebSocket, ConnectionMetadata> = new WeakMap();

  /**
   * Add a connection to a chat room
   */
  addConnection(chatId: string, ws: AuthenticatedWebSocket, userId: string): void {
    if (!this.connections.has(chatId)) {
      this.connections.set(chatId, new Set());
    }
    this.connections.get(chatId)!.add(ws);
    this.metadata.set(ws, { userId, chatId, connectedAt: Date.now() });

    // Store on socket for easy access
    ws.userId = userId;
    ws.chatId = chatId;
  }

  /**
   * Remove a connection from its chat room
   */
  removeConnection(ws: AuthenticatedWebSocket): void {
    const meta = this.metadata.get(ws);
    if (!meta) return;

    const chatConnections = this.connections.get(meta.chatId);
    if (chatConnections) {
      chatConnections.delete(ws);
      if (chatConnections.size === 0) {
        this.connections.delete(meta.chatId);
      }
    }
  }

  /**
   * Get all connections in a chat room
   */
  getConnections(chatId: string): Set<AuthenticatedWebSocket> {
    return this.connections.get(chatId) || new Set();
  }

  /**
   * Get metadata for a connection
   */
  getMetadata(ws: AuthenticatedWebSocket): ConnectionMetadata | undefined {
    return this.metadata.get(ws);
  }

  /**
   * Get total number of active connections across all chats
   */
  getTotalConnectionCount(): number {
    let count = 0;
    for (const connections of this.connections.values()) {
      count += connections.size;
    }
    return count;
  }

  /**
   * Get number of connections in a specific chat
   */
  getConnectionCount(chatId: string): number {
    return this.connections.get(chatId)?.size || 0;
  }

  /**
   * Get all chat IDs with active connections
   */
  getActiveChatIds(): string[] {
    return Array.from(this.connections.keys());
  }
}
