/**
 * Harness ARN Validator
 * 
 * Utilities for validating and parsing AWS harness ARNs.
 * Correct format: arn:aws:bedrock-runtime:{region}:{account}:harness/{harness-id}
 * 
 * Fixes from v1/v2:
 * - v1: Used incorrect service name in ARN
 * - v2: Validation was too strict, rejecting valid ARNs
 * - v3: Comprehensive validation with clear error messages
 */

import type { ParsedHarnessArn } from '../types/event-pipeline.types';

// Correct ARN pattern: arn:aws:bedrock-runtime:{region}:{account}:harness/{harness-id}
const HARNESS_ARN_PATTERN = /^arn:aws:bedrock-runtime:([a-z0-9-]+):(\d{12}):harness\/([a-zA-Z0-9_-]+)$/;

/**
 * Validates whether a string is a correctly formatted harness ARN.
 */
export function isValidHarnessArn(arn: string | null | undefined): boolean {
  if (!arn || typeof arn !== 'string') {
    return false;
  }
  return HARNESS_ARN_PATTERN.test(arn);
}

/**
 * Parses a harness ARN into its component parts.
 * Throws if the ARN is invalid.
 */
export function parseHarnessArn(arn: string): ParsedHarnessArn {
  if (!arn) {
    throw new Error('ARN is required and cannot be null or undefined');
  }

  const match = HARNESS_ARN_PATTERN.exec(arn);
  if (!match) {
    throw new Error(
      `Invalid harness ARN format: "${arn}". ` +
      `Expected format: arn:aws:bedrock-runtime:{region}:{account}:harness/{harness-id}`
    );
  }

  return {
    service: 'bedrock-runtime',
    region: match[1],
    account: match[2],
    resourceType: 'harness',
    harnessId: match[3],
  };
}

/**
 * Extracts just the harness ID from a valid ARN.
 */
export function extractHarnessId(arn: string): string {
  const parsed = parseHarnessArn(arn);
  return parsed.harnessId;
}

/**
 * Formats a harness ARN from its component parts.
 */
export function formatHarnessArn(region: string, account: string, harnessId: string): string {
  return `arn:aws:bedrock-runtime:${region}:${account}:harness/${harnessId}`;
}

/**
 * Validates an ARN and throws a detailed error if invalid.
 * Use this before invoking a harness to get clear error messages.
 */
export function validateHarnessArn(arn: string | null | undefined): void {
  if (arn === null || arn === undefined) {
    throw new Error('ValidationError: Harness ARN cannot be null or undefined');
  }
  if (typeof arn !== 'string' || arn.trim() === '') {
    throw new Error('ValidationError: Harness ARN must be a non-empty string');
  }
  if (!arn.startsWith('arn:aws:')) {
    throw new Error(
      `ValidationError: ARN must start with "arn:aws:". Got: "${arn}"`
    );
  }
  if (!arn.includes('bedrock-runtime')) {
    throw new Error(
      `ValidationError: ARN service must be "bedrock-runtime". Got: "${arn}". ` +
      `Common mistake: using "bedrock" instead of "bedrock-runtime"`
    );
  }
  if (!isValidHarnessArn(arn)) {
    throw new Error(
      `ValidationError: Invalid harness ARN format: "${arn}". ` +
      `Expected: arn:aws:bedrock-runtime:{region}:{account-id}:harness/{harness-id}`
    );
  }
}

/**
 * Returns a human-readable description of the ARN format requirements.
 */
export function getArnFormatDescription(): string {
  return [
    'Harness ARN Format:',
    '  arn:aws:bedrock-runtime:{region}:{12-digit-account-id}:harness/{harness-id}',
    '',
    'Examples:',
    '  arn:aws:bedrock-runtime:us-east-1:123456789012:harness/team-requirements-analyst',
    '  arn:aws:bedrock-runtime:us-west-2:987654321098:harness/my-custom-agent',
    '',
    'Common Mistakes (from v1/v2):',
    '  ❌ arn:aws:bedrock:{region}:{account}:harness/{id}  (wrong service)',
    '  ❌ arn:aws:bedrock-agent:{region}:{account}:harness/{id}  (wrong service)',
    '  ✅ arn:aws:bedrock-runtime:{region}:{account}:harness/{id}  (correct)',
  ].join('\n');
}