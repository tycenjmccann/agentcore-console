/**
 * Structured JSON logger with validationId correlation.
 * All log entries include validationId for tracing.
 */
export function createLogger(validationId) {
  const base = { validationId, service: 'connector-validator' };

  return {
    info: (message, extra = {}) => {
      console.log(JSON.stringify({ ...base, level: 'INFO', message, timestamp: new Date().toISOString(), ...sanitize(extra) }));
    },
    warn: (message, extra = {}) => {
      console.warn(JSON.stringify({ ...base, level: 'WARN', message, timestamp: new Date().toISOString(), ...sanitize(extra) }));
    },
    error: (message, extra = {}) => {
      console.error(JSON.stringify({ ...base, level: 'ERROR', message, timestamp: new Date().toISOString(), ...sanitize(extra) }));
    },
  };
}

/**
 * Sanitizes log data to prevent credential leakage.
 */
function sanitize(data) {
  const sensitiveKeys = ['token', 'apiToken', 'apiKey', 'password', 'secret', 'secretString', 'credentials', 'accessKeyId', 'secretAccessKey', 'sessionToken'];
  const sanitized = { ...data };

  for (const key of Object.keys(sanitized)) {
    if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk.toLowerCase()))) {
      sanitized[key] = '[REDACTED]';
    }
    if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitize(sanitized[key]);
    }
  }

  return sanitized;
}
