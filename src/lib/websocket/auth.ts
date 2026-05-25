import type { IncomingMessage } from 'http';

export interface AuthResult {
  authenticated: boolean;
  userId?: string;
  error?: string;
}

/**
 * Authenticate a WebSocket upgrade request.
 * Accepts token via query param `token` or Authorization header.
 * Token format: `userId:sessionToken` (e.g., "user123:abc456")
 */
export function authenticateUpgrade(req: IncomingMessage): AuthResult {
  // Try query parameter first
  const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
  let token = url.searchParams.get('token');

  // Fall back to Authorization header
  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      // Support "Bearer <token>" and raw token
      token = authHeader.startsWith('Bearer ')
        ? authHeader.slice(7)
        : authHeader;
    }
  }

  if (!token || token.trim().length === 0) {
    return { authenticated: false, error: 'Missing authentication token' };
  }

  // Parse token format: userId:sessionToken
  const parts = token.split(':');
  if (parts.length < 2 || !parts[0].trim() || !parts[1].trim()) {
    return { authenticated: false, error: 'Invalid token format. Expected userId:sessionToken' };
  }

  const userId = parts[0].trim();

  return { authenticated: true, userId };
}

/**
 * Extract chatId from the upgrade request query params
 */
export function extractChatId(req: IncomingMessage): string | null {
  const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
  return url.searchParams.get('chatId');
}
