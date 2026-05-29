/**
 * Validation Pipeline — Schema → Credentials → Connectivity → Functionality
 * Fails fast: if any stage fails, subsequent stages are skipped.
 */
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { STSClient, AssumeRoleCommand } from '@aws-sdk/client-sts';
import { isAllowedHost } from './security.mjs';

const secretsClient = new SecretsManagerClient({});
const stsClient = new STSClient({});

// Connector-specific validation strategies
const STRATEGIES = {
  'github-mcp': {
    connectivityCheck: async (config, creds) => {
      const url = 'https://api.github.com/user';
      const resp = await fetchWithTimeout(url, {
        headers: { 'Authorization': `Bearer ${creds.token}`, 'Accept': 'application/vnd.github.v3+json' },
      });
      if (resp.status === 401) return { ok: false, code: 'AUTH_ERROR', message: 'GitHub token is invalid or expired' };
      if (resp.status === 403) return { ok: false, code: 'PERMISSION_ERROR', message: 'GitHub token lacks required scopes' };
      if (!resp.ok) return { ok: false, code: 'CONNECTIVITY_ERROR', message: `GitHub API returned ${resp.status}` };
      return { ok: true };
    },
    functionalityCheck: async (config, creds) => {
      // Verify MCP server is reachable
      if (!isAllowedHost(config.serverUrl)) {
        return { ok: false, code: 'CONNECTIVITY_ERROR', message: 'Server URL not in allowed hosts' };
      }
      const resp = await fetchWithTimeout(config.serverUrl, { method: 'HEAD' });
      if (!resp.ok) return { ok: false, code: 'SERVICE_ERROR', message: `MCP server returned ${resp.status}` };
      return { ok: true };
    },
  },
  'jira': {
    connectivityCheck: async (config, creds) => {
      const url = `${config.baseUrl}/rest/api/3/myself`;
      const auth = Buffer.from(`${creds.email}:${creds.apiToken}`).toString('base64');
      const resp = await fetchWithTimeout(url, {
        headers: { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json' },
      });
      if (resp.status === 401) return { ok: false, code: 'AUTH_ERROR', message: 'Jira credentials are invalid' };
      if (resp.status === 403) return { ok: false, code: 'PERMISSION_ERROR', message: 'Jira token lacks required permissions' };
      if (!resp.ok) return { ok: false, code: 'CONNECTIVITY_ERROR', message: `Jira API returned ${resp.status}` };
      return { ok: true };
    },
    functionalityCheck: async (config, creds) => {
      const url = `${config.baseUrl}/rest/api/3/project/${config.projectKey}`;
      const auth = Buffer.from(`${creds.email}:${creds.apiToken}`).toString('base64');
      const resp = await fetchWithTimeout(url, {
        headers: { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json' },
      });
      if (resp.status === 404) return { ok: false, code: 'PERMISSION_ERROR', message: `Project ${config.projectKey} not found or inaccessible` };
      if (!resp.ok) return { ok: false, code: 'SERVICE_ERROR', message: `Project check failed: ${resp.status}` };
      return { ok: true };
    },
  },
  's3-storage': {
    connectivityCheck: async (config, creds) => {
      // For S3, we use STS AssumeRole if roleArn provided, otherwise just check bucket
      try {
        const { S3Client: S3, HeadBucketCommand } = await import('@aws-sdk/client-s3');
        let s3Options = { region: config.region };
        if (config.roleArn) {
          const assumed = await stsClient.send(new AssumeRoleCommand({
            RoleArn: config.roleArn,
            RoleSessionName: 'connector-validation',
            DurationSeconds: 900,
          }));
          s3Options.credentials = {
            accessKeyId: assumed.Credentials.AccessKeyId,
            secretAccessKey: assumed.Credentials.SecretAccessKey,
            sessionToken: assumed.Credentials.SessionToken,
          };
        }
        const s3 = new S3(s3Options);
        await s3.send(new HeadBucketCommand({ Bucket: config.bucket }));
        return { ok: true };
      } catch (err) {
        if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
          return { ok: false, code: 'CONNECTIVITY_ERROR', message: `Bucket "${config.bucket}" does not exist` };
        }
        if (err.name === 'Forbidden' || err.$metadata?.httpStatusCode === 403) {
          return { ok: false, code: 'PERMISSION_ERROR', message: `Access denied to bucket "${config.bucket}"` };
        }
        return { ok: false, code: 'CONNECTIVITY_ERROR', message: err.message };
      }
    },
    functionalityCheck: async (config, creds) => {
      // List objects with prefix to verify read access
      try {
        const { S3Client: S3, ListObjectsV2Command } = await import('@aws-sdk/client-s3');
        let s3Options = { region: config.region };
        if (config.roleArn && creds?.assumedCredentials) {
          s3Options.credentials = creds.assumedCredentials;
        }
        const s3 = new S3(s3Options);
        await s3.send(new ListObjectsV2Command({
          Bucket: config.bucket,
          Prefix: config.prefix || '',
          MaxKeys: 1,
        }));
        return { ok: true };
      } catch (err) {
        return { ok: false, code: 'PERMISSION_ERROR', message: `Cannot list objects: ${err.message}` };
      }
    },
  },
  'claude-code': {
    connectivityCheck: async (config, creds) => {
      if (!isAllowedHost(config.serverUrl)) {
        return { ok: false, code: 'CONNECTIVITY_ERROR', message: 'Server URL not in allowed hosts' };
      }
      const resp = await fetchWithTimeout(config.serverUrl, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${creds.apiKey}` },
      });
      if (resp.status === 401) return { ok: false, code: 'AUTH_ERROR', message: 'API key is invalid' };
      if (!resp.ok) return { ok: false, code: 'CONNECTIVITY_ERROR', message: `Server returned ${resp.status}` };
      return { ok: true };
    },
    functionalityCheck: async (config, creds) => {
      // Verify MCP protocol handshake
      const resp = await fetchWithTimeout(`${config.serverUrl}/mcp/v1/capabilities`, {
        headers: { 'Authorization': `Bearer ${creds.apiKey}`, 'Accept': 'application/json' },
      });
      if (!resp.ok) return { ok: false, code: 'SERVICE_ERROR', message: 'MCP capabilities endpoint not available' };
      return { ok: true };
    },
  },
  'custom-mcp': {
    connectivityCheck: async (config, creds) => {
      if (!isAllowedHost(config.serverUrl)) {
        return { ok: false, code: 'CONNECTIVITY_ERROR', message: 'Server URL not in allowed hosts' };
      }
      const headers = { ...(config.headers || {}), ...(creds?.headers || {}) };
      const resp = await fetchWithTimeout(config.serverUrl, { method: 'HEAD', headers });
      if (!resp.ok) return { ok: false, code: 'CONNECTIVITY_ERROR', message: `Server returned ${resp.status}` };
      return { ok: true };
    },
    functionalityCheck: async (config, creds) => {
      // For custom MCP, verify the transport type endpoint is available
      const headers = { ...(config.headers || {}), ...(creds?.headers || {}), 'Accept': 'application/json' };
      const resp = await fetchWithTimeout(config.serverUrl, { headers });
      if (!resp.ok) return { ok: false, code: 'SERVICE_ERROR', message: `MCP server not responding: ${resp.status}` };
      return { ok: true };
    },
  },
};

/**
 * Main validation pipeline — fail-fast execution.
 */
export async function validateConnector({ connectorType, connectorConfig, credentials, log }) {
  const results = [];
  const strategy = STRATEGIES[connectorType];

  if (!strategy) {
    results.push({ stage: 'schema', status: 'failed', durationMs: 0, error: { code: 'SCHEMA_ERROR', message: `Unknown connector type: ${connectorType}` } });
    return results;
  }

  // Stage 1: Schema validation (basic config check)
  const schemaStart = Date.now();
  const schemaResult = validateSchemaStage(connectorType, connectorConfig);
  results.push({ stage: 'schema', ...schemaResult, durationMs: Date.now() - schemaStart });
  if (schemaResult.status === 'failed') return results; // fail-fast

  // Stage 2: Credentials retrieval
  const credsStart = Date.now();
  const credsResult = await validateCredentials(credentials, log);
  results.push({ stage: 'credentials', ...credsResult.result, durationMs: Date.now() - credsStart });
  if (credsResult.result.status === 'failed') return results; // fail-fast

  // Stage 3: Connectivity check
  const connStart = Date.now();
  log.info('Running connectivity check', { connectorType });
  try {
    const connCheck = await strategy.connectivityCheck(connectorConfig, credsResult.resolvedCreds || {});
    if (connCheck.ok) {
      results.push({ stage: 'connectivity', status: 'passed', durationMs: Date.now() - connStart });
    } else {
      results.push({ stage: 'connectivity', status: 'failed', durationMs: Date.now() - connStart, error: { code: connCheck.code, message: connCheck.message } });
      return results; // fail-fast
    }
  } catch (err) {
    results.push({ stage: 'connectivity', status: 'failed', durationMs: Date.now() - connStart, error: { code: 'CONNECTIVITY_ERROR', message: err.message } });
    return results;
  }

  // Stage 4: Functionality check
  const funcStart = Date.now();
  log.info('Running functionality check', { connectorType });
  try {
    const funcCheck = await strategy.functionalityCheck(connectorConfig, credsResult.resolvedCreds || {});
    if (funcCheck.ok) {
      results.push({ stage: 'functionality', status: 'passed', durationMs: Date.now() - funcStart });
    } else {
      results.push({ stage: 'functionality', status: 'failed', durationMs: Date.now() - funcStart, error: { code: funcCheck.code, message: funcCheck.message } });
    }
  } catch (err) {
    results.push({ stage: 'functionality', status: 'failed', durationMs: Date.now() - funcStart, error: { code: 'SERVICE_ERROR', message: err.message } });
  }

  return results;
}

function validateSchemaStage(connectorType, config) {
  // Basic required fields check per connector type
  const requiredFields = {
    'github-mcp': ['serverUrl'],
    'jira': ['baseUrl', 'projectKey'],
    's3-storage': ['bucket', 'region'],
    'claude-code': ['serverUrl'],
    'custom-mcp': ['serverUrl', 'transportType'],
  };
  const required = requiredFields[connectorType] || [];
  for (const field of required) {
    if (!config[field]) {
      return { status: 'failed', error: { code: 'SCHEMA_ERROR', message: `Missing required field: ${field}` } };
    }
  }
  return { status: 'passed' };
}

async function validateCredentials(credentials, log) {
  if (!credentials || !credentials.secretArn) {
    // No credentials required or provided inline (for S3 with IAM role)
    return { result: { status: 'passed', message: 'No secret ARN — using IAM role' }, resolvedCreds: {} };
  }

  try {
    log.info('Retrieving credentials from Secrets Manager');
    const response = await secretsClient.send(new GetSecretValueCommand({
      SecretId: credentials.secretArn,
    }));
    const resolvedCreds = JSON.parse(response.SecretString);
    // NEVER log credentials
    log.info('Credentials retrieved successfully');
    return { result: { status: 'passed' }, resolvedCreds };
  } catch (err) {
    log.error('Credential retrieval failed', { error: err.message });
    if (err.name === 'ResourceNotFoundException') {
      return { result: { status: 'failed', error: { code: 'CREDENTIAL_ERROR', message: 'Secret not found', retryable: false } }, resolvedCreds: null };
    }
    if (err.name === 'AccessDeniedException') {
      return { result: { status: 'failed', error: { code: 'CREDENTIAL_ERROR', message: 'Access denied to secret', retryable: false } }, resolvedCreds: null };
    }
    return { result: { status: 'failed', error: { code: 'CREDENTIAL_ERROR', message: err.message, retryable: true } }, resolvedCreds: null };
  }
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { ...options, signal: controller.signal });
    return resp;
  } catch (err) {
    if (err.name === 'AbortError') {
      return { ok: false, status: 408, statusText: 'Timeout' };
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
