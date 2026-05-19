/**
 * Event Pipeline Client
 * 
 * Client for invoking agent harnesses via the event pipeline.
 * Uses AWS SDK Bedrock Agent Runtime.
 */

import {
  BedrockAgentRuntimeClient,
  InvokeAgentCommand,
} from '@aws-sdk/client-bedrock-agent-runtime';
import type {
  InvokeHarnessCommand,
  HarnessInvocationResponse,
  HarnessInvocationError,
} from '../types/event-pipeline.types';
import { validateHarnessArn, parseHarnessArn } from './harness-arn-validator';

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_TIMEOUT_MS = 60_000;

export interface EventPipelineClientOptions {
  region?: string;
  timeoutMs?: number;
}

/**
 * Client for sending InvokeHarnessCommand events through the event pipeline.
 */
export class EventPipelineClient {
  private readonly client: BedrockAgentRuntimeClient;
  private readonly timeoutMs: number;

  constructor(options: EventPipelineClientOptions = {}) {
    const region = options.region ?? process.env.AWS_REGION ?? 'us-east-1';
    this.timeoutMs = Math.min(
      options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      MAX_TIMEOUT_MS
    );
    this.client = new BedrockAgentRuntimeClient({ region });
  }

  /**
   * Sends an InvokeHarnessCommand through the event pipeline.
   */
  async invokeHarness(command: InvokeHarnessCommand): Promise<HarnessInvocationResponse> {
    // Validate ARN before attempting invocation (fixes v1/v2 silent failures)
    validateHarnessArn(command.harnessArn);

    const parsed = parseHarnessArn(command.harnessArn);
    const startTime = Date.now();

    console.log(`[EventPipelineClient] Invoking harness: ${command.harnessArn}`);
    console.log(`[EventPipelineClient] Harness ID: ${parsed.harnessId}`);
    console.log(`[EventPipelineClient] Region: ${parsed.region}`);

    try {
      const result = await Promise.race([
        this.invokeWithSdk(command, parsed.harnessId),
        this.createTimeoutPromise(command.harnessArn),
      ]);

      const duration = Date.now() - startTime;
      console.log(`[EventPipelineClient] Invocation completed in ${duration}ms`);

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[EventPipelineClient] Invocation failed after ${duration}ms:`, error);
      return this.mapErrorToResponse(error, command.harnessArn);
    }
  }

  private async invokeWithSdk(
    command: InvokeHarnessCommand,
    agentId: string
  ): Promise<HarnessInvocationResponse> {
    const sessionId = command.metadata?.correlationId ?? `test-session-${Date.now()}`;

    const sdkCommand = new InvokeAgentCommand({
      agentId,
      agentAliasId: 'TSTALIASID',
      sessionId,
      inputText: JSON.stringify(command.input ?? {}),
    });

    const response = await this.client.send(sdkCommand);

    const invocationId = response.$metadata?.requestId ?? `inv-${Date.now()}`;

    return {
      status: 'success',
      harnessInvoked: true,
      agentId,
      invocationId,
      executionMetadata: {
        duration: undefined, // Set by caller
        region: process.env.AWS_REGION ?? 'us-east-1',
        timestamp: new Date().toISOString(),
      },
    };
  }

  private createTimeoutPromise(arn: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(
          `TimeoutError: Harness invocation timed out after ${this.timeoutMs}ms. ` +
          `ARN: ${arn}`
        ));
      }, this.timeoutMs);
    });
  }

  private mapErrorToResponse(
    error: unknown,
    attemptedArn: string
  ): HarnessInvocationResponse {
    const errorObj = error as Error;
    const message = errorObj?.message ?? 'Unknown error';

    let errorDetails: HarnessInvocationError;

    if (message.includes('TimeoutError') || message.includes('timed out')) {
      errorDetails = {
        code: 'TIMEOUT',
        message: `Harness invocation timed out after ${this.timeoutMs}ms`,
        attemptedArn,
      };
    } else if (message.includes('ResourceNotFoundException') || message.includes('not found')) {
      errorDetails = {
        code: 'RESOURCE_NOT_FOUND',
        message: `Harness not found. Verify the ARN exists: ${attemptedArn}`,
        attemptedArn,
        details: message,
      };
    } else if (message.includes('AccessDeniedException') || message.includes('access denied')) {
      errorDetails = {
        code: 'ACCESS_DENIED',
        message: 'Access denied. Check IAM permissions for bedrock-runtime:InvokeAgent',
        attemptedArn,
        details: message,
      };
    } else if (message.includes('ValidationError') || message.includes('ValidationException')) {
      errorDetails = {
        code: 'VALIDATION_ERROR',
        message,
        attemptedArn,
      };
    } else if (message.includes('INVALID_ARN')) {
      errorDetails = {
        code: 'INVALID_ARN_FORMAT',
        message,
        attemptedArn,
      };
    } else {
      errorDetails = {
        code: 'INTERNAL_ERROR',
        message: `Unexpected error: ${message}`,
        attemptedArn,
        details: message,
      };
    }

    return {
      status: 'failure',
      harnessInvoked: false,
      agentId: '',
      invocationId: '',
      error: errorDetails,
    };
  }
}