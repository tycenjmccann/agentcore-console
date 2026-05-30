import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { createPaginationToken, validatePaginationToken, getSigningKey } from '../lib/pagination.mjs';
import {
  TokenExpiredError,
  TokenTamperedError,
  TokenMalformedError,
  CustomerMismatchError,
} from '../lib/errors.mjs';

const TEST_SIGNING_KEY = 'test-signing-key-32-chars-long!!';
const TEST_CUSTOMER_ID = 'cus_test123';
const TEST_CURSOR = { pk: 'CUSTOMER#cus_test123', sk: 'INV#2024-01-15' };

function decodeToken(token) {
  const padded = token.replace(/-/g, '+').replace(/_/g, '/');
  const json = Buffer.from(padded, 'base64').toString('utf8');
  return JSON.parse(json);
}

function encodeToken(payload) {
  return Buffer.from(JSON.stringify(payload), 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function computeSignature(cursor, customerId, exp, signingKey) {
  const data = `${cursor}${customerId}${exp}`;
  return createHmac('sha256', signingKey).update(data).digest('hex');
}

describe('createPaginationToken', () => {
  it('creates a valid token with all required fields', async () => {
    const token = await createPaginationToken(TEST_CURSOR, TEST_CUSTOMER_ID, TEST_SIGNING_KEY);
    assert.ok(token);
    assert.equal(typeof token, 'string');
    assert.ok(token.length > 0);
  });

  it('token is valid base64url (no +, /, or = characters)', async () => {
    const token = await createPaginationToken(TEST_CURSOR, TEST_CUSTOMER_ID, TEST_SIGNING_KEY);
    assert.ok(!/[+/=]/.test(token), 'Token contains non-base64url characters');
  });

  it('decoded token contains cursor, customer_id, exp, sig', async () => {
    const token = await createPaginationToken(TEST_CURSOR, TEST_CUSTOMER_ID, TEST_SIGNING_KEY);
    const decoded = decodeToken(token);
    assert.ok(decoded.cursor);
    assert.ok(decoded.customer_id);
    assert.ok(decoded.exp);
    assert.ok(decoded.sig);
  });

  it('expiration is set correctly (default 15 minutes from now)', async () => {
    const before = Math.floor(Date.now() / 1000) + 15 * 60;
    const token = await createPaginationToken(TEST_CURSOR, TEST_CUSTOMER_ID, TEST_SIGNING_KEY);
    const after = Math.floor(Date.now() / 1000) + 15 * 60;
    const decoded = decodeToken(token);
    assert.ok(decoded.exp >= before && decoded.exp <= after);
  });

  it('custom TTL is respected', async () => {
    const ttlMinutes = 30;
    const before = Math.floor(Date.now() / 1000) + ttlMinutes * 60;
    const token = await createPaginationToken(TEST_CURSOR, TEST_CUSTOMER_ID, TEST_SIGNING_KEY, ttlMinutes);
    const after = Math.floor(Date.now() / 1000) + ttlMinutes * 60;
    const decoded = decodeToken(token);
    assert.ok(decoded.exp >= before && decoded.exp <= after);
  });

  it('different cursors produce different tokens', async () => {
    const cursor1 = { pk: 'A', sk: '1' };
    const cursor2 = { pk: 'B', sk: '2' };
    const token1 = await createPaginationToken(cursor1, TEST_CUSTOMER_ID, TEST_SIGNING_KEY);
    const token2 = await createPaginationToken(cursor2, TEST_CUSTOMER_ID, TEST_SIGNING_KEY);
    assert.notEqual(token1, token2);
  });

  it('different customer IDs produce different signatures', async () => {
    const token1 = await createPaginationToken(TEST_CURSOR, 'cus_alice', TEST_SIGNING_KEY);
    const token2 = await createPaginationToken(TEST_CURSOR, 'cus_bob', TEST_SIGNING_KEY);
    const sig1 = decodeToken(token1).sig;
    const sig2 = decodeToken(token2).sig;
    assert.notEqual(sig1, sig2);
  });
});

describe('validatePaginationToken', () => {
  it('valid token returns the correct cursor', async () => {
    const token = await createPaginationToken(TEST_CURSOR, TEST_CUSTOMER_ID, TEST_SIGNING_KEY);
    const cursor = await validatePaginationToken(token, TEST_CUSTOMER_ID, TEST_SIGNING_KEY);
    assert.deepEqual(cursor, TEST_CURSOR);
  });

  it('expired token throws TokenExpiredError', async () => {
    const token = await createPaginationToken(TEST_CURSOR, TEST_CUSTOMER_ID, TEST_SIGNING_KEY, -1);
    await assert.rejects(
      () => validatePaginationToken(token, TEST_CUSTOMER_ID, TEST_SIGNING_KEY),
      TokenExpiredError
    );
  });

  it('tampered cursor throws TokenTamperedError', async () => {
    const token = await createPaginationToken(TEST_CURSOR, TEST_CUSTOMER_ID, TEST_SIGNING_KEY);
    const decoded = decodeToken(token);
    decoded.cursor = JSON.stringify({ pk: 'HACKED', sk: 'DATA' });
    const tampered = encodeToken(decoded);
    await assert.rejects(
      () => validatePaginationToken(tampered, TEST_CUSTOMER_ID, TEST_SIGNING_KEY),
      TokenTamperedError
    );
  });

  it('tampered customer_id in token throws TokenTamperedError', async () => {
    const token = await createPaginationToken(TEST_CURSOR, TEST_CUSTOMER_ID, TEST_SIGNING_KEY);
    const decoded = decodeToken(token);
    decoded.customer_id = 'cus_attacker';
    const tampered = encodeToken(decoded);
    await assert.rejects(
      () => validatePaginationToken(tampered, 'cus_attacker', TEST_SIGNING_KEY),
      TokenTamperedError
    );
  });

  it('tampered expiration throws TokenTamperedError', async () => {
    const token = await createPaginationToken(TEST_CURSOR, TEST_CUSTOMER_ID, TEST_SIGNING_KEY);
    const decoded = decodeToken(token);
    decoded.exp = Math.floor(Date.now() / 1000) + 999999;
    const tampered = encodeToken(decoded);
    await assert.rejects(
      () => validatePaginationToken(tampered, TEST_CUSTOMER_ID, TEST_SIGNING_KEY),
      TokenTamperedError
    );
  });

  it('tampered signature throws TokenTamperedError', async () => {
    const token = await createPaginationToken(TEST_CURSOR, TEST_CUSTOMER_ID, TEST_SIGNING_KEY);
    const decoded = decodeToken(token);
    decoded.sig = 'a'.repeat(64);
    const tampered = encodeToken(decoded);
    await assert.rejects(
      () => validatePaginationToken(tampered, TEST_CUSTOMER_ID, TEST_SIGNING_KEY),
      TokenTamperedError
    );
  });

  it('customer ID mismatch throws CustomerMismatchError', async () => {
    const token = await createPaginationToken(TEST_CURSOR, TEST_CUSTOMER_ID, TEST_SIGNING_KEY);
    await assert.rejects(
      () => validatePaginationToken(token, 'cus_different_customer', TEST_SIGNING_KEY),
      CustomerMismatchError
    );
  });

  it('malformed base64 throws TokenMalformedError', async () => {
    await assert.rejects(
      () => validatePaginationToken('!!!not-base64!!!', TEST_CUSTOMER_ID, TEST_SIGNING_KEY),
      TokenMalformedError
    );
  });

  it('invalid JSON after base64 decode throws TokenMalformedError', async () => {
    const notJson = Buffer.from('this is not json', 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    await assert.rejects(
      () => validatePaginationToken(notJson, TEST_CUSTOMER_ID, TEST_SIGNING_KEY),
      TokenMalformedError
    );
  });

  it('missing fields throws TokenMalformedError', async () => {
    const incomplete = encodeToken({ cursor: 'x' });
    await assert.rejects(
      () => validatePaginationToken(incomplete, TEST_CUSTOMER_ID, TEST_SIGNING_KEY),
      TokenMalformedError
    );
  });

  it('token created with one key fails validation with another key', async () => {
    const token = await createPaginationToken(TEST_CURSOR, TEST_CUSTOMER_ID, TEST_SIGNING_KEY);
    await assert.rejects(
      () => validatePaginationToken(token, TEST_CUSTOMER_ID, 'different-key-32-chars-long!!!!'),
      TokenTamperedError
    );
  });
});

describe('getSigningKey', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns a signing key from Secrets Manager', async (t) => {
    const { SecretsManagerClient } = await import('@aws-sdk/client-secrets-manager');
    const sendMock = t.mock.method(SecretsManagerClient.prototype, 'send', async () => ({
      SecretString: 'my-secret-signing-key',
    }));

    const key = await getSigningKey('test/pagination-key', 'us-west-2');
    assert.equal(key, 'my-secret-signing-key');
    assert.equal(sendMock.mock.callCount(), 1);
  });

  it('caches the key on subsequent calls', async (t) => {
    const { SecretsManagerClient } = await import('@aws-sdk/client-secrets-manager');
    const sendMock = t.mock.method(SecretsManagerClient.prototype, 'send', async () => ({
      SecretString: 'cached-key-value',
    }));

    const key1 = await getSigningKey('test/cache-key', 'us-east-1');
    const key2 = await getSigningKey('test/cache-key', 'us-east-1');
    assert.equal(key1, 'cached-key-value');
    assert.equal(key2, 'cached-key-value');
    assert.equal(sendMock.mock.callCount(), 1);
  });

  it('refreshes after cache TTL expires', async (t) => {
    const { SecretsManagerClient } = await import('@aws-sdk/client-secrets-manager');
    let callCount = 0;
    const sendMock = t.mock.method(SecretsManagerClient.prototype, 'send', async () => {
      callCount++;
      return { SecretString: `key-version-${callCount}` };
    });

    const key1 = await getSigningKey('test/ttl-key', 'eu-west-1');
    assert.equal(key1, 'key-version-1');

    const dateNowOriginal = Date.now;
    const futureTime = Date.now() + 6 * 60 * 1000;
    t.mock.method(Date, 'now', () => futureTime);

    const key2 = await getSigningKey('test/ttl-key', 'eu-west-1');
    assert.equal(key2, 'key-version-2');
    assert.equal(sendMock.mock.callCount(), 2);

    Date.now = dateNowOriginal;
  });
});

describe('Security Properties', () => {
  it('same inputs produce the same token (deterministic for same timestamp)', async (t) => {
    const fixedTime = 1700000000000;
    t.mock.method(Date, 'now', () => fixedTime);

    const token1 = await createPaginationToken(TEST_CURSOR, TEST_CUSTOMER_ID, TEST_SIGNING_KEY);
    const token2 = await createPaginationToken(TEST_CURSOR, TEST_CUSTOMER_ID, TEST_SIGNING_KEY);
    assert.equal(token1, token2);
  });

  it('tokens from one customer cannot be used for another customer', async () => {
    const token = await createPaginationToken(TEST_CURSOR, 'cus_alice', TEST_SIGNING_KEY);
    await assert.rejects(
      () => validatePaginationToken(token, 'cus_bob', TEST_SIGNING_KEY),
      CustomerMismatchError
    );
  });

  it('signature uses constant-time comparison (timingSafeEqual)', async () => {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const { dirname, join } = await import('node:path');

    const __dirname = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(join(__dirname, '..', 'lib', 'pagination.mjs'), 'utf8');
    assert.ok(source.includes('timingSafeEqual'), 'pagination.mjs must use timingSafeEqual for signature comparison');
  });
});
