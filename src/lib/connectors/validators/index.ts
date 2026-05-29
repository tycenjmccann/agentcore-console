import { ConnectorConfig, ValidationResult, ConnectorType } from '../types';
import { ConnectorValidationError } from '../errors';
import { validateBedrock } from './bedrock';
import { validateLambda } from './lambda';
import { validateDynamoDB } from './dynamodb';
import { validateS3 } from './s3';
import { validateJira } from './jira';
import { validateGitHub } from './github';

export type ValidatorFn = (config: ConnectorConfig, timeout: number) => Promise<ValidationResult>;

const VALIDATORS: Record<ConnectorType, ValidatorFn> = {
  bedrock: validateBedrock,
  lambda: validateLambda,
  dynamodb: validateDynamoDB,
  s3: validateS3,
  jira: validateJira,
  github: validateGitHub,
};

export async function validateConnector(config: ConnectorConfig, timeout: number = 10000): Promise<ValidationResult> {
  const start = Date.now();
  const validator = VALIDATORS[config.type];

  if (!validator) {
    return {
      connectorId: config.id,
      connectorType: config.type,
      status: 'error',
      latencyMs: Date.now() - start,
      errorCode: 'CVE-403',
      message: `Unsupported connector type: ${config.type}`,
      timestamp: new Date().toISOString(),
    };
  }

  try {
    return await validator(config, timeout);
  } catch (err) {
    const latencyMs = Date.now() - start;
    if (err instanceof ConnectorValidationError) {
      return {
        connectorId: config.id,
        connectorType: config.type,
        status: 'error',
        latencyMs,
        errorCode: err.code,
        message: err.message,
        timestamp: new Date().toISOString(),
      };
    }
    return {
      connectorId: config.id,
      connectorType: config.type,
      status: 'error',
      latencyMs,
      errorCode: 'CVE-200',
      message: err instanceof Error ? err.message : 'Unknown validation error',
      timestamp: new Date().toISOString(),
    };
  }
}

export { validateBedrock } from './bedrock';
export { validateLambda } from './lambda';
export { validateDynamoDB } from './dynamodb';
export { validateS3 } from './s3';
export { validateJira } from './jira';
export { validateGitHub } from './github';
