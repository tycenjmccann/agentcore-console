import { ConnectorConfig, ValidationResult, JiraConfig } from '../types';
import { ConnectorValidationError } from '../errors';
import { resolveSecret, validateUrlSafety } from '../secret-resolver';

export async function validateJira(config: ConnectorConfig, timeout: number): Promise<ValidationResult> {
  const start = Date.now();
  const jiraConfig = config.config as JiraConfig;

  if (!jiraConfig.baseUrl) {
    throw new ConnectorValidationError('CVE-401', 'baseUrl is required for Jira connector');
  }

  if (!jiraConfig.credentialArn) {
    throw new ConnectorValidationError('CVE-401', 'credentialArn is required for Jira connector');
  }

  validateUrlSafety(jiraConfig.baseUrl);

  try {
    const credential = await resolveSecret(jiraConfig.credentialArn);
    let authHeaders: Record<string, string>;

    try {
      const parsed = JSON.parse(credential);
      if (parsed.accessToken) {
        authHeaders = { 'Authorization': `Bearer ${parsed.accessToken}` };
      } else if (parsed.email && parsed.token) {
        const encoded = Buffer.from(`${parsed.email}:${parsed.token}`).toString('base64');
        authHeaders = { 'Authorization': `Basic ${encoded}` };
      } else {
        throw new ConnectorValidationError('CVE-400', 'Jira credential must contain {email, token} or {accessToken}');
      }
    } catch (parseErr) {
      if (parseErr instanceof ConnectorValidationError) throw parseErr;
      const email = process.env.JIRA_EMAIL || '';
      const encoded = Buffer.from(`${email}:${credential}`).toString('base64');
      authHeaders = { 'Authorization': `Basic ${encoded}` };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${jiraConfig.baseUrl}/rest/api/3/myself`, {
        headers: {
          ...authHeaders,
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });

      if (response.ok) {
        return {
          connectorId: config.id,
          connectorType: 'jira',
          status: 'healthy',
          latencyMs: Date.now() - start,
          timestamp: new Date().toISOString(),
        };
      }

      if (response.status === 401 || response.status === 403) {
        return {
          connectorId: config.id,
          connectorType: 'jira',
          status: 'unhealthy',
          latencyMs: Date.now() - start,
          errorCode: 'CVE-103',
          message: 'Jira authentication failed',
          timestamp: new Date().toISOString(),
        };
      }

      return {
        connectorId: config.id,
        connectorType: 'jira',
        status: 'degraded',
        latencyMs: Date.now() - start,
        message: `Jira returned status ${response.status}`,
        timestamp: new Date().toISOString(),
      };
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    const latencyMs = Date.now() - start;
    if (err instanceof ConnectorValidationError) throw err;
    const message = err instanceof Error ? err.message : 'Unknown error';

    if (message.includes('abort') || message.includes('timeout')) {
      return {
        connectorId: config.id,
        connectorType: 'jira',
        status: 'unhealthy',
        latencyMs,
        errorCode: 'CVE-200',
        message: 'Connection timeout to Jira',
        timestamp: new Date().toISOString(),
      };
    }

    return {
      connectorId: config.id,
      connectorType: 'jira',
      status: 'unhealthy',
      latencyMs,
      errorCode: 'CVE-201',
      message: `Failed to connect to Jira: ${message}`,
      timestamp: new Date().toISOString(),
    };
  }
}
