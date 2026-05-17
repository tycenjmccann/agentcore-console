# Workflow Model Configuration Implementation

This implementation adds model configuration support to the workflow system, allowing workflows to specify which LLM model/provider agents should use.

## Overview

- **WorkflowState.modelConfig**: New optional field for storing model configuration
- **Workflow Engine**: Updated to read modelConfig and pass to InvokeHarnessCommand
- **Fallback Logic**: Defaults to Claude Sonnet 4.5 when modelConfig is undefined
- **Backward Compatibility**: Existing workflows without modelConfig continue to work

## Files Changed

### New Files

1. **src/types/workflow.ts**
   - WorkflowState interface with modelConfig property
   - ModelConfig type definition
   - Provider-specific config types (Bedrock, OpenAI, Gemini)
   - DEFAULT_MODEL_CONFIG constant
   - AVAILABLE_MODELS list

2. **src/lib/workflow-engine.ts**
   - WorkflowEngine class with model config support
   - buildModelParameter() - transforms ModelConfig to SDK format
   - getWorkflowModelConfig() - retrieves config with fallback
   - populateApiKeyArns() - fills ARNs from environment variables
   - Enhanced logging for model usage per workflow

3. **src/lib/workflow-persistence.ts**
   - Workflow state initialization with modelConfig
   - Migration helper for legacy workflows
   - Model config update utilities

4. **tests/workflow-engine.test.ts**
   - Comprehensive test suite
   - Tests for all model providers
   - Backward compatibility tests
   - Environment variable handling tests

## Usage

### Initialize Workflow with Model Config

```typescript
import { initializeWorkflowState } from '@/lib/workflow-persistence';
import { AVAILABLE_MODELS } from '@/types/workflow';

const workflowState = initializeWorkflowState({
  workflowId: 'wf_123',
  requirements: 'Build a new feature',
  tickets: [...],
  modelConfig: AVAILABLE_MODELS.find(m => m.modelId === 'gpt-5.5')
});
```

### Execute Workflow

```typescript
import { WorkflowEngine } from '@/lib/workflow-engine';

const engine = new WorkflowEngine();
const result = await engine.executeWorkflow(workflowState);

// All agents invoked will use the workflow's modelConfig
// If modelConfig is undefined, defaults to Claude Sonnet 4.5
```

### Environment Variables

For external providers, set API key ARNs:

```bash
export OPENAI_API_KEY_ARN="arn:aws:secretsmanager:...:secret:openai-key"
export GEMINI_API_KEY_ARN="arn:aws:secretsmanager:...:secret:gemini-key"
```

## Model Provider Formats

### Bedrock (IAM Auth)

```typescript
{
  provider: 'bedrock',
  modelId: 'global.anthropic.claude-sonnet-4-5-20250929-v1:0',
  displayName: 'Claude Sonnet 4.5',
  bedrockModelConfig: {
    modelId: 'global.anthropic.claude-sonnet-4-5-20250929-v1:0'
  }
}
```

### OpenAI (API Key)

```typescript
{
  provider: 'openai',
  modelId: 'gpt-5.5',
  displayName: 'GPT-5.5',
  openAiModelConfig: {
    modelId: 'gpt-5.5',
    apiKeyArn: 'arn:aws:secretsmanager:...' // From OPENAI_API_KEY_ARN env var
  }
}
```

### Gemini (API Key)

```typescript
{
  provider: 'gemini',
  modelId: 'gemini-2.5-pro',
  displayName: 'Gemini 2.5 Pro',
  geminiModelConfig: {
    modelId: 'gemini-2.5-pro',
    apiKeyArn: 'arn:aws:secretsmanager:...' // From GEMINI_API_KEY_ARN env var
  }
}
```

## InvokeHarnessCommand Integration

The engine transforms ModelConfig to the format expected by InvokeHarnessCommand:

```typescript
const input: InvokeHarnessCommandInput = {
  harnessId: agentId,
  inputText: message,
  sessionId: `workflow-${workflowId}-ticket-${ticketId}`,
  model: { bedrockModelConfig: { modelId: "..." } }, // Or openAiModelConfig, geminiModelConfig
  enableTrace: true
};
```

## Fallback Logic

1. **Workflow has modelConfig**: Use it
2. **modelConfig is undefined**: Use DEFAULT_MODEL_CONFIG (Claude Sonnet 4.5)
3. **API key required but not set**: Throw error with clear message

## Logging

The engine logs model configuration at multiple levels:

```
[Workflow wf_123] Model configuration: bedrock/Claude Sonnet 4.5
[Workflow wf_123] [Ticket TEAM-1] Invoking agent team-backend-dev with model: bedrock/Claude Sonnet 4.5
```

## Backward Compatibility

### Legacy Workflows (No modelConfig)

```typescript
const legacyWorkflow: WorkflowState = {
  workflowId: 'old-workflow',
  status: 'pending',
  requirements: '...',
  tickets: [],
  // No modelConfig field
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z'
};

// Works perfectly - falls back to default
const result = await engine.executeWorkflow(legacyWorkflow);
```

### Migration Helper

```typescript
import { migrateWorkflowState } from '@/lib/workflow-persistence';

// Safely migrate legacy state
const migrated = migrateWorkflowState(legacyWorkflowState);
```

## Testing

Run the test suite:

```bash
npm test tests/workflow-engine.test.ts
```

Tests cover:
- All three model providers
- Parameter transformation
- Environment variable handling
- Fallback logic
- Backward compatibility
- Error cases (missing API keys, invalid configs)

## Integration with UI

The UI components (IntakeForm, ModelSelector, WorkflowBoard) use these types:

```typescript
import { ModelConfig, AVAILABLE_MODELS } from '@/types/workflow';

// ModelSelector component
const availableModels = AVAILABLE_MODELS.map(m => ({
  ...m,
  disabled: m.provider !== 'bedrock' && !hasApiKey(m.provider)
}));
```

## Future Enhancements

- Per-agent model overrides
- Model performance metrics
- Cost tracking by model
- Dynamic model availability checking

## Support

For questions or issues, contact the backend team or check the design doc in S3.
