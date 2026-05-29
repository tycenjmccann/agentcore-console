import { ValidationErrorCode } from './types';

export const ERROR_HINTS: Record<ValidationErrorCode, { title: string; hint: string; action: string }> = {
  [ValidationErrorCode.SCHEMA_ERROR]: {
    title: 'Configuration Error',
    hint: 'The connector configuration is missing required fields or has invalid values.',
    action: 'Review the connector configuration and ensure all required fields are filled correctly.',
  },
  [ValidationErrorCode.CREDENTIAL_ERROR]: {
    title: 'Credential Error',
    hint: 'The provided credentials could not be retrieved or decrypted.',
    action: 'Verify the secret ARN is correct and that the execution role has permissions to access it.',
  },
  [ValidationErrorCode.CONNECTIVITY_ERROR]: {
    title: 'Connectivity Error',
    hint: 'Unable to establish a connection to the target service.',
    action: 'Check that the service URL is correct, the service is running, and network/firewall rules allow access.',
  },
  [ValidationErrorCode.AUTH_ERROR]: {
    title: 'Authentication Failed',
    hint: 'The credentials were rejected by the target service.',
    action: 'Verify the API token/key is valid, not expired, and belongs to the correct account.',
  },
  [ValidationErrorCode.PERMISSION_ERROR]: {
    title: 'Insufficient Permissions',
    hint: 'The credentials are valid but lack required permissions.',
    action: 'Ensure the token/role has the necessary scopes or policies for the operations this connector needs.',
  },
  [ValidationErrorCode.TIMEOUT_ERROR]: {
    title: 'Request Timeout',
    hint: 'The validation request timed out waiting for a response.',
    action: 'The service may be slow or overloaded. Try again in a few minutes.',
  },
  [ValidationErrorCode.SERVICE_ERROR]: {
    title: 'Service Error',
    hint: 'The target service returned an unexpected error.',
    action: 'Check the target service status page. This is usually a temporary issue.',
  },
  [ValidationErrorCode.INTERNAL_ERROR]: {
    title: 'Internal Error',
    hint: 'An unexpected error occurred during validation.',
    action: 'This is a system error. If it persists, contact support.',
  },
};

export function getErrorHint(code: ValidationErrorCode): { title: string; hint: string; action: string } {
  return ERROR_HINTS[code] || ERROR_HINTS[ValidationErrorCode.INTERNAL_ERROR];
}
