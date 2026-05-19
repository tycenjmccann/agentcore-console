/**
 * Integration Tests: Event Pipeline Harness Invocation (v3)
 * 
 * Tests InvokeHarnessCommand via the event pipeline.
 * v3 addresses all ARN-related issues from v1/v2.
 * 
 * ARN Format (v3 fix): arn:aws:bedrock-runtime:{region}:{account}:harness/{harness-id}
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isValidHarnessArn,
  parseHarnessArn,
  extractHarnessId,
  validateHarnessArn,
  getArnFormatDescription,
} from '../helpers/harness-arn-validator';
import { EventPipelineClient } from '../helpers/event-pipeline-client';
import {
  VALID_HARNESS_ARNS,
  INVALID_HARNESS_ARNS,
  createValidInvokeCommand,
  createInvalidArnCommand,
  MOCK_SUCCESS_RESPONSE,
} from '../fixtures/harness-test-fixtures';
import type { HarnessInvocationResponse } from '../types/event-pipeline.types';

// =============================================================================
// Suite 1: ARN Validation (6 tests)
// =============================================================================

describe('ARN Validation', () => {
  it('validates correct harness ARN format', () => {
    expect(isValidHarnessArn(VALID_HARNESS_ARNS.requirementsAnalyst)).toBe(true);
    expect(isValidHarnessArn(VALID_HARNESS_ARNS.backendDev)).toBe(true);
    expect(isValidHarnessArn(VALID_HARNESS_ARNS.withHyphens)).toBe(true);
    expect(isValidHarnessArn(VALID_HARNESS_ARNS.withNumbers)).toBe(true);
  });

  it('parses valid ARN into components', () => {
    const parsed = parseHarnessArn(VALID_HARNESS_ARNS.requirementsAnalyst);
    expect(parsed.service).toBe('bedrock-runtime');
    expect(parsed.resourceType).toBe('harness');
    expect(parsed.harnessId).toBe('team-requirements-analyst');
    expect(parsed.region).toBeTruthy();
    expect(parsed.account).toBeTruthy();
  });

  it('extracts harness ID from ARN', () => {
    const harnessId = extractHarnessId(VALID_HARNESS_ARNS.requirementsAnalyst);
    expect(harnessId).toBe('team-requirements-analyst');
  });

  it('rejects invalid ARN formats', () => {
    // v1 mistake: wrong service
    expect(isValidHarnessArn(INVALID_HARNESS_ARNS.wrongServiceBedrock)).toBe(false);
    // v2 mistake: wrong service variant
    expect(isValidHarnessArn(INVALID_HARNESS_ARNS.wrongServiceBedrockAgent)).toBe(false);
    // Missing components
    expect(isValidHarnessArn(INVALID_HARNESS_ARNS.missingRegion)).toBe(false);
    expect(isValidHarnessArn(INVALID_HARNESS_ARNS.missingAccount)).toBe(false);
    expect(isValidHarnessArn(INVALID_HARNESS_ARNS.missingHarnessId)).toBe(false);
    expect(isValidHarnessArn(INVALID_HARNESS_ARNS.wrongPrefix)).toBe(false);
    expect(isValidHarnessArn(INVALID_HARNESS_ARNS.plainString)).toBe(false);
    expect(isValidHarnessArn(INVALID_HARNESS_ARNS.emptyString)).toBe(false);
  });

  it('rejects null/undefined ARN', () => {
    expect(isValidHarnessArn(null)).toBe(false);
    expect(isValidHarnessArn(undefined)).toBe(false);
  });

  it('throws error for invalid ARN when using strict validation', () => {
    expect(() => validateHarnessArn(INVALID_HARNESS_ARNS.wrongServiceBedrock))
      .toThrow(/bedrock-runtime/);
    expect(() => validateHarnessArn(null))
      .toThrow(/null or undefined/);
    expect(() => validateHarnessArn(undefined))
      .toThrow(/null or undefined/);
    expect(() => validateHarnessArn(''))
      .toThrow(/non-empty string/);
  });
});

// =============================================================================
// Suite 2: Successful Invocation (1 test)
// =============================================================================

describe('Successful Invocation', () => {
  it('InvokeHarnessCommand with valid ARN invokes requirements agent successfully', async () => {
    const client = new EventPipelineClient({ timeoutMs: 30_000 });
    const command = createValidInvokeCommand();

    // Mock the SDK call to avoid real AWS invocation in unit tests
    vi.spyOn(client as any, 'invokeWithSdk').mockResolvedValue(MOCK_SUCCESS_RESPONSE);

    const response: HarnessInvocationResponse = await client.invokeHarness(command);

    expect(response.status).toBe('success');
    expect(response.harnessInvoked).toBe(true);
    expect(response.agentId).toBe('team-requirements-analyst');
    expect(response.invocationId).toBeTruthy();
    expect(response.error).toBeUndefined();
  });
});

// =============================================================================
// Suite 3: Negative Test Cases (8 tests)
// =============================================================================

describe('Negative Test Cases', () => {
  let client: EventPipelineClient;

  beforeEach(() => {
    client = new EventPipelineClient({ timeoutMs: 5_000 });
  });

  it('handles invalid ARN format gracefully', async () => {
    const command = createInvalidArnCommand(INVALID_HARNESS_ARNS.wrongServiceBedrock);
    const response = await client.invokeHarness(command);

    expect(response.status).toBe('failure');
    expect(response.harnessInvoked).toBe(false);
    expect(response.error?.code).toBe('VALIDATION_ERROR');
    expect(response.error?.message).toContain('bedrock-runtime');
    expect(response.error?.attemptedArn).toBe(INVALID_HARNESS_ARNS.wrongServiceBedrock);
  });

  it('handles missing ARN prefix', async () => {
    const command = createInvalidArnCommand(INVALID_HARNESS_ARNS.wrongPrefix);
    const response = await client.invokeHarness(command);

    expect(response.status).toBe('failure');
    expect(response.harnessInvoked).toBe(false);
    expect(response.error?.code).toBe('VALIDATION_ERROR');
    expect(response.error?.message).toContain('arn:aws:');
  });

  it('handles wrong service in ARN', async () => {
    const command = createInvalidArnCommand(INVALID_HARNESS_ARNS.wrongServiceBedrockAgent);
    const response = await client.invokeHarness(command);

    expect(response.status).toBe('failure');
    expect(response.error?.code).toBe('VALIDATION_ERROR');
  });

  it('handles null ARN', async () => {
    const command = createValidInvokeCommand({ harnessArn: null as unknown as string });
    const response = await client.invokeHarness(command);

    expect(response.status).toBe('failure');
    expect(response.error?.code).toBe('VALIDATION_ERROR');
    expect(response.error?.message).toContain('null or undefined');
  });

  it('handles undefined ARN', async () => {
    const command = createValidInvokeCommand({ harnessArn: undefined as unknown as string });
    const response = await client.invokeHarness(command);

    expect(response.status).toBe('failure');
    expect(response.error?.code).toBe('VALIDATION_ERROR');
    expect(response.error?.message).toContain('null or undefined');
  });

  it('handles non-existent harness (valid ARN format)', async () => {
    vi.spyOn(client as any, 'invokeWithSdk').mockRejectedValue(
      new Error('ResourceNotFoundException: Agent not found')
    );

    const command = createValidInvokeCommand();
    const response = await client.invokeHarness(command);

    expect(response.status).toBe('failure');
    expect(response.harnessInvoked).toBe(false);
    expect(response.error?.code).toBe('RESOURCE_NOT_FOUND');
    expect(response.error?.message).toContain(VALID_HARNESS_ARNS.requirementsAnalyst);
  });

  it('handles timeout gracefully', async () => {
    // Use a very short timeout and a slow mock
    const fastTimeoutClient = new EventPipelineClient({ timeoutMs: 100 });
    vi.spyOn(fastTimeoutClient as any, 'invokeWithSdk').mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 5_000))
    );

    const command = createValidInvokeCommand();
    const response = await fastTimeoutClient.invokeHarness(command);

    expect(response.status).toBe('failure');
    expect(response.error?.code).toBe('TIMEOUT');
    expect(response.error?.message).toContain('timed out');
  }, 10_000);

  it('handles access denied error', async () => {
    vi.spyOn(client as any, 'invokeWithSdk').mockRejectedValue(
      new Error('AccessDeniedException: User is not authorized to perform bedrock-runtime:InvokeAgent')
    );

    const command = createValidInvokeCommand();
    const response = await client.invokeHarness(command);

    expect(response.status).toBe('failure');
    expect(response.error?.code).toBe('ACCESS_DENIED');
    expect(response.error?.message).toContain('IAM');
  });
});

// =============================================================================
// Suite 4: Response Validation (2 tests)
// =============================================================================

describe('Response Validation', () => {
  it('successful response contains all required fields', async () => {
    const client = new EventPipelineClient();
    vi.spyOn(client as any, 'invokeWithSdk').mockResolvedValue(MOCK_SUCCESS_RESPONSE);

    const command = createValidInvokeCommand();
    const response = await client.invokeHarness(command);

    // Required fields
    expect(response).toHaveProperty('status');
    expect(response).toHaveProperty('harnessInvoked');
    expect(response).toHaveProperty('agentId');
    expect(response).toHaveProperty('invocationId');
    // Values
    expect(['success', 'failure']).toContain(response.status);
    expect(typeof response.harnessInvoked).toBe('boolean');
    expect(typeof response.agentId).toBe('string');
    expect(typeof response.invocationId).toBe('string');
  });

  it('error response contains all required error fields', async () => {
    const client = new EventPipelineClient();
    const command = createInvalidArnCommand(INVALID_HARNESS_ARNS.wrongServiceBedrock);
    const response = await client.invokeHarness(command);

    expect(response.status).toBe('failure');
    expect(response.error).toBeDefined();
    expect(response.error).toHaveProperty('code');
    expect(response.error).toHaveProperty('message');
    expect(response.error).toHaveProperty('attemptedArn');
    expect(typeof response.error!.code).toBe('string');
    expect(typeof response.error!.message).toBe('string');
  });
});

// =============================================================================
// Suite 5: Logging and Debugging (1 test)
// =============================================================================

describe('Logging and Debugging', () => {
  it('logs invocation attempts for debugging', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const client = new EventPipelineClient();
    vi.spyOn(client as any, 'invokeWithSdk').mockResolvedValue(MOCK_SUCCESS_RESPONSE);

    const command = createValidInvokeCommand();
    await client.invokeHarness(command);

    // Verify logging occurred
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Invoking harness:'),
      expect.any(String)
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Harness ID:'),
      expect.any(String)
    );

    consoleSpy.mockRestore();
  });

  it('provides human-readable ARN format description', () => {
    const description = getArnFormatDescription();
    expect(description).toContain('bedrock-runtime');
    expect(description).toContain('harness');
    expect(description).toContain('arn:aws:');
  });
});