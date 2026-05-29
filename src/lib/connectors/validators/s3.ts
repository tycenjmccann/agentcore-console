import { ConnectorConfig, ValidationResult, S3Config } from '../types';
import { ConnectorValidationError } from '../errors';

export async function validateS3(config: ConnectorConfig, timeout: number): Promise<ValidationResult> {
  const start = Date.now();
  const s3Config = config.config as S3Config;
  const region = s3Config.region || config.region || process.env.AWS_REGION || 'us-east-1';

  if (!s3Config.bucketName) {
    throw new ConnectorValidationError('CVE-401', 'bucketName is required for S3 connector');
  }

  try {
    const { S3Client, HeadBucketCommand } = await import('@aws-sdk/client-s3');
    const client = new S3Client({ region });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      await client.send(new HeadBucketCommand({
        Bucket: s3Config.bucketName,
      }), { abortSignal: controller.signal });

      return {
        connectorId: config.id,
        connectorType: 's3',
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
    const errName = (err as { name?: string })?.name || '';

    if (errName === 'NotFound' || message.includes('NoSuchBucket') || message.includes('404')) {
      return {
        connectorId: config.id,
        connectorType: 's3',
        status: 'unhealthy',
        latencyMs,
        errorCode: 'CVE-300',
        message: `Bucket not found: ${s3Config.bucketName}`,
        timestamp: new Date().toISOString(),
      };
    }

    if (message.includes('AccessDenied') || message.includes('403')) {
      return {
        connectorId: config.id,
        connectorType: 's3',
        status: 'unhealthy',
        latencyMs,
        errorCode: 'CVE-301',
        message: 'Access denied to S3 bucket',
        timestamp: new Date().toISOString(),
      };
    }

    if (errName === 'PermanentRedirect' || message.includes('301')) {
      return {
        connectorId: config.id,
        connectorType: 's3',
        status: 'degraded',
        latencyMs,
        errorCode: 'CVE-302',
        message: `Bucket exists in a different region than ${region}`,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      connectorId: config.id,
      connectorType: 's3',
      status: 'unhealthy',
      latencyMs,
      errorCode: 'CVE-200',
      message,
      timestamp: new Date().toISOString(),
    };
  }
}
