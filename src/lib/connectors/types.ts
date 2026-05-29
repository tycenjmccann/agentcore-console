export type ConnectorType = 'bedrock' | 'lambda' | 'dynamodb' | 's3' | 'jira' | 'github';

export interface ConnectorConfig {
  type: ConnectorType;
  id: string; // unique identifier for this connector instance
  name?: string; // human-readable name
  region?: string; // AWS region override
  // Credential reference - MUST be ARN to SSM/SecretsManager, never plaintext
  credentialArn?: string;
  // Type-specific configuration
  config: BedrockConfig | LambdaConfig | DynamoDBConfig | S3Config | JiraConfig | GitHubConfig;
}

export interface BedrockConfig {
  modelId: string;
  region?: string;
}

export interface LambdaConfig {
  functionArn: string;
  region?: string;
}

export interface DynamoDBConfig {
  tableName: string;
  region?: string;
}

export interface S3Config {
  bucketName: string;
  region?: string;
  prefix?: string;
}

export interface JiraConfig {
  baseUrl: string;
  projectKey: string;
  credentialArn: string; // Required - ARN to secrets manager
}

export interface GitHubConfig {
  owner: string;
  repo: string;
  credentialArn?: string; // ARN to token in secrets manager
}

export interface ValidationResult {
  connectorId: string;
  connectorType: ConnectorType;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'error';
  latencyMs: number;
  message?: string;
  errorCode?: string; // CVE-xxx code
  timestamp: string;
}

export interface BatchValidationRequest {
  connectors: ConnectorConfig[];
  timeout?: number; // per-connector timeout in ms, default 10000
}

export interface BatchValidationResponse {
  results: ValidationResult[];
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
    errors: number;
  };
  durationMs: number;
}

export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  connectors: ValidationResult[];
  cachedAt?: string;
  ttlSeconds: number;
}

export interface TestAuthRequest {
  connectorType: ConnectorType;
  credentialArn: string;
  config: Record<string, unknown>;
}

export interface TestAuthResponse {
  success: boolean;
  connectorType: ConnectorType;
  identity?: string; // e.g., AWS account ID, Jira user, GitHub user
  errorCode?: string;
  message?: string;
  latencyMs: number;
}
