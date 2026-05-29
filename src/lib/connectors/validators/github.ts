import { ConnectorConfig, ValidationResult, GitHubConfig } from '../types';
import { ConnectorValidationError } from '../errors';
import { resolveSecret } from '../secret-resolver';

export async function validateGitHub(config: ConnectorConfig, timeout: number): Promise<ValidationResult> {
  const start = Date.now();
  const githubConfig = config.config as GitHubConfig;

  if (!githubConfig.owner || !githubConfig.repo) {
    throw new ConnectorValidationError('CVE-401', 'owner and repo are required for GitHub connector');
  }

  try {
    let headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'agentcore-connector-validator',
    };

    if (githubConfig.credentialArn || config.credentialArn) {
      const arn = githubConfig.credentialArn || config.credentialArn!;
      const token = await resolveSecret(arn);
      headers['Authorization'] = `Bearer ${token}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(
        `https://api.github.com/repos/${githubConfig.owner}/${githubConfig.repo}`,
        { headers, signal: controller.signal }
      );

      if (response.ok) {
        return {
          connectorId: config.id,
          connectorType: 'github',
          status: 'healthy',
          latencyMs: Date.now() - start,
          timestamp: new Date().toISOString(),
        };
      }

      if (response.status === 401) {
        return {
          connectorId: config.id,
          connectorType: 'github',
          status: 'unhealthy',
          latencyMs: Date.now() - start,
          errorCode: 'CVE-103',
          message: 'GitHub authentication failed',
          timestamp: new Date().toISOString(),
        };
      }

      if (response.status === 404) {
        return {
          connectorId: config.id,
          connectorType: 'github',
          status: 'unhealthy',
          latencyMs: Date.now() - start,
          errorCode: 'CVE-300',
          message: `Repository not found: ${githubConfig.owner}/${githubConfig.repo}`,
          timestamp: new Date().toISOString(),
        };
      }

      if (response.status === 403) {
        const remaining = response.headers.get('x-ratelimit-remaining');
        if (remaining === '0') {
          return {
            connectorId: config.id,
            connectorType: 'github',
            status: 'degraded',
            latencyMs: Date.now() - start,
            errorCode: 'CVE-303',
            message: 'GitHub API rate limit exceeded',
            timestamp: new Date().toISOString(),
          };
        }
        return {
          connectorId: config.id,
          connectorType: 'github',
          status: 'unhealthy',
          latencyMs: Date.now() - start,
          errorCode: 'CVE-301',
          message: 'Access denied to GitHub repository',
          timestamp: new Date().toISOString(),
        };
      }

      return {
        connectorId: config.id,
        connectorType: 'github',
        status: 'degraded',
        latencyMs: Date.now() - start,
        message: `GitHub API returned status ${response.status}`,
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
        connectorType: 'github',
        status: 'unhealthy',
        latencyMs,
        errorCode: 'CVE-200',
        message: 'Connection timeout to GitHub',
        timestamp: new Date().toISOString(),
      };
    }

    return {
      connectorId: config.id,
      connectorType: 'github',
      status: 'unhealthy',
      latencyMs,
      errorCode: 'CVE-201',
      message: `Failed to connect to GitHub: ${message}`,
      timestamp: new Date().toISOString(),
    };
  }
}
