export interface ConnectorError {
  code: string;
  message: string;
  httpStatus: number;
  retryable: boolean;
}

// CVE = Connector Validation Error
export const CONNECTOR_ERRORS: Record<string, ConnectorError> = {
  // Authentication errors (CVE-1xx)
  'CVE-100': { code: 'CVE-100', message: 'Invalid credential ARN format', httpStatus: 400, retryable: false },
  'CVE-101': { code: 'CVE-101', message: 'Credential not found in SSM/Secrets Manager', httpStatus: 404, retryable: false },
  'CVE-102': { code: 'CVE-102', message: 'Insufficient permissions to access credential', httpStatus: 403, retryable: false },
  'CVE-103': { code: 'CVE-103', message: 'Credential expired or revoked', httpStatus: 401, retryable: false },
  'CVE-104': { code: 'CVE-104', message: 'Plaintext secret detected in request', httpStatus: 400, retryable: false },

  // Connectivity errors (CVE-2xx)
  'CVE-200': { code: 'CVE-200', message: 'Connection timeout', httpStatus: 504, retryable: true },
  'CVE-201': { code: 'CVE-201', message: 'DNS resolution failed', httpStatus: 502, retryable: true },
  'CVE-202': { code: 'CVE-202', message: 'Connection refused', httpStatus: 502, retryable: true },
  'CVE-203': { code: 'CVE-203', message: 'SSL/TLS handshake failed', httpStatus: 502, retryable: false },
  'CVE-204': { code: 'CVE-204', message: 'SSRF detected - private IP range', httpStatus: 400, retryable: false },

  // Resource errors (CVE-3xx)
  'CVE-300': { code: 'CVE-300', message: 'Resource not found', httpStatus: 404, retryable: false },
  'CVE-301': { code: 'CVE-301', message: 'Resource access denied', httpStatus: 403, retryable: false },
  'CVE-302': { code: 'CVE-302', message: 'Resource in wrong region', httpStatus: 400, retryable: false },
  'CVE-303': { code: 'CVE-303', message: 'Resource limit exceeded', httpStatus: 429, retryable: true },

  // Configuration errors (CVE-4xx)
  'CVE-400': { code: 'CVE-400', message: 'Invalid connector configuration', httpStatus: 400, retryable: false },
  'CVE-401': { code: 'CVE-401', message: 'Missing required field', httpStatus: 400, retryable: false },
  'CVE-402': { code: 'CVE-402', message: 'Invalid ARN format', httpStatus: 400, retryable: false },
  'CVE-403': { code: 'CVE-403', message: 'Unsupported connector type', httpStatus: 400, retryable: false },

  // Rate limiting (CVE-5xx)
  'CVE-500': { code: 'CVE-500', message: 'Rate limit exceeded', httpStatus: 429, retryable: true },
  'CVE-501': { code: 'CVE-501', message: 'Concurrent validation limit reached', httpStatus: 429, retryable: true },
};

export class ConnectorValidationError extends Error {
  code: string;
  httpStatus: number;
  retryable: boolean;

  constructor(code: string, details?: string) {
    const errorDef = CONNECTOR_ERRORS[code] || { code, message: 'Unknown error', httpStatus: 500, retryable: false };
    super(details ? `${errorDef.message}: ${details}` : errorDef.message);
    this.name = 'ConnectorValidationError';
    this.code = code;
    this.httpStatus = errorDef.httpStatus;
    this.retryable = errorDef.retryable;
  }
}
