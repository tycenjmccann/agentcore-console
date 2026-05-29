import { describe, it, expect } from 'vitest';
import { ConnectorValidationError, CONNECTOR_ERRORS } from '../errors';

describe('ConnectorValidationError', () => {
  it('creates error with correct code and message', () => {
    const err = new ConnectorValidationError('CVE-100');
    expect(err.code).toBe('CVE-100');
    expect(err.message).toBe('Invalid credential ARN format');
    expect(err.httpStatus).toBe(400);
    expect(err.retryable).toBe(false);
  });

  it('appends detail to message', () => {
    const err = new ConnectorValidationError('CVE-101', 'param not found');
    expect(err.message).toBe('Credential not found in SSM/Secrets Manager: param not found');
  });

  it('handles unknown error code gracefully', () => {
    const err = new ConnectorValidationError('CVE-999');
    expect(err.code).toBe('CVE-999');
    expect(err.httpStatus).toBe(500);
  });

  it('has correct name property', () => {
    const err = new ConnectorValidationError('CVE-200');
    expect(err.name).toBe('ConnectorValidationError');
    expect(err instanceof Error).toBe(true);
  });
});

describe('CONNECTOR_ERRORS', () => {
  it('has all error categories', () => {
    // Auth errors (1xx)
    expect(CONNECTOR_ERRORS['CVE-100']).toBeDefined();
    expect(CONNECTOR_ERRORS['CVE-104']).toBeDefined();

    // Connectivity errors (2xx)
    expect(CONNECTOR_ERRORS['CVE-200']).toBeDefined();
    expect(CONNECTOR_ERRORS['CVE-204']).toBeDefined();

    // Resource errors (3xx)
    expect(CONNECTOR_ERRORS['CVE-300']).toBeDefined();
    expect(CONNECTOR_ERRORS['CVE-303']).toBeDefined();

    // Config errors (4xx)
    expect(CONNECTOR_ERRORS['CVE-400']).toBeDefined();
    expect(CONNECTOR_ERRORS['CVE-403']).toBeDefined();

    // Rate limiting (5xx)
    expect(CONNECTOR_ERRORS['CVE-500']).toBeDefined();
    expect(CONNECTOR_ERRORS['CVE-501']).toBeDefined();
  });

  it('connectivity errors are retryable', () => {
    expect(CONNECTOR_ERRORS['CVE-200'].retryable).toBe(true);
    expect(CONNECTOR_ERRORS['CVE-201'].retryable).toBe(true);
  });

  it('auth errors are not retryable', () => {
    expect(CONNECTOR_ERRORS['CVE-100'].retryable).toBe(false);
    expect(CONNECTOR_ERRORS['CVE-104'].retryable).toBe(false);
  });
});
