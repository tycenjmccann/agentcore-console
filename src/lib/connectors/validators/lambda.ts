import { ConnectorConfig, ValidationResult, LambdaConfig } from '../types';
import { ConnectorValidationError } from '../errors';
import { validateArn } from '../secret-resolver';

export async function validateLambda(config: ConnectorConfig, timeout: number): Promise<ValidationResult> {
  const start = Date.now();
  const lambdaConfig = config.config as LambdaConfig;
  const region = lambdaConfig.region || config.region || process.env.AWS_REGION || 'us-east-1';

  if (!lambdaConfig.functionArn) {
    throw new ConnectorValidationError('CVE-401', 'functionArn is required for Lambda connector');
  }

  validateArn(lambdaConfig.functionArn, 'lambda');

  try {
    const { LambdaClient, GetFunctionCommand } = await import('@aws-sdk/client-lambda');
    const client = new LambdaClient({ region });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await client.send(new GetFunctionCommand({
        FunctionName: lambdaConfig.functionArn,
      }), { abortSignal: controller.signal });

      const state = response.Configuration?.State;
      const status = state === 'Active' ? 'healthy' : state === 'Pending' ? 'degraded' : 'unhealthy';

      return {
        connectorId: config.id,
        connectorType: 'lambda',
        status,
        latencyMs: Date.now() - start,
        message: state !== 'Active' ? `Function state: ${state}` : undefined,
        timestamp: new Date().toISOString(),
      };
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    const latencyMs = Date.now() - start;
    const message = err instanceof Error ? err.message : 'Unknown error';

    if (message.includes('ResourceNotFoundException') || message.includes('Function not found')) {
      return {
        connectorId: config.id,
        connectorType: 'lambda',
        status: 'unhealthy',
        latencyMs,
        errorCode: 'CVE-300',
        message: `Lambda function not found: ${lambdaConfig.functionArn}`,
        timestamp: new Date().toISOString(),
      };
    }

    if (message.includes('AccessDenied')) {
      return {
        connectorId: config.id,
        connectorType: 'lambda',
        status: 'unhealthy',
        latencyMs,
        errorCode: 'CVE-301',
        message: 'Access denied to Lambda function',
        timestamp: new Date().toISOString(),
      };
    }

    return {
      connectorId: config.id,
      connectorType: 'lambda',
      status: 'unhealthy',
      latencyMs,
      errorCode: 'CVE-200',
      message,
      timestamp: new Date().toISOString(),
    };
  }
}
