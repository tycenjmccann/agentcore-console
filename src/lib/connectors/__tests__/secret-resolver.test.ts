import { describe, it, expect } from 'vitest';
import { validateCredentialArn, validateUrlSafety, validateArn } from '../secret-resolver';
import { ConnectorValidationError } from '../errors';

describe('validateCredentialArn', () => {
  it('accepts valid SSM ARN', () => {
    expect(() => validateCredentialArn(
      'arn:aws:ssm:us-east-1:123456789012:parameter/my/secret'
    )).not.toThrow();
  });

  it('accepts valid Secrets Manager ARN', () => {
    expect(() => validateCredentialArn(
      'arn:aws:secretsmanager:us-east-1:123456789012:secret:my-secret-abc123'
    )).not.toThrow();
  });

  it('rejects empty string', () => {
    expect(() => validateCredentialArn('')).toThrow(ConnectorValidationError);
  });

  it('rejects plaintext secrets', () => {
    expect(() => validateCredentialArn('my-plain-text-api-key')).toThrow(ConnectorValidationError);
    try {
      validateCredentialArn('sk-1234567890abcdef');
    } catch (err) {
      expect((err as ConnectorValidationError).code).toBe('CVE-104');
    }
  });

  it('rejects invalid ARN format', () => {
    expect(() => validateCredentialArn('arn:aws:invalid:format')).toThrow(ConnectorValidationError);
  });
});

describe('validateUrlSafety', () => {
  it('accepts valid public URLs', () => {
    expect(() => validateUrlSafety('https://mycompany.atlassian.net')).not.toThrow();
    expect(() => validateUrlSafety('https://api.github.com')).not.toThrow();
  });

  it('rejects localhost', () => {
    expect(() => validateUrlSafety('http://localhost:8080')).toThrow(ConnectorValidationError);
    try {
      validateUrlSafety('http://localhost/admin');
    } catch (err) {
      expect((err as ConnectorValidationError).code).toBe('CVE-204');
    }
  });

  it('rejects private IP ranges', () => {
    expect(() => validateUrlSafety('http://10.0.0.1')).toThrow(ConnectorValidationError);
    expect(() => validateUrlSafety('http://192.168.1.1')).toThrow(ConnectorValidationError);
    expect(() => validateUrlSafety('http://172.16.0.1')).toThrow(ConnectorValidationError);
    expect(() => validateUrlSafety('http://127.0.0.1')).toThrow(ConnectorValidationError);
  });

  it('rejects link-local addresses', () => {
    expect(() => validateUrlSafety('http://169.254.169.254')).toThrow(ConnectorValidationError);
  });

  it('rejects 0.0.0.0', () => {
    expect(() => validateUrlSafety('http://0.0.0.0')).toThrow(ConnectorValidationError);
  });
});

describe('validateArn', () => {
  it('accepts valid ARNs', () => {
    expect(() => validateArn('arn:aws:lambda:us-east-1:123456789012:function:my-func')).not.toThrow();
    expect(() => validateArn('arn:aws:s3:us-east-1:123456789012:my-bucket')).not.toThrow();
  });

  it('validates service when specified', () => {
    expect(() => validateArn(
      'arn:aws:lambda:us-east-1:123456789012:function:my-func', 'lambda'
    )).not.toThrow();

    expect(() => validateArn(
      'arn:aws:lambda:us-east-1:123456789012:function:my-func', 's3'
    )).toThrow(ConnectorValidationError);
  });

  it('rejects invalid ARN format', () => {
    expect(() => validateArn('not-an-arn')).toThrow(ConnectorValidationError);
    try {
      validateArn('invalid');
    } catch (err) {
      expect((err as ConnectorValidationError).code).toBe('CVE-402');
    }
  });
});
