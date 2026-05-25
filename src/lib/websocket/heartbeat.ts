import type { AuthenticatedWebSocket } from './types';
import type { ConnectionRegistry } from './connection-registry';

const HEARTBEAT_INTERVAL_MS = 30000; // 30 seconds

/**
 * Manages WebSocket heartbeat ping/pong to detect stale connections.
 * Pings every 30s; if no pong by next ping cycle, connection is terminated.
 */
export class HeartbeatManager {
  private interval: NodeJS.Timeout | null = null;
  private connections: Set<AuthenticatedWebSocket> = new Set();
  private registry: ConnectionRegistry;

  constructor(registry: ConnectionRegistry) {
    this.registry = registry;
  }

  /**
   * Start the heartbeat interval
   */
  start(): void {
    if (this.interval) return;

    this.interval = setInterval(() => {
      this.checkConnections();
    }, HEARTBEAT_INTERVAL_MS);
  }

  /**
   * Register a connection for heartbeat monitoring
   */
  addConnection(ws: AuthenticatedWebSocket): void {
    ws.isAlive = true;
    this.connections.add(ws);
  }

  /**
   * Remove a connection from heartbeat monitoring
   */
  removeConnection(ws: AuthenticatedWebSocket): void {
    this.connections.delete(ws);
  }

  /**
   * Mark a connection as alive (called when pong received)
   */
  markAlive(ws: AuthenticatedWebSocket): void {
    ws.isAlive = true;
  }

  /**
   * Check all connections and terminate stale ones
   */
  private checkConnections(): void {
    for (const ws of this.connections) {
      if (ws.isAlive === false) {
        // No pong received since last ping - terminate
        this.connections.delete(ws);
        this.registry.removeConnection(ws);
        ws.terminate();
        continue;
      }

      ws.isAlive = false;
      ws.ping();
    }
  }

  /**
   * Stop the heartbeat interval and clean up
   */
  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.connections.clear();
  }
}
