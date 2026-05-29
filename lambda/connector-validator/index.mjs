/**
 * Lambda: connector-validator
 * Triggered by EventBridge rule: source=agentcore.console, detailType=ConnectorValidationRequested
 *
 * Runs a fail-fast validation pipeline: Schema → Credentials → Connectivity → Functionality
 * Results are written to DynamoDB and detailed reports to S3.
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { validateConnector } from './pipeline.mjs';
import { checkCircuitBreaker, recordFailure, recordSuccess } from './circuit-breaker.mjs';
import { createLogger } from './logger.mjs';

const VALIDATION_TABLE = process.env.VALIDATION_TABLE || 'agentcore-connector-validations';
const REPORTS_BUCKET = process.env.VALIDATION_REPORTS_BUCKET || 'agentcore-validation-reports';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({});

export async function handler(event) {
  const detail = event.detail;
  const { validationId, agentId, connectorType, connectorConfig, credentials } = detail;
  const log = createLogger(validationId);

  log.info('Validation started', { agentId, connectorType });

  try {
    // Update status to IN_PROGRESS
    await updateStatus(validationId, 'IN_PROGRESS');

    // Check circuit breaker
    const cbState = await checkCircuitBreaker(connectorType, docClient, VALIDATION_TABLE);
    if (cbState.state === 'OPEN') {
      log.warn('Circuit breaker OPEN', { connectorType, openedAt: cbState.openedAt });
      await writeFailure(validationId, {
        code: 'SERVICE_ERROR',
        message: `Circuit breaker open for ${connectorType} — too many recent failures`,
        hint: 'The target service has been experiencing issues. Validation will resume automatically.',
        retryable: true,
      });
      return { statusCode: 503, body: 'Circuit breaker open' };
    }

    // Run validation pipeline (fail-fast)
    const results = await validateConnector({
      connectorType,
      connectorConfig,
      credentials,
      log,
    });

    // Write detailed report to S3
    const reportKey = `reports/${agentId}/${validationId}.json`;
    await s3Client.send(new PutObjectCommand({
      Bucket: REPORTS_BUCKET,
      Key: reportKey,
      Body: JSON.stringify({ validationId, agentId, connectorType, results, completedAt: new Date().toISOString() }),
      ContentType: 'application/json',
    }));

    // Determine overall status
    const failed = results.find(r => r.status === 'failed');
    const overallStatus = failed ? 'FAILED' : 'PASSED';

    // Update DynamoDB with results
    await docClient.send(new UpdateCommand({
      TableName: VALIDATION_TABLE,
      Key: { PK: `VALIDATION#${validationId}`, SK: 'STATUS' },
      UpdateExpression: 'SET #status = :status, results = :results, completedAt = :completedAt, reportUrl = :reportUrl',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':status': overallStatus,
        ':results': results,
        ':completedAt': new Date().toISOString(),
        ':reportUrl': `s3://${REPORTS_BUCKET}/${reportKey}`,
      },
    }));

    // Update circuit breaker
    if (failed) {
      await recordFailure(connectorType, docClient, VALIDATION_TABLE);
      log.info('Validation failed', { stage: failed.stage, error: failed.error });
    } else {
      await recordSuccess(connectorType, docClient, VALIDATION_TABLE);
      log.info('Validation passed', { stagesCompleted: results.length });
    }

    return { statusCode: 200, body: JSON.stringify({ validationId, status: overallStatus }) };
  } catch (err) {
    log.error('Validation error', { error: err.message, stack: err.stack });
    await writeFailure(validationId, {
      code: 'INTERNAL_ERROR',
      message: err.message || 'Unknown internal error',
      hint: 'An unexpected error occurred during validation.',
      retryable: true,
    });
    await recordFailure(connectorType, docClient, VALIDATION_TABLE);
    throw err; // Let Lambda retry / send to DLQ
  }
}

async function updateStatus(validationId, status) {
  await docClient.send(new UpdateCommand({
    TableName: VALIDATION_TABLE,
    Key: { PK: `VALIDATION#${validationId}`, SK: 'STATUS' },
    UpdateExpression: 'SET #status = :status, stage = :stage',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: { ':status': status, ':stage': 'schema' },
  }));
}

async function writeFailure(validationId, error) {
  await docClient.send(new UpdateCommand({
    TableName: VALIDATION_TABLE,
    Key: { PK: `VALIDATION#${validationId}`, SK: 'STATUS' },
    UpdateExpression: 'SET #status = :status, #error = :error, completedAt = :completedAt',
    ExpressionAttributeNames: { '#status': 'status', '#error': 'error' },
    ExpressionAttributeValues: {
      ':status': 'FAILED',
      ':error': error,
      ':completedAt': new Date().toISOString(),
    },
  }));
}
