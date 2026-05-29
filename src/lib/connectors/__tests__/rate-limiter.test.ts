import { describe, it, expect, beforeEach } from 'vitest';
import { checkRateLimit } from '../rate-limiter';

describe('checkRateLimit', () => {
  it('allows requests within limit', () => {
    const result = checkRateLimit('/api/connectors/health', '192.168.1.100');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBeGreaterThan(0);
  });

  it('tracks requests per endpoint and IP', () => {
    const ip = `test-ip-${Date.now()}`;
    const result1 = checkRateLimit('/api/connectors/validate', ip);
    const result2 = checkRateLimit('/api/connectors/validate', ip);

    expect(result1.remaining).toBeGreaterThan(result2.remaining);
  });

  it('different IPs have independent limits', () => {
    const ip1 = `ip1-${Date.now()}`;
    const ip2 = `ip2-${Date.now()}`;

    const result1 = checkRateLimit('/api/connectors/validate', ip1);
    const result2 = checkRateLimit('/api/connectors/validate', ip2);

    expect(result1.remaining).toBe(result2.remaining);
  });

  it('returns resetAt timestamp', () => {
    const result = checkRateLimit('/api/connectors/health', `ip-${Date.now()}`);
    expect(result.resetAt).toBeGreaterThan(Date.now());
  });

  it('blocks after exceeding limit', () => {
    const ip = `flood-${Date.now()}`;
    // test-auth has 20 requests per minute
    for (let i = 0; i < 20; i++) {
      checkRateLimit('/api/connectors/test-auth', ip);
    }
    const result = checkRateLimit('/api/connectors/test-auth', ip);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });
});
