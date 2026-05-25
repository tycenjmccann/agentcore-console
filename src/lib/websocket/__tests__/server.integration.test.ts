import { describe, it, expect, afterEach } from 'vitest';
import { createServer, Server } from 'http';
import WebSocket from 'ws';
import { setupWebSocketServer } from '../server';

let server: Server;
let port: number;

function startServer(): Promise<void> {
  return new Promise((resolve) => {
    server = createServer();
    setupWebSocketServer(server);
    server.listen(0, () => {
      const addr = server.address();
      port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve();
    });
  });
}

function createWsClient(token: string, chatId: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}/api/ws/chat?token=${token}&chatId=${chatId}`);
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

function waitForMessage(ws: WebSocket): Promise<any> {
  return new Promise((resolve) => {
    ws.on('message', (data) => {
      resolve(JSON.parse(data.toString()));
    });
  });
}

describe('WebSocket Server Integration', () => {
  afterEach(() => {
    return new Promise<void>((resolve) => {
      if (server) {
        server.close(() => resolve());
      } else {
        resolve();
      }
    });
  });

  it('should reject unauthenticated connections', async () => {
    await startServer();

    const ws = new WebSocket(`ws://localhost:${port}/api/ws/chat?chatId=chat1`);

    await new Promise<void>((resolve) => {
      ws.on('error', () => resolve());
      ws.on('close', () => resolve());
    });

    expect(ws.readyState).not.toBe(WebSocket.OPEN);
  });

  it('should accept authenticated connections', async () => {
    await startServer();
    const ws = await createWsClient('user1:token1', 'chat1');
    expect(ws.readyState).toBe(WebSocket.OPEN);
    ws.close();
  });

  it('should broadcast typing_start to other participants', async () => {
    await startServer();

    const ws1 = await createWsClient('user1:token1', 'chat1');
    const ws2 = await createWsClient('user2:token2', 'chat1');

    const messagePromise = waitForMessage(ws2);

    ws1.send(JSON.stringify({
      type: 'typing_start',
      userId: 'user1',
      chatId: 'chat1',
      timestamp: Date.now(),
    }));

    const received = await messagePromise;
    expect(received.type).toBe('typing_start');
    expect(received.userId).toBe('user1');
    expect(received.chatId).toBe('chat1');

    ws1.close();
    ws2.close();
  });

  it('should not broadcast to connections in different chats', async () => {
    await startServer();

    const ws1 = await createWsClient('user1:token1', 'chat1');
    const ws2 = await createWsClient('user2:token2', 'chat2');

    let received = false;
    ws2.on('message', () => { received = true; });

    ws1.send(JSON.stringify({
      type: 'typing_start',
      userId: 'user1',
      chatId: 'chat1',
      timestamp: Date.now(),
    }));

    // Wait a bit to ensure no message arrives
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(received).toBe(false);

    ws1.close();
    ws2.close();
  });

  it('should reject connections to invalid paths', async () => {
    await startServer();

    const ws = new WebSocket(`ws://localhost:${port}/api/ws/other?token=user1:token1&chatId=chat1`);

    await new Promise<void>((resolve) => {
      ws.on('error', () => resolve());
      ws.on('close', () => resolve());
    });

    expect(ws.readyState).not.toBe(WebSocket.OPEN);
  });
});
