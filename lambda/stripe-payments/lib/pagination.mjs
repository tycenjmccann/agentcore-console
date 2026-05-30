import { createHmac, timingSafeEqual } from 'node:crypto';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import {
  TokenExpiredError,
  TokenTamperedError,
  TokenMalformedError,
  CustomerMismatchError,
} from './errors.mjs';

const keyCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Creates a signed pagination token.
 * @param {object} cursor - DynamoDB LastEvaluatedKey object.
 * @param {string} customerId - The customer ID to bind the token to.
 * @param {string} signingKey - HMAC signing key.
 * @param {number} [ttlMinutes=15] - Token lifetime in minutes.
 * @returns {Promise<string>} Base64url-encoded signed token.
 */
export async function createPaginationToken(cursor, customerId, signingKey, ttlMinutes = 15) {
  const cursorStr = JSON.stringify(cursor);
  const exp = Math.floor(Date.now() / 1000) + ttlMinutes * 60;
  const sig = computeSignature(cursorStr, customerId, exp, signingKey);

  const payload = JSON.stringify({
    cursor: cursorStr,
    customer_id: customerId,
    exp,
    sig,
  });

  return toBase64Url(payload);
}

/**
 * Validates and decodes a pagination token.
 * @param {string} token - The base64url-encoded token string.
 * @param {string} customerId - The requesting customer's ID (must match token).
 * @param {string} signingKey - HMAC signing key.
 * @returns {Promise<object>} The decoded DynamoDB cursor object.
 * @throws {TokenMalformedError} If the token cannot be decoded or is missing fields.
 * @throws {TokenExpiredError} If the token has expired.
 * @throws {CustomerMismatchError} If the customer ID does not match.
 * @throws {TokenTamperedError} If the HMAC signature is invalid.
 */
export async function validatePaginationToken(token, customerId, signingKey) {
  let payload;
  try {
    const json = fromBase64Url(token);
    payload = JSON.parse(json);
  } catch {
    throw new TokenMalformedError('Token is not valid base64url-encoded JSON');
  }

  if (!payload.cursor || !payload.customer_id || !payload.exp || !payload.sig) {
    throw new TokenMalformedError('Token is missing required fields');
  }

  if (payload.exp < Math.floor(Date.now() / 1000)) {
    throw new TokenExpiredError();
  }

  if (payload.customer_id !== customerId) {
    throw new CustomerMismatchError();
  }

  const expectedSig = computeSignature(payload.cursor, payload.customer_id, payload.exp, signingKey);

  const sigBuffer = Buffer.from(payload.sig, 'hex');
  const expectedBuffer = Buffer.from(expectedSig, 'hex');

  if (sigBuffer.length !== expectedBuffer.length || !timingSafeEqual(sigBuffer, expectedBuffer)) {
    throw new TokenTamperedError();
  }

  return JSON.parse(payload.cursor);
}

/**
 * Retrieves the pagination signing key from AWS Secrets Manager with caching.
 * @param {string} [secretId] - The secret ID. Defaults to env var PAGINATION_SIGNING_KEY_SECRET_ID.
 * @param {string} [region] - AWS region. Defaults to env var AWS_REGION or 'us-east-1'.
 * @returns {Promise<string>} The signing key value.
 */
export async function getSigningKey(secretId, region) {
  const resolvedSecretId = secretId || process.env.PAGINATION_SIGNING_KEY_SECRET_ID;
  const resolvedRegion = region || process.env.AWS_REGION || 'us-east-1';

  if (!resolvedSecretId) {
    throw new Error('No secret ID provided and PAGINATION_SIGNING_KEY_SECRET_ID env var is not set');
  }

  const cacheKey = `${resolvedRegion}:${resolvedSecretId}`;
  const cached = keyCache.get(cacheKey);

  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.value;
  }

  const client = new SecretsManagerClient({ region: resolvedRegion });
  const response = await client.send(
    new GetSecretValueCommand({ SecretId: resolvedSecretId })
  );

  const value = response.SecretString;
  keyCache.set(cacheKey, { value, fetchedAt: Date.now() });

  return value;
}

function computeSignature(cursor, customerId, exp, signingKey) {
  const data = `${cursor}${customerId}${exp}`;
  return createHmac('sha256', signingKey).update(data).digest('hex');
}

function toBase64Url(str) {
  return Buffer.from(str, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromBase64Url(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(padded, 'base64').toString('utf8');
}
