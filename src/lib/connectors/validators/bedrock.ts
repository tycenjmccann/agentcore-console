import { ConnectorConfig, ValidationResult, BedrockConfig } from '../types';
import { ConnectorValidationError } from '../errors';

export async function validateBedrock(config: ConnectorConfig, timeout: number): Promise<ValidationResult> {
  const start = Date.now();
  const bedrockConfig = config.config as BedrockConfig;
  const region = bedrockConfig.region || config.region || process.env.AWS_REGION || 'us-east-1';

  if (!bedrockConfig.modelId) {
    throw new ConnectorValidationError('CVE-401', 'modelId is required for Bedrock connector');
  }

  try {
    const { BedrockRuntimeClient, InvokeModelCommand } = await import('@aws-sdk/client-bedrock-runtime');
    const client = new BedrockRuntimeClient({ region });

    const testPayload = JSON.stringify({
      messages: [{ role: 'user', content: [{ text: 'hi' }] }],
      max_tokens: 1,
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      await client.send(new InvokeModelCommand({
        modelId: bedrockConfig.modelId,
        body: new TextEncoder().encode(testPayload),
        contentType: 'application/json',
      }), { abortSignal: controller.signal });

      return {
        connectorId: config.id,
        connectorType: 'bedrock',
        status: 'healthy',
        latencyMs: Date.now() - start,
        timestamp: new Date().toISOString(),
      };
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    const latencyMs = Date.now() - start;
    const message = err instanceof Error ? err.message : 'Unknown error';

    if (message.includes('AccessDenied') || message.includes('not authorized')) {
      return {
        connectorId: config.id,
        connectorType: 'bedrock',
        status: 'unhealthy',
        latencyMs,
        errorCode: 'CVE-301',
        message: `Access denied to model: ${bedrockConfig.modelId}`,
        timestamp: new Date().toISOString(),
      };
    }

    if (message.includes('ResourceNotFoundException') || message.includes('model') && message.includes('not found')) {
      return {
        connectorId: config.id,
        connectorType: 'bedrock',
        status: 'unhealthy',
        latencyMs,
        errorCode: 'CVE-300',
        message: `Model not found: ${bedrockConfig.modelId}`,
        timestamp: new Date().toISOString(),
      };
    }

    if (message.includes('ThrottlingException') || message.includes('TooManyRequests')) {
      return {
        connectorId: config.id,
        connectorType: 'bedrock',
        status: 'degraded',
        latencyMs,
        errorCode: 'CVE-303',
        message: 'Rate limited by Bedrock service',
        timestamp: new Date().toISOString(),
      };
    }

    if (message.includes('abort') || message.includes('timeout') || latencyMs >= timeout) {
      return {
        connectorId: config.id,
        connectorType: 'bedrock',
        status: 'unhealthy',
        latencyMs,
        errorCode: 'CVE-200',
        message: 'Connection timeout',
        timestamp: new Date().toISOString(),
      };
    }

    if (message.includes('ValidationException') || message.includes('malformed')) {
      return {
        connectorId: config.id,
        connectorType: 'bedrock',
        status: 'healthy',
        latencyMs,
        message: 'Service reachable (model may require different payload format)',
        timestamp: new Date().toISOString(),
      };
    }

    return {
      connectorId: config.id,
      connectorType: 'bedrock',
      status: 'unhealthy',
      latencyMs,
      errorCode: 'CVE-200',
      message,
      timestamp: new Date().toISOString(),
    };
  }
}
