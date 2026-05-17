# WorkflowState Model Configuration - Implementation Guide

## Overview
This implementation adds model/provider selection support to the workflow system, allowing users to choose which LLM model powers their workflow agents.

## Files Changed

### Core Type Definitions
**File:** `src/lib/types.ts`

**Changes:**
- Added `ModelConfig` interface for provider-specific configuration
- Extended `WorkflowState` interface with optional `modelConfig` property
- Added `DEFAULT_MODEL_CONFIG` constant (Claude Sonnet 4.5)
- Added `AVAILABLE_MODELS` array with all supported models
- Helper functions:
  - `isModelAvailable(model)` - Check if model is configured
  - `getApiKeyArn(provider)` - Get API key from environment
  - `toInvokeHarnessModelConfig(config)` - Transform to InvokeHarnessCommand format

### Workflow Engine
**File:** `src/lib/engine.ts`

**Changes:**
- Engine reads `modelConfig` from WorkflowState
- Falls back to `DEFAULT_MODEL_CONFIG` when undefined
- Transforms modelConfig to InvokeHarnessCommand format
- Passes model configuration to each agent invocation
- Logs model being used per workflow
- All agents in a workflow use the same model

**Key Methods:**
- `execute()` - Main execution loop with model config handling
- `processTickets()` - Processes tickets with model config
- `executeTicket()` - Invokes agent with model config parameter

### Storage Layer
**File:** `src/lib/storage.ts`

**Changes:**
- `loadWorkflowState()` - Loads state including modelConfig
- `saveWorkflowState()` - Persists modelConfig with state
- `initializeWorkflowState()` - Creates workflow with optional modelConfig
- Logging for model configuration during save/load

### API Routes
**File:** `app/api/workflows/route.ts`
- POST endpoint accepts optional `modelConfig` in request body
- Creates workflow with specified model or default

**File:** `app/api/workflows/[id]/execute/route.ts`
- POST endpoint starts workflow execution
- Engine reads modelConfig from WorkflowState automatically

## Model Configuration Format

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
    apiKeyArn: process.env.OPENAI_API_KEY_ARN
  }
}
```

### Google Gemini (API Key)
```typescript
{
  provider: 'gemini',
  modelId: 'gemini-2.5-pro',
  displayName: 'Gemini 2.5 Pro',
  geminiModelConfig: {
    modelId: 'gemini-2.5-pro',
    apiKeyArn: process.env.GEMINI_API_KEY_ARN
  }
}
```

## Environment Variables

Required for external providers:

```bash
# OpenAI API Key (from AWS Secrets Manager)
OPENAI_API_KEY_ARN=arn:aws:secretsmanager:us-east-1:123456789012:secret:openai-api-key

# Google Gemini API Key (from AWS Secrets Manager)
GEMINI_API_KEY_ARN=arn:aws:secretsmanager:us-east-1:123456789012:secret:gemini-api-key

# S3 bucket for workflow state
WORKFLOW_STATE_BUCKET=agentis-workflow-states
```

## Supported Models

### Bedrock (Always Available)
- Claude Sonnet 4.5 (default)
- Claude Opus 4.5
- Claude Haiku 4.5
- Amazon Nova Pro
- Amazon Nova Lite

### OpenAI (Requires OPENAI_API_KEY_ARN)
- GPT-5.5
- o3
- o4-mini

### Google Gemini (Requires GEMINI_API_KEY_ARN)
- Gemini 2.5 Pro
- Gemini 2.5 Flash

## Usage Examples

### Create Workflow with Default Model
```typescript
const response = await fetch('/api/workflows', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'My Workflow',
    requirements: 'Build a feature...'
    // modelConfig not specified - uses default Claude Sonnet 4.5
  })
});
```

### Create Workflow with Specific Model
```typescript
const response = await fetch('/api/workflows', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'My Workflow',
    requirements: 'Build a feature...',
    modelConfig: {
      provider: 'bedrock',
      modelId: 'global.anthropic.claude-opus-4-5-20250514-v1:0',
      displayName: 'Claude Opus 4.5',
      bedrockModelConfig: {
        modelId: 'global.anthropic.claude-opus-4-5-20250514-v1:0'
      }
    }
  })
});
```

### Execute Workflow
```typescript
// Model config is read from WorkflowState automatically
const response = await fetch(`/api/workflows/${workflowId}/execute`, {
  method: 'POST'
});
```

## Backward Compatibility

### Existing Workflows
- Workflows created before this feature will have `modelConfig: undefined`
- Engine falls back to `DEFAULT_MODEL_CONFIG` (Claude Sonnet 4.5)
- No breaking changes - all existing workflows continue to work

### Migration
No migration needed. Existing workflows automatically use default model.

## Error Handling

### Missing API Key
- Model shows as unavailable in UI
- Runtime error if user attempts to use unavailable model
- Error caught by existing error handling

### Invalid Model Configuration
- Engine falls back to default model
- Warning logged
- Workflow continues execution

### Model Unavailable
- Error returned from InvokeHarnessCommand
- Ticket marked as failed
- Workflow continues with other tickets

## Testing

Run tests:
```bash
npm test
```

Test coverage:
- ✅ Default model fallback
- ✅ Bedrock model configuration
- ✅ OpenAI model configuration  
- ✅ Gemini model configuration
- ✅ ModelConfig persistence
- ✅ Backward compatibility
- ✅ Helper function transformations
- ✅ API key handling

## Logging

Engine logs model configuration:
```
[Engine] Starting workflow execution: wf_123_abc
[Engine] Using model: bedrock - Claude Sonnet 4.5
[Engine] Model ID: global.anthropic.claude-sonnet-4-5-20250929-v1:0
[Engine] Harness config: {"bedrockModelConfig":{"modelId":"..."}}
[Engine] Invoking agent team-backend-dev with model: {...}
```

Storage logs model configuration:
```
[Storage] Saving workflow state: wf_123_abc
[Storage] Status: in_progress
[Storage] Model: Claude Sonnet 4.5
```

## Acceptance Criteria Status

- ✅ WorkflowState.modelConfig persists correctly
- ✅ Engine reads modelConfig from WorkflowState
- ✅ Engine passes model config to InvokeHarnessCommand for each agent
- ✅ All agents in a workflow use the same model
- ✅ Fallback to default model works when modelConfig undefined
- ✅ Backward compatibility: existing workflows without modelConfig work correctly
- ✅ Logs show which model is being used per workflow
- ✅ No runtime errors when model config is missing or invalid

## Next Steps

### Frontend Integration (Separate Ticket)
1. Create ModelSelector component
2. Add to IntakeForm
3. Display in WorkflowBoard header
4. Implement API key availability checks

### Future Enhancements
- Per-agent model selection
- Model performance metrics
- Cost tracking by model
- Dynamic model list from API
