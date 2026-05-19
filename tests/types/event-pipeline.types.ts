/**
 * Event Pipeline Types
 * 
 * TypeScript types for harness invocation through the event pipeline.
 * These types define the contract between the test and the event pipeline infrastructure.
 */

/**
 * Command to invoke a harness via the event pipeline
 */
export interface InvokeHarnessCommand {
  command: 'InvokeHarness';
  harnessArn: string;
  input: unknown;
  metadata?: {
    workflowId?: string;
    correlationId?: string;
    timestamp?: string;
    timeout?: number; // milliseconds
  };
}

/**
 * Response from a harness invocation
 */
export interface HarnessInvocationResponse {
  status: 'success' | 'failure';
  harnessInvoked: boolean;
  agentId: string;
  invocationId: string;
  executionMetadata?: {
    duration?: number;
    region?: string;
    timestamp?: string;
  };
  error?: HarnessInvocationError;
}

/**
 * Error details for failed harness invocations
 */
export interface HarnessInvocationError {
  code: HarnessErrorCode;
  message: string;
  details?: unknown;
  attemptedArn?: string;
}

/**
 * Standard error codes for harness invocation failures
 */
export type HarnessErrorCode =
  | 'INVALID_ARN_FORMAT'
  | 'RESOURCE_NOT_FOUND'
  | 'ACCESS_DENIED'
  | 'TIMEOUT'
  | 'VALIDATION_ERROR'
  | 'INTERNAL_ERROR';

/**
 * Parsed components of a harness ARN
 */
export interface ParsedHarnessArn {
  service: string;        // "bedrock-runtime"
  region: string;         // e.g., "us-east-1"
  account: string;        // AWS account ID
  resourceType: string;   // "harness"
  harnessId: string;      // Harness identifier
}