# ModelConfig Implementation - TEAM-84

This implementation adds ModelConfig types and the GET /api/models endpoint for per-invocation model selection in the workflow system.

## Implementation Summary

### Files Created/Modified

1. **src/lib/workflow/types.ts** - Extended with ModelConfig types
2. **src/app/api/models/route.ts** - New API endpoint
3. **src/lib/workflow/__tests__/types.test.ts** - Unit tests for type system
4. **src/app/api/models/__tests__/route.test.ts** - API integration tests

### Type System

Added discriminated union for model configuration:
- `ModelProvider`: "bedrock" | "openai" | "gemini"
- `BedrockConfig`, `OpenAIConfig`, `GeminiConfig` interfaces
- Type guard functions for safe discrimination
- Extended `WorkflowInput` with optional `modelOverride` field

### API Endpoint

`GET /api/models` returns available models based on environment:
- Checks AWS_REGION, OPENAI_API_KEY, GOOGLE_API_KEY
- Returns Bedrock models (Claude Sonnet 4.5 default, Opus, Sonnet 3.5)
- Returns OpenAI models (GPT-4 Turbo, GPT-4o) when configured
- Returns Gemini models (2.0 Flash, 1.5 Pro) when configured
- Response time < 200ms with 5-minute cache
- Returns empty array (200 status) if no providers configured

### Test Coverage

**Type Tests (20+ cases):**
- Type guard validation
- Discriminated union narrowing
- JSON serialization
- WorkflowInput backwards compatibility

**API Tests (15+ cases):**
- Response format validation
- Environment-based availability
- Default model marking
- Performance requirements
- Edge cases

## Acceptance Criteria

- ✅ ModelConfig types implemented and exported
- ✅ GET /api/models returns valid JSON array
- ✅ Response includes: provider, modelId, displayName, isDefault
- ✅ API respects environment configuration
- ✅ Type guards work correctly for discrimination
- ✅ Unit tests pass for all type variants
- ✅ API responds in < 200ms

## Backwards Compatibility

100% backwards compatible - `modelOverride` is optional. Existing workflows continue to work without changes.

## Usage

```typescript
// Fetch available models
const response = await fetch("/api/models");
const models: AvailableModel[] = await response.json();

// Use in workflow
const input: WorkflowInput = {
  title: "My Workflow",
  description: "Description",
  repoConfig: { /* ... */ },
  sources: [],
  modelOverride: {
    provider: "bedrock",
    modelId: "anthropic.claude-opus-4-0-v1:0"
  }
};
```

## Environment Configuration

```bash
# Bedrock (default)
AWS_REGION=us-east-1

# OpenAI (optional)
OPENAI_API_KEY=sk-...

# Gemini (optional)
GOOGLE_API_KEY=AIza...
```

## Next Steps

This provides the foundation. Future work:
1. UI ModelSelector component
2. Wire modelOverride to workflow engine
3. Cost tracking per model
4. Performance monitoring
