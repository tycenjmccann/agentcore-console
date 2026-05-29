export enum ValidationErrorCode {
  SCHEMA_ERROR = 'SCHEMA_ERROR',
  CREDENTIAL_ERROR = 'CREDENTIAL_ERROR',
  CONNECTIVITY_ERROR = 'CONNECTIVITY_ERROR',
  AUTH_ERROR = 'AUTH_ERROR',
  PERMISSION_ERROR = 'PERMISSION_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  SERVICE_ERROR = 'SERVICE_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

export enum ValidationStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  PASSED = 'PASSED',
  FAILED = 'FAILED',
  ERROR = 'ERROR',
}

export enum ConnectorType {
  GITHUB_MCP = 'github-mcp',
  JIRA = 'jira',
  S3_STORAGE = 's3-storage',
  CLAUDE_CODE = 'claude-code',
  CUSTOM_MCP = 'custom-mcp',
}

export enum ValidationStage {
  SCHEMA = 'schema',
  CREDENTIALS = 'credentials',
  CONNECTIVITY = 'connectivity',
  FUNCTIONALITY = 'functionality',
}

export interface ValidateConnectorRequest {
  connectorType: ConnectorType;
  agentId: string;
  connectorConfig: Record<string, unknown>;
  credentials?: {
    secretArn?: string;
  };
}

export interface SyncValidateRequest {
  connectorType: ConnectorType;
  connectorConfig: Record<string, unknown>;
}

export interface ValidationRecord {
  validationId: string;
  agentId: string;
  connectorType: ConnectorType;
  status: ValidationStatus;
  stage?: ValidationStage;
  startedAt: string;
  completedAt?: string;
  ttl?: number;
  results?: ValidationStageResult[];
  error?: ValidationError;
  reportUrl?: string;
}

export interface ValidationStageResult {
  stage: ValidationStage;
  status: 'passed' | 'failed' | 'skipped';
  durationMs: number;
  message?: string;
  error?: ValidationError;
}

export interface ValidationError {
  code: ValidationErrorCode;
  message: string;
  hint?: string;
  retryable: boolean;
}

export interface CircuitBreakerState {
  connectorType: ConnectorType;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
  lastFailureAt?: string;
  openedAt?: string;
  halfOpenAt?: string;
}

export interface ValidationHistoryQuery {
  agentId: string;
  limit?: number;
  startTime?: string;
  endTime?: string;
}

export interface DynamoDBKeys {
  PK: string;
  SK: string;
  GSI1PK?: string;
  GSI1SK?: string;
  GSI2PK?: string;
  GSI2SK?: string;
}
