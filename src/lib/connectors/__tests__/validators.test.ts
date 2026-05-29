import { describe, it, expect } from 'vitest';
import { validateConnector } from '../validators';
import { ConnectorConfig } from '../types';

describe('validateConnector', () => {
  it('returns error for unsupported connector type', async () => {
    const config: ConnectorConfig = {
      type: 'unknown' as any,
      id: 'test-1',
      config: {},
    };

    const result = await validateConnector(config, 5000);
    expect(result.status).toBe('error');
    expect(result.errorCode).toBe('CVE-403');
    expect(result.connectorId).toBe('test-1');
  });

  it('returns error for missing required field (DynamoDB)', async () => {
    const config: ConnectorConfig = {
      type: 'dynamodb',
      id: 'test-ddb',
      config: { tableName: '' },
    };

    const result = await validateConnector(config, 5000);
    expect(result.status).toBe('error');
    expect(result.errorCode).toBe('CVE-401');
  });

  it('returns error for missing required field (Lambda)', async () => {
    const config: ConnectorConfig = {
      type: 'lambda',
      id: 'test-lambda',
      config: { functionArn: '' },
    };

    const result = await validateConnector(config, 5000);
    expect(result.status).toBe('error');
    expect(result.errorCode).toBe('CVE-401');
  });

  it('returns error for invalid Lambda ARN', async () => {
    const config: ConnectorConfig = {
      type: 'lambda',
      id: 'test-lambda',
      config: { functionArn: 'not-a-valid-arn' },
    };

    const result = await validateConnector(config, 5000);
    expect(result.status).toBe('error');
    expect(result.errorCode).toBe('CVE-402');
  });

  it('returns error for missing S3 bucket name', async () => {
    const config: ConnectorConfig = {
      type: 's3',
      id: 'test-s3',
      config: { bucketName: '' },
    };

    const result = await validateConnector(config, 5000);
    expect(result.status).toBe('error');
    expect(result.errorCode).toBe('CVE-401');
  });

  it('returns error for missing Bedrock modelId', async () => {
    const config: ConnectorConfig = {
      type: 'bedrock',
      id: 'test-bedrock',
      config: { modelId: '' },
    };

    const result = await validateConnector(config, 5000);
    expect(result.status).toBe('error');
    expect(result.errorCode).toBe('CVE-401');
  });

  it('returns error for Jira without baseUrl', async () => {
    const config: ConnectorConfig = {
      type: 'jira',
      id: 'test-jira',
      config: { baseUrl: '', projectKey: 'TEST', credentialArn: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:test' },
    };

    const result = await validateConnector(config, 5000);
    expect(result.status).toBe('error');
    expect(result.errorCode).toBe('CVE-401');
  });

  it('returns error for GitHub without owner/repo', async () => {
    const config: ConnectorConfig = {
      type: 'github',
      id: 'test-github',
      config: { owner: '', repo: '' },
    };

    const result = await validateConnector(config, 5000);
    expect(result.status).toBe('error');
    expect(result.errorCode).toBe('CVE-401');
  });

  it('includes latencyMs and timestamp in results', async () => {
    const config: ConnectorConfig = {
      type: 'dynamodb',
      id: 'test-timing',
      config: { tableName: '' },
    };

    const result = await validateConnector(config, 5000);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
