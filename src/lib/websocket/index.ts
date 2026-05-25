export { setupWebSocketServer } from './server';
export { ConnectionRegistry } from './connection-registry';
export { TypingHandler } from './typing-handler';
export { HeartbeatManager } from './heartbeat';
export { authenticateUpgrade, extractChatId } from './auth';
export type { TypingEvent, AuthenticatedWebSocket, ConnectionMetadata, WebSocketMessage } from './types';
