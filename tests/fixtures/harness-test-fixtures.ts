/**
 * Harness Test Fixtures
 * 
 * Test configuration, valid/invalid ARN examples, mock responses,
 * and factory functions for harness invocation tests.
 */

import type {
  InvokeHarnessCommand,
  HarnessInvocationResponse,
} from '../types/event-pipeline.types';
import { formatHarnessArn } from '../helpers/harness-arn-validator';

// Environment configuration
const TEST_REGION = process.env.AWS_REGION ?? 'us-east-1';
const TEST_ACCOUNT = process.env.AWS_ACCOUNT_ID ?? '123456789012';
const TEST_HARNESS_ID = 'team-requirements-analyst';

// =============================================================================
// Valid ARN Examples
// =============================================================================

export const VALID_HARNESS_ARNS = {
  requirementsAnalyst: formatHarnessArn(TEST_REGION, TEST_ACCOUNT, TEST_HARNESS_ID),
  backendDev: formatHarnessArn(TEST_REGION, TEST_ACCOUNT, 'team-backend-dev'),
  frontendDev: formatHarnessArn(TEST_REGION, TEST_ACCOUNT, 'team-frontend-dev'),
  withHyphens: formatHarnessArn('us-west-2', '987654321098', 'my-custom-agent-v2'),
  withNumbers: formatHarnessArn('eu-west-1', '111222333444', 'agent123'),
};

// =============================================================================
// Invalid ARN Examples (for negative testing)
// =============================================================================

export const INVALID_HARNESS_ARNS = {
  // v1 mistake: wrong service
  wrongServiceBedrock: `arn:aws:bedrock:${TEST_REGION}:${TEST_ACCOUNT}:harness/${TEST_HARNESS_ID}`,
  // v2 mistake: wrong service variant
  wrongServiceBedrockAgent: `arn:aws:bedrock-agent:${TEST_REGION}:${TEST_ACCOUNT}:harness/${TEST_HARNESS_ID}`,
  // Missing components
  missingRegion: `arn:aws:bedrock-runtime::${TEST_ACCOUNT}:harness/${TEST_HARNESS_ID}`,
  missingAccount: `arn:aws:bedrock-runtime:${TEST_REGION}::harness/${TEST_HARNESS_ID}`,
  missingHarnessId: `arn:aws:bedrock-runtime:${TEST_REGION}:${TEST_ACCOUNT}:harness/`,
  // Wrong prefix
  wrongPrefix: `aws:bedrock-runtime:${TEST_REGION}:${TEST_ACCOUNT}:harness/${TEST_HARNESS_ID}`,
  // Completely invalid
  plainString: 'not-an-arn',
  emptyString: '',
};

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a valid InvokeHarnessCommand for testing.
 */
export function createValidInvokeCommand(
  overrides: Partial<InvokeHarnessCommand> = {}
): InvokeHarnessCommand {
  return {
    command: 'InvokeHarness',
    harnessArn: VALID_HARNESS_ARNS.requirementsAnalyst,
    input: { message: 'Test invocation from event pipeline v3' },
    metadata: {
      workflowId: 'test-workflow-001',
      correlationId: `test-corr-${Date.now()}`,
      timestamp: new Date().toISOString(),
      timeout: 30000,
    },
    ...overrides,
  };
}

/**
 * Creates an InvokeHarnessCommand with an invalid ARN.
 */
export function createInvalidArnCommand(
  invalidArn: string
): InvokeHarnessCommand {
  return createValidInvokeCommand({ harnessArn: invalidArn });
}

// =============================================================================
// Mock Responses
// =============================================================================

export const MOCK_SUCCESS_RESPONSE: HarnessInvocationResponse = {
  status: 'success',
  harnessInvoked: true,
  agentId: TEST_HARNESS_ID,
  invocationId: 'mock-invocation-id-12345',
  executionMetadata: {
    duration: 1250,
    region: TEST_REGION,
    timestamp: new Date().toISOString(),
  },
};

export const MOCK_INVALID_ARN_RESPONSE: HarnessInvocationResponse = {
  status: 'failure',
  harnessInvoked: false,
  agentId: '',
  invocationId: '',
  error: {
    code: 'INVALID_ARN_FORMAT',
    message: 'Invalid harness ARN format',
    attemptedArn: INVALID_HARNESS_ARNS.wrongServiceBedrock,
  },
};

export const MOCK_NOT_FOUND_RESPONSE: HarnessInvocationResponse = {
  status: 'failure',
  harnessInvoked: false,
  agentId: '',
  invocationId: '',
  error: {
    code: 'RESOURCE_NOT_FOUND',
    message: 'Harness not found',
    attemptedArn: VALID_HARNESS_ARNS.requirementsAnalyst,
  },
};

export const MOCK_TIMEOUT_RESPONSE: HarnessInvocationResponse = {
  status: 'failure',
  harnessInvoked: false,
  agentId: '',
  invocationId: '',
  error: {
    code: 'TIMEOUT',
    message: 'Harness invocation timed out after 30000ms',
    attemptedArn: VALID_HARNESS_ARNS.requirementsAnalyst,
  },
};

export const MOCK_ACCESS_DENIED_RESPONSE: HarnessInvocationResponse = {
  status: 'failure',
  harnessInvoked: false,
  agentId: '',
  invocationId: '',
  error: {
    code: 'ACCESS_DENIED',
    message: 'Access denied. Check IAM permissions for bedrock-runtime:InvokeAgent',
    attemptedArn: VALID_HARNESS_ARNS.requirementsAnalyst,
  },
};