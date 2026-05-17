# ModelConfig Type System

## Overview

The `ModelConfig` type system provides type-safe configuration for AI model selection in workflows. It uses TypeScript's discriminated union pattern to support multiple AI providers (Bedrock, OpenAI, Gemini) with provider-specific validation.

## Type Definition

```typescript
export type ModelConfig = 
  | { provider: 'bedrock'; modelId: string }
  | { provider: 'openai'; modelId: string }
  | { provider: 'gemini'; modelId: string };
```

This discriminated union allows TypeScript to provide type narrowing based on the `provider` field:

```typescript
const config: ModelConfig = { provider: 'bedrock', modelId: 'anthropic.claude-sonnet-4-5' };

if (config.provider === 'bedrock') {
  // TypeScript knows this is the Bedrock variant
  console.log(config.modelId); // anthropic.claude-sonnet-4-5
}
```

## WorkflowInput Extension

The `WorkflowInput` interface has been extended with an optional `modelConfig` field:

```typescript
interface WorkflowInput {
  title: string;
  description: string;
  repoConfig: RepoConfig;
  sources: IntakeSource[];
  modelConfig?: ModelConfig;  // NEW: Optional model override
}
```

This maintains backward compatibility - workflows without `modelConfig` will use the default model.

## Utilities

### `isValidModelConfig(config: unknown): boolean`

Type guard that validates the structure of a ModelConfig object:

```typescript
import { isValidModelConfig } from '@/lib/workflow';

const userInput = JSON.parse(request.body);

if (isValidModelConfig(userInput.modelConfig)) {
  // TypeScript now knows userInput.modelConfig is ModelConfig
  processWorkflow(userInput.modelConfig);
}
```

### `isValidModelId(provider: string, modelId: string): boolean`

Provider-specific validation for model IDs:

```typescript
import { isValidModelId } from '@/lib/workflow';

// Bedrock models must follow pattern: provider.model-name
isValidModelId('bedrock', 'anthropic.claude-sonnet-4-5'); // true
isValidModelId('bedrock', 'invalid-model'); // false

// OpenAI models must start with 'gpt-' or 'o1-'
isValidModelId('openai', 'gpt-4-turbo'); // true
isValidModelId('openai', 'o1-preview'); // true
isValidModelId('openai', 'invalid'); // false

// Gemini models must start with 'gemini-'
isValidModelId('gemini', 'gemini-pro'); // true
isValidModelId('gemini', 'invalid'); // false
```

### `validateModelConfig(config: unknown): { valid: boolean; error?: string }`

Comprehensive validation with descriptive error messages:

```typescript
import { validateModelConfig } from '@/lib/workflow';

const result = validateModelConfig(userInput);

if (!result.valid) {
  return Response.json({ error: result.error }, { status: 400 });
}

// Proceed with valid config
```

### `getDefaultModelConfig(): ModelConfig`

Returns the default model configuration (Claude Sonnet 4.5 on Bedrock):

```typescript
import { getDefaultModelConfig } from '@/lib/workflow';

const config = workflowInput.modelConfig ?? getDefaultModelConfig();
```

## Validation Rules

### Bedrock Models
- Pattern: `provider.model-name`
- Examples: 
  - ✅ `anthropic.claude-sonnet-4-5`
  - ✅ `anthropic.claude-opus-4`
  - ✅ `meta.llama3-70b`
  - ❌ `invalid-model`
  - ❌ `gpt-4`

### OpenAI Models
- Pattern: `gpt-*` or `o1-*`
- Examples:
  - ✅ `gpt-4`
  - ✅ `gpt-4-turbo`
  - ✅ `gpt-3.5-turbo`
  - ✅ `o1-preview`
  - ✅ `o1-mini`
  - ❌ `anthropic.claude`
  - ❌ `invalid-model`

### Gemini Models
- Pattern: `gemini-*`
- Examples:
  - ✅ `gemini-pro`
  - ✅ `gemini-1.5-pro`
  - ✅ `gemini-ultra`
  - ❌ `gpt-4`
  - ❌ `invalid-model`

## Usage Examples

### API Route Validation

```typescript
// src/app/api/workflows/route.ts
import { validateModelConfig } from '@/lib/workflow';

export async function POST(request: Request) {
  const body = await request.json();
  
  // Validate model config if provided
  if (body.modelConfig) {
    const validation = validateModelConfig(body.modelConfig);
    if (!validation.valid) {
      return Response.json(
        { error: validation.error },
        { status: 400 }
      );
    }
  }
  
  // Proceed with workflow creation
  const workflow = await createWorkflow(body);
  return Response.json(workflow);
}
```

### Type-Safe Workflow Processing

```typescript
import type { WorkflowInput, ModelConfig } from '@/lib/workflow';
import { getDefaultModelConfig } from '@/lib/workflow';

function processWorkflow(input: WorkflowInput) {
  const modelConfig = input.modelConfig ?? getDefaultModelConfig();
  
  // Type narrowing based on provider
  switch (modelConfig.provider) {
    case 'bedrock':
      return invokeBedrock(modelConfig.modelId);
    case 'openai':
      return invokeOpenAI(modelConfig.modelId);
    case 'gemini':
      return invokeGemini(modelConfig.modelId);
  }
}
```

### Client-Side Form Handling

```typescript
'use client';

import { useState } from 'react';
import type { ModelConfig } from '@/lib/workflow';

export function ModelSelector() {
  const [config, setConfig] = useState<ModelConfig>({
    provider: 'bedrock',
    modelId: 'anthropic.claude-sonnet-4-5'
  });
  
  return (
    <select 
      value={config.modelId}
      onChange={(e) => setConfig({ ...config, modelId: e.target.value })}
    >
      {config.provider === 'bedrock' && (
        <>
          <option value="anthropic.claude-sonnet-4-5">Claude Sonnet 4.5</option>
          <option value="anthropic.claude-opus-4">Claude Opus 4</option>
        </>
      )}
      {/* ... other providers */}
    </select>
  );
}
```

## Testing

Comprehensive test suite is available in `model-config.test.ts`:

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage

# Run with UI
npm run test:ui
```

Test coverage exceeds 90% and includes:
- Type guard validation
- Provider-specific model ID validation
- Error message clarity
- Discriminated union type narrowing
- Edge cases and boundaries

## Backward Compatibility

The `modelConfig` field is **optional** on `WorkflowInput`, ensuring existing workflows continue to work:

```typescript
// Old workflow (no model config) - still works
const legacyInput: WorkflowInput = {
  title: "My Workflow",
  description: "...",
  repoConfig: { ... },
  sources: []
  // modelConfig is optional - uses default
};

// New workflow (with model config) - also works
const newInput: WorkflowInput = {
  title: "My Workflow",
  description: "...",
  repoConfig: { ... },
  sources: [],
  modelConfig: { provider: 'openai', modelId: 'gpt-4' }
};
```

## Integration Points

The ModelConfig type is designed to integrate with:

1. **UI Layer**: Model selector dropdown in IntakeForm
2. **API Layer**: Validation in workflow creation endpoints
3. **Engine Layer**: Model override in InvokeHarnessCommand for dev agents
4. **State Management**: Persisted in WorkflowState.input

## Future Enhancements

Potential future additions:
- Model-specific parameters (temperature, max tokens, etc.)
- Cost tracking per model
- Rate limit configuration
- Model availability checking
- Provider credential management
