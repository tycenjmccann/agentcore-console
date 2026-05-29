interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitConfig {
  windowMs: number; // time window in milliseconds
  maxRequests: number; // max requests per window
}

const DEFAULT_CONFIGS: Record<string, RateLimitConfig> = {
  '/api/connectors/validate': { windowMs: 60_000, maxRequests: 30 },
  '/api/connectors/health': { windowMs: 60_000, maxRequests: 60 },
  '/api/connectors/test-auth': { windowMs: 60_000, maxRequests: 20 },
};

// In-memory store keyed by "endpoint:clientIp"
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (now > entry.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}, 300_000);

export function checkRateLimit(endpoint: string, clientIp: string): { allowed: boolean; remaining: number; resetAt: number } {
  const config = DEFAULT_CONFIGS[endpoint] || { windowMs: 60_000, maxRequests: 30 };
  const key = `${endpoint}:${clientIp}`;
  const now = Date.now();

  let entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + config.windowMs };
    rateLimitStore.set(key, entry);
  }

  entry.count++;

  return {
    allowed: entry.count <= config.maxRequests,
    remaining: Math.max(0, config.maxRequests - entry.count),
    resetAt: entry.resetAt,
  };
}

export function getRateLimitHeaders(endpoint: string, clientIp: string): Record<string, string> {
  const result = checkRateLimit(endpoint, clientIp);
  return {
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': new Date(result.resetAt).toISOString(),
  };
}
