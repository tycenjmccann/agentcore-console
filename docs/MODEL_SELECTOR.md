# Model Selector Implementation - TEAM-47

## Overview

Model selector dropdown for workflow intake forms to choose LLM model and provider.

## Components

1. **ModelConfig Types** (`src/lib/types/model-config.ts`)
   - Type definitions for all model configurations
   - 10 supported models (5 Bedrock, 3 OpenAI, 2 Gemini)

2. **ModelSelector** (`src/components/ModelSelector.tsx`)
   - Provider-grouped dropdown
   - Availability detection
   - Keyboard navigation & ARIA support

3. **API Endpoint** (`src/app/api/models/availability/route.ts`)
   - Checks environment variables for API keys
   - Returns provider availability status

4. **IntakeForm** (`src/components/IntakeForm.tsx`)
   - Complete workflow intake form
   - Integrates ModelSelector
   - Validates and submits with modelConfig

## Environment Variables

```bash
OPENAI_API_KEY_ARN=arn:aws:secretsmanager:region:account:secret:key
GEMINI_API_KEY_ARN=arn:aws:secretsmanager:region:account:secret:key
```

## Accessibility

- Full keyboard navigation
- ARIA labels and roles
- Screen reader support
- Focus management

## Testing

- [x] All 10 models display
- [x] Provider grouping works
- [x] Bedrock always enabled
- [x] External providers show disabled when API key missing
- [x] Default selection: Claude Sonnet 4.5
