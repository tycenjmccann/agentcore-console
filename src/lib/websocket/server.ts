import { WebSocketServer } from 'ws';
import type { Server } from 'http';
import type { IncomingMessage } from 'http';
import type { Duplex } from 'stream';
import { authenticateUpgrade, extractChatId } from './auth';
import { ConnectionRegistry } from './connection-registry';
import { TypingHandler } from './typing-handler';
import { HeartbeatManager } from './heartbeat';
import type { AuthenticatedWebSocket, TypingEvent } from './types';

/**
 * Set up the WebSocket server for typing indicators.
 * Handles upgrade requests at /api/ws/chat path only.
 */
export function setupWebSocketServer(httpServer: Server): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });
  const registry = new ConnectionRegistry();
  const typingHandler = new TypingHandler(registry);
  const heartbeat = new HeartbeatManager(registry);

  // Start heartbeat monitoring
  heartbeat.start();

  // Handle HTTP upgrade requests
  httpServer.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const { pathname } = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);

    // Only handle /api/ws/chat path
    if (pathname !== '/api/ws/chat') {
      socket.destroy();
      return;
    }

    // Authenticate the upgrade request
    const authResult = authenticateUpgrade(req);
    if (!authResult.authenticated || !authResult.userId) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    // Extract chatId
    const chatId = extractChatId(req);
    if (!chatId) {
      socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
      socket.destroy();
      return;
    }

    // Complete the upgrade
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req, authResult.userId!, chatId);
    });
  });

  // Handle new connections
  wss.on('connection', (ws: AuthenticatedWebSocket, _req: IncomingMessage, userId: string, chatId: string) => {
    // Register connection
    registry.addConnection(chatId, ws, userId);
    heartbeat.addConnection(ws);

    // Handle pong responses
    ws.on('pong', () => {
      heartbeat.markAlive(ws);
    });

    // Handle incoming messages
    ws.on('message', (data: Buffer | string) => {
      try {
        const message = JSON.parse(data.toString());

        if (message.type === 'typing_start' || message.type === 'typing_stop') {
          const event: TypingEvent = {
            type: message.type,
            userId: userId, // Use authenticated userId, not client-provided
            chatId: chatId,
            timestamp: message.timestamp || Date.now(),
          };
          typingHandler.handleTypingEvent(ws, event);
        }
      } catch {
        // Ignore malformed messages
      }
    });

    // Handle disconnection
    ws.on('close', () => {
      typingHandler.cleanupConnection(ws);
      heartbeat.removeConnection(ws);
      registry.removeConnection(ws);
    });

    // Handle errors
    ws.on('error', () => {
      typingHandler.cleanupConnection(ws);
      heartbeat.removeConnection(ws);
      registry.removeConnection(ws);
    });
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    heartbeat.stop();
    typingHandler.cleanup();
    wss.close();
  });

  return wss;
}
