import { ConnectorValidationError } from './errors';

// ARN patterns
const SSM_ARN_PATTERN = /^arn:aws:ssm:[a-z0-9-]+:\d{12}:parameter\/.+$/;
const SECRETS_MANAGER_ARN_PATTERN = /^arn:aws:secretsmanager:[a-z0-9-]+:\d{12}:secret:.+$/;

// Simple in-memory cache with TTL
const secretCache = new Map<string, { value: string; expiresAt: number }>();
const CACHE_TTL = 300_000; // 5 minutes

/**
 * Validates that a credential reference is a valid ARN format.
 * Rejects any plaintext secrets.
 */
export function validateCredentialArn(arn: string): void {
  if (!arn) {
    throw new ConnectorValidationError('CVE-401', 'credentialArn is required');
  }

  // Check for plaintext secrets (basic heuristic)
  if (!arn.startsWith('arn:aws:')) {
    throw new ConnectorValidationError('CVE-104', 'Credential must be an ARN reference, not plaintext');
  }

  if (!SSM_ARN_PATTERN.test(arn) && !SECRETS_MANAGER_ARN_PATTERN.test(arn)) {
    throw new ConnectorValidationError('CVE-100', `Invalid credential ARN: ${arn}`);
  }
}

/**
 * Resolves a secret value from SSM Parameter Store or Secrets Manager.
 */
export async function resolveSecret(arn: string): Promise<string> {
  validateCredentialArn(arn);

  // Check cache
  const cached = secretCache.get(arn);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.value;
  }

  let value: string;

  if (SSM_ARN_PATTERN.test(arn)) {
    value = await resolveFromSSM(arn);
  } else {
    value = await resolveFromSecretsManager(arn);
  }

  // Cache the resolved value
  secretCache.set(arn, { value, expiresAt: Date.now() + CACHE_TTL });

  return value;
}

async function resolveFromSSM(arn: string): Promise<string> {
  try {
    // Extract parameter name from ARN
    const paramName = arn.split(':parameter')[1];
    const region = arn.split(':')[3];

    const { SSMClient, GetParameterCommand } = await import('@aws-sdk/client-ssm');
    const client = new SSMClient({ region });

    const response = await client.send(new GetParameterCommand({
      Name: paramName,
      WithDecryption: true,
    }));

    if (!response.Parameter?.Value) {
      throw new ConnectorValidationError('CVE-101', `Parameter not found: ${paramName}`);
    }

    return response.Parameter.Value;
  } catch (err) {
    if (err instanceof ConnectorValidationError) throw err;
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message.includes('AccessDenied') || message.includes('not authorized')) {
      throw new ConnectorValidationError('CVE-102', message);
    }
    throw new ConnectorValidationError('CVE-101', message);
  }
}

async function resolveFromSecretsManager(arn: string): Promise<string> {
  try {
    const region = arn.split(':')[3];

    const { SecretsManagerClient, GetSecretValueCommand } = await import('@aws-sdk/client-secrets-manager');
    const client = new SecretsManagerClient({ region });

    const response = await client.send(new GetSecretValueCommand({
      SecretId: arn,
    }));

    if (!response.SecretString) {
      throw new ConnectorValidationError('CVE-101', 'Secret has no string value');
    }

    return response.SecretString;
  } catch (err) {
    if (err instanceof ConnectorValidationError) throw err;
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message.includes('AccessDenied') || message.includes('not authorized')) {
      throw new ConnectorValidationError('CVE-102', message);
    }
    if (message.includes('ResourceNotFoundException')) {
      throw new ConnectorValidationError('CVE-101', message);
    }
    throw new ConnectorValidationError('CVE-101', message);
  }
}

/**
 * SSRF protection - validates URLs don't resolve to private IP ranges
 */
export function validateUrlSafety(url: string): void {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname;

    // Block private IP ranges
    const privatePatterns = [
      /^10\.\d+\.\d+\.\d+$/,
      /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
      /^192\.168\.\d+\.\d+$/,
      /^127\.\d+\.\d+\.\d+$/,
      /^0\.0\.0\.0$/,
      /^localhost$/i,
      /^::1$/,
      /^fc00:/i,
      /^fe80:/i,
      /^169\.254\.\d+\.\d+$/, // link-local
    ];

    for (const pattern of privatePatterns) {
      if (pattern.test(hostname)) {
        throw new ConnectorValidationError('CVE-204', `Blocked private address: ${hostname}`);
      }
    }
  } catch (err) {
    if (err instanceof ConnectorValidationError) throw err;
    throw new ConnectorValidationError('CVE-400', `Invalid URL: ${url}`);
  }
}

/**
 * Validates an AWS ARN format (general purpose)
 */
export function validateArn(arn: string, service?: string): void {
  const arnPattern = /^arn:aws[a-z-]*:[a-z0-9-]+:[a-z0-9-]*:\d{12}:.+$/;
  if (!arnPattern.test(arn)) {
    throw new ConnectorValidationError('CVE-402', `Invalid ARN: ${arn}`);
  }
  if (service) {
    const arnService = arn.split(':')[2];
    if (arnService !== service) {
      throw new ConnectorValidationError('CVE-402', `Expected ${service} ARN, got ${arnService}`);
    }
  }
}

/**
 * Clear the secret cache (useful for testing or rotation events)
 */
export function clearSecretCache(): void {
  secretCache.clear();
}
