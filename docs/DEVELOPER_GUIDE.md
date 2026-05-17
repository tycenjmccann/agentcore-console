# Developer Guide: Model Selector Architecture

## Architecture Overview

The per-invocation model selector feature allows users to choose which AI model (Bedrock/OpenAI/Gemini) to use for development agents when starting a workflow.

## System Architecture

```
User UI → API → Workflow Engine → Enhanced Invoke → AgentCore → Model Provider
```

## Core Components

### Type System (`src/lib/workflow/types.ts`)
- ModelConfig discriminated union
- WorkflowInput extension

### Workflow Engine (`src/lib/workflow/workflow-engine.ts`)
- Agent type detection
- Model config validation
- Parameter conversion

### Enhanced Harness Invocation (`src/lib/workflow/enhanced-invoke.ts`)
- Model config to InvokeHarness parameters
- Automatic override for dev agents
- Fallback handling

## Adding New Model Providers

Step-by-step guide included for adding new providers and models.

## Testing Strategy

Comprehensive unit, integration, and E2E testing approach documented.

## Performance Considerations

- Validation: O(1)
- Overhead: <1ms per invocation
- Caching: 1 hour for model list

## Security

- Input validation
- Injection prevention
- Access control
- Data privacy per provider

Last Updated: 2025-01-13
