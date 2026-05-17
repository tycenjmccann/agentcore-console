/**
 * Enhanced Harness Invocation with Model Configuration Support
 * 
 * This module extends the base invokeHarnessAgent function to support
 * per-invocation model overrides for dev agents.
 */

import {
  invokeHarnessAgent as baseInvokeHarnessAgent,
  DEFAULT_REGION,
} from './agentcore-sdk';
import { ModelConfig } from './types';
import {
  shouldReceiveModelOverride,
  modelConfigToInvokeParams,
  createModelSelectionLog,
} from './workflow-engine';

export interface InvokeHarnessWithModelParams {
  harnessArn: string;
  agentId: string;
  agentName: string;
  prompt: string;
  sessionId: string;
  systemPrompt?: string;
  history?: Array<{ role: string; content: string }>;
  modelConfig?: ModelConfig;
  region?: string;
}

/**
 * Invoke a harness agent with optional model configuration override.
 * 
 * If modelConfig is provided and the agent is a dev agent, the model
 * override is applied. System agents always use the default model.
 * 
 * @param params - Invocation parameters including optional modelConfig
 * @returns ReadableStream with agent response
 */
export async function invokeHarnessAgentWithModel(
  params: InvokeHarnessWithModelParams
): Promise<ReadableStream> {
  const region = params.region || DEFAULT_REGION;
  
  // Determine if model override should be applied
  const shouldOverride = shouldReceiveModelOverride(params.agentId);
  const effectiveModelConfig = shouldOverride && params.modelConfig
    ? params.modelConfig
    : undefined;

  // Log model selection for observability
  if (effectiveModelConfig) {
    const log = createModelSelectionLog(
      params.agentId,
      params.agentName,
      effectiveModelConfig,
      true
    );
    console.log(log);
  } else {
    console.log(
      `[Model Selection] Agent ${params.agentName} (${params.agentId}) using default model`
    );
  }

  // If no model override, use base function
  if (!effectiveModelConfig) {
    return baseInvokeHarnessAgent({
      harnessArn: params.harnessArn,
      prompt: params.prompt,
      sessionId: params.sessionId,
      systemPrompt: params.systemPrompt,
      history: params.history,
      region,
    });
  }

  // Apply model override
  const modelParams = modelConfigToInvokeParams(effectiveModelConfig);
  
  // Import AWS SDK for direct invocation with model override
  const { BedrockAgentCoreClient } = await import('@aws-sdk/client-bedrock-agentcore');
  const { InvokeHarnessCommand } = await import('@aws-sdk/client-bedrock-agentcore');
  
  const client = new BedrockAgentCoreClient({ region });
  const encoder = new TextEncoder();

  // Build messages array
  const messages: Array<{ role: 'user' | 'assistant'; content: Array<{ text: string }> }> = [];

  if (params.history && params.history.length > 0) {
    for (const msg of params.history) {
      messages.push({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: [{ text: msg.content }],
      });
    }
  }

  messages.push({ role: 'user', content: [{ text: params.prompt }] });

  // Build command input with model override
  const commandInput: Record<string, unknown> = {
    harnessArn: params.harnessArn,
    runtimeSessionId: params.sessionId,
    messages,
  };

  if (params.systemPrompt) {
    commandInput.system = [{ text: params.systemPrompt }];
  }

  // Add model override to command
  if (modelParams.modelOverride) {
    commandInput.modelOverride = modelParams.modelOverride;
  }

  const command = new InvokeHarnessCommand(commandInput);
  
  try {
    const response = await client.send(command);

    // Create streaming response
    return new ReadableStream({
      async start(controller) {
        try {
          let hasEmittedText = false;

          if (response.stream) {
            for await (const event of response.stream as AsyncIterable<Record<string, unknown>>) {
              if ('contentBlockDelta' in event) {
                const delta = event.contentBlockDelta as { delta?: { text?: string } };
                if (delta.delta?.text) {
                  hasEmittedText = true;
                  const data = JSON.stringify({ type: 'text', content: delta.delta.text });
                  controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                }
              } else if ('contentBlockStart' in event) {
                const block = event.contentBlockStart as {
                  start?: { toolUse?: { toolUseId?: string; name?: string } };
                };
                if (block.start?.toolUse) {
                  const trace = JSON.stringify({
                    type: 'trace',
                    event: 'tool_start',
                    name: block.start.toolUse.name,
                    toolUseId: block.start.toolUse.toolUseId,
                    timestamp: new Date().toISOString(),
                  });
                  controller.enqueue(encoder.encode(`data: ${trace}\n\n`));
                }
              } else if ('contentBlockStop' in event) {
                const trace = JSON.stringify({
                  type: 'trace',
                  event: 'block_stop',
                  timestamp: new Date().toISOString(),
                });
                controller.enqueue(encoder.encode(`data: ${trace}\n\n`));
              } else if ('messageStart' in event) {
                if (hasEmittedText) {
                  const sep = JSON.stringify({ type: 'text', content: '\n\n' });
                  controller.enqueue(encoder.encode(`data: ${sep}\n\n`));
                }
                const trace = JSON.stringify({
                  type: 'trace',
                  event: 'message_start',
                  timestamp: new Date().toISOString(),
                });
                controller.enqueue(encoder.encode(`data: ${trace}\n\n`));
              } else if ('messageStop' in event) {
                const trace = JSON.stringify({
                  type: 'trace',
                  event: 'message_stop',
                  timestamp: new Date().toISOString(),
                });
                controller.enqueue(encoder.encode(`data: ${trace}\n\n`));
              } else if ('metadata' in event) {
                const meta = event.metadata as {
                  usage?: { inputTokens?: number; outputTokens?: number };
                };
                if (meta.usage) {
                  const trace = JSON.stringify({
                    type: 'trace',
                    event: 'usage',
                    inputTokens: meta.usage.inputTokens,
                    outputTokens: meta.usage.outputTokens,
                    timestamp: new Date().toISOString(),
                  });
                  controller.enqueue(encoder.encode(`data: ${trace}\n\n`));
                }
              }
            }
          }
          
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
          controller.close();
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : 'Unknown error';
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'error', content: errMsg })}\n\n`)
          );
          controller.close();
        }
      },
    });
  } catch (err) {
    // If model override fails, log and fall back to default
    console.error(
      `[Model Override Error] Failed to invoke harness with model override, falling back to default:`,
      err
    );
    
    return baseInvokeHarnessAgent({
      harnessArn: params.harnessArn,
      prompt: params.prompt,
      sessionId: params.sessionId,
      systemPrompt: params.systemPrompt,
      history: params.history,
      region,
    });
  }
}
