export const VALIDATION_TABLE = process.env.VALIDATION_TABLE || 'agentcore-connector-validations';

export const VALIDATION_REPORTS_BUCKET = process.env.VALIDATION_REPORTS_BUCKET || 'agentcore-validation-reports';

export const EVENT_BUS_NAME = process.env.VALIDATION_EVENT_BUS || 'validation-events';
export const EVENT_SOURCE = 'agentcore.console';
export const EVENT_DETAIL_TYPE = 'ConnectorValidationRequested';

export const RATE_LIMIT_WINDOW_MS = 60_000;
export const RATE_LIMIT_MAX_REQUESTS = 10;

export const CIRCUIT_BREAKER_FAILURE_THRESHOLD = 5;
export const CIRCUIT_BREAKER_RECOVERY_TIMEOUT_MS = 60_000;

export const VALIDATION_RECORD_TTL_DAYS = 30;

export const ALLOWED_HOSTS = [
  'api.github.com',
  'github.com',
  '*.atlassian.net',
  '*.jira.com',
  '*.amazonaws.com',
  '*.anthropic.com',
];

export function isAllowedHost(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    return ALLOWED_HOSTS.some(pattern => {
      if (pattern.startsWith('*.')) {
        const suffix = pattern.slice(2);
        return hostname.endsWith(suffix) || hostname === suffix;
      }
      return hostname === pattern;
    });
  } catch {
    return false;
  }
}
