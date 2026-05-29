import { ConnectorConfig, ValidationResult, DynamoDBConfig } from '../types';
import { ConnectorValidationError } from '../errors';

export async function validateDynamoDB(config: ConnectorConfig, timeout: number): Promise<ValidationResult> {
  const start = Date.now();
  const dynamoConfig = config.config as DynamoDBConfig;
  const region = dynamoConfig.region || config.region || process.env.AWS_REGION || 'us-east-1';

  if (!dynamoConfig.tableName) {
    throw new ConnectorValidationError('CVE-401', 'tableName is required for DynamoDB connector');
  }

  try {
    const { DynamoDBClient, DescribeTableCommand } = await import('@aws-sdk/client-dynamodb');
    const client = new DynamoDBClient({ region });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await client.send(new DescribeTableCommand({
        TableName: dynamoConfig.tableName,
      }), { abortSignal: controller.signal });

      const tableStatus = response.Table?.TableStatus;
      const status = tableStatus === 'ACTIVE' ? 'healthy' : tableStatus === 'UPDATING' ? 'degraded' : 'unhealthy';

      return {
        connectorId: config.id,
        connectorType: 'dynamodb',
        status,
        latencyMs: Date.now() - start,
        message: tableStatus !== 'ACTIVE' ? `Table status: ${tableStatus}` : undefined,
        timestamp: new Date().toISOString(),
      };
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    const latencyMs = Date.now() - start;
    const message = err instanceof Error ? err.message : 'Unknown error';

    if (message.includes('ResourceNotFoundException') || message.includes('not found')) {
      return {
        connectorId: config.id,
        connectorType: 'dynamodb',
        status: 'unhealthy',
        latencyMs,
        errorCode: 'CVE-300',
        message: `Table not found: ${dynamoConfig.tableName}`,
        timestamp: new Date().toISOString(),
      };
    }

    if (message.includes('AccessDenied')) {
      return {
        connectorId: config.id,
        connectorType: 'dynamodb',
        status: 'unhealthy',
        latencyMs,
        errorCode: 'CVE-301',
        message: 'Access denied to DynamoDB table',
        timestamp: new Date().toISOString(),
      };
    }

    return {
      connectorId: config.id,
      connectorType: 'dynamodb',
      status: 'unhealthy',
      latencyMs,
      errorCode: 'CVE-200',
      message,
      timestamp: new Date().toISOString(),
    };
  }
}
