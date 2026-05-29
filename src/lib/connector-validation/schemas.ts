import { ConnectorType, SyncValidateRequest, ValidationError, ValidationErrorCode } from './types';

interface SchemaField {
  type: string;
  required: boolean;
  description: string;
  pattern?: string;
  enum?: string[];
}

const CONNECTOR_SCHEMAS: Record<ConnectorType, Record<string, SchemaField>> = {
  [ConnectorType.GITHUB_MCP]: {
    owner: { type: 'string', required: true, description: 'GitHub repository owner' },
    repo: { type: 'string', required: false, description: 'GitHub repository name' },
    serverUrl: { type: 'string', required: true, pattern: '^https://', description: 'MCP server URL' },
    token: { type: 'string', required: true, description: 'GitHub personal access token (PAT) or app token' },
  },
  [ConnectorType.JIRA]: {
    baseUrl: { type: 'string', required: true, pattern: '^https://', description: 'Jira instance URL' },
    projectKey: { type: 'string', required: true, pattern: '^[A-Z][A-Z0-9]+$', description: 'Jira project key' },
    email: { type: 'string', required: true, pattern: '^[^@]+@[^@]+$', description: 'Atlassian account email' },
    apiToken: { type: 'string', required: true, description: 'Jira API token' },
  },
  [ConnectorType.S3_STORAGE]: {
    bucket: { type: 'string', required: true, pattern: '^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$', description: 'S3 bucket name' },
    region: { type: 'string', required: true, pattern: '^[a-z]{2}-[a-z]+-\\d$', description: 'AWS region' },
    prefix: { type: 'string', required: false, description: 'Object key prefix' },
    roleArn: { type: 'string', required: false, pattern: '^arn:aws:iam::', description: 'IAM role ARN for cross-account access' },
  },
  [ConnectorType.CLAUDE_CODE]: {
    serverUrl: { type: 'string', required: true, pattern: '^https://', description: 'Claude Code MCP server URL' },
    apiKey: { type: 'string', required: true, description: 'API key for Claude Code service' },
    workingDirectory: { type: 'string', required: false, description: 'Default working directory' },
  },
  [ConnectorType.CUSTOM_MCP]: {
    serverUrl: { type: 'string', required: true, pattern: '^https?://', description: 'Custom MCP server URL' },
    transportType: { type: 'string', required: true, enum: ['stdio', 'sse', 'streamable-http'], description: 'MCP transport type' },
    headers: { type: 'object', required: false, description: 'Custom HTTP headers' },
  },
};

export interface SchemaValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export function validateSchema(request: SyncValidateRequest): SchemaValidationResult {
  const schema = CONNECTOR_SCHEMAS[request.connectorType];
  if (!schema) {
    return {
      valid: false,
      errors: [{
        code: ValidationErrorCode.SCHEMA_ERROR,
        message: `Unknown connector type: ${request.connectorType}`,
        hint: `Supported types: ${Object.values(ConnectorType).join(', ')}`,
        retryable: false,
      }],
    };
  }

  const errors: ValidationError[] = [];
  const config = request.connectorConfig;

  for (const [field, fieldSchema] of Object.entries(schema)) {
    const value = config[field];

    if (fieldSchema.required && (value === undefined || value === null || value === '')) {
      errors.push({
        code: ValidationErrorCode.SCHEMA_ERROR,
        message: `Missing required field: ${field}`,
        hint: fieldSchema.description,
        retryable: false,
      });
      continue;
    }

    if (value === undefined || value === null) continue;

    if (fieldSchema.type === 'string' && typeof value !== 'string') {
      errors.push({
        code: ValidationErrorCode.SCHEMA_ERROR,
        message: `Field "${field}" must be a string, got ${typeof value}`,
        hint: fieldSchema.description,
        retryable: false,
      });
      continue;
    }

    if (fieldSchema.type === 'object' && (typeof value !== 'object' || Array.isArray(value))) {
      errors.push({
        code: ValidationErrorCode.SCHEMA_ERROR,
        message: `Field "${field}" must be an object`,
        hint: fieldSchema.description,
        retryable: false,
      });
      continue;
    }

    if (fieldSchema.pattern && typeof value === 'string') {
      const regex = new RegExp(fieldSchema.pattern);
      if (!regex.test(value)) {
        errors.push({
          code: ValidationErrorCode.SCHEMA_ERROR,
          message: `Field "${field}" does not match required pattern: ${fieldSchema.pattern}`,
          hint: fieldSchema.description,
          retryable: false,
        });
      }
    }

    if (fieldSchema.enum && typeof value === 'string' && !fieldSchema.enum.includes(value)) {
      errors.push({
        code: ValidationErrorCode.SCHEMA_ERROR,
        message: `Field "${field}" must be one of: ${fieldSchema.enum.join(', ')}`,
        hint: fieldSchema.description,
        retryable: false,
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

export function getConnectorSchema(connectorType: ConnectorType): Record<string, SchemaField> | null {
  return CONNECTOR_SCHEMAS[connectorType] || null;
}
