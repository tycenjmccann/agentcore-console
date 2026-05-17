# ModelSelector Component Implementation (TEAM-47)

## Overview
Implementation of the ModelSelector UI component with provider grouping, availability detection, and integration with IntakeForm.

## Files Created

### Core Components
1. **components/ModelSelector.tsx** - Main selector component with:
   - Provider grouping (Bedrock, OpenAI, Gemini)
   - 10 supported models (5 Bedrock, 3 OpenAI, 2 Gemini)
   - Dynamic availability detection
   - Tooltip for unavailable models
   - Default selection: Claude Sonnet 4.5
   - Accessibility features (ARIA labels, keyboard navigation)

2. **components/IntakeForm.tsx** - Updated form with ModelSelector integration:
   - Fetches model availability on mount
   - Handles model selection changes
   - Sets default model if none selected
   - Updates WorkflowState with modelConfig

3. **components/WorkflowBoardHeader.tsx** - Workflow header with model display:
   - Shows selected model/provider in badge format
   - Falls back to default model display

### UI Components (shadcn/ui)
4. **components/ui/select.tsx** - Radix UI Select wrapper
5. **components/ui/tooltip.tsx** - Radix UI Tooltip wrapper

### Types & Utilities
6. **types.ts** - TypeScript interfaces:
   - `ModelConfig` - Model configuration with provider-specific fields
   - `WorkflowState` - Updated with optional `modelConfig` field
   - `IntakeFormData` - Updated with optional `modelConfig` field
   - `ApiAvailabilityResponse` - API response type

7. **lib/utils.ts** - Utility functions for className merging

### API & Hooks
8. **app/api/models/availability/route.ts** - Next.js API route:
   - Checks `OPENAI_API_KEY_ARN` env var
   - Checks `GEMINI_API_KEY_ARN` env var
   - Returns availability status

9. **hooks/useModelAvailability.ts** - React hook:
   - Fetches availability from API on mount
   - Manages loading and error states

## Model Configuration Format

### Bedrock Models (always available)
```typescript
{
  provider: "bedrock",
  modelId: "us.anthropic.claude-sonnet-4-5-v1:0",
  displayName: "Claude Sonnet 4.5",
  bedrockModelConfig: {
    modelId: "us.anthropic.claude-sonnet-4-5-v1:0"
  }
}
```

### OpenAI Models (requires OPENAI_API_KEY_ARN)
```typescript
{
  provider: "openai",
  modelId: "gpt-5.5",
  displayName: "GPT-5.5",
  openAiModelConfig: {
    modelId: "gpt-5.5",
    apiKeyArn: process.env.OPENAI_API_KEY_ARN
  }
}
```

### Gemini Models (requires GEMINI_API_KEY_ARN)
```typescript
{
  provider: "gemini",
  modelId: "gemini-2.5-pro",
  displayName: "Gemini 2.5 Pro",
  geminiModelConfig: {
    modelId: "gemini-2.5-pro",
    apiKeyArn: process.env.GEMINI_API_KEY_ARN
  }
}
```

## Supported Models

### AWS Bedrock (5 models)
- Claude Sonnet 4.5 (default)
- Claude Opus 4.5
- Claude Haiku 4.5
- Amazon Nova Pro
- Amazon Nova Lite

### OpenAI (3 models)
- GPT-5.5
- o3
- o4-mini

### Google Gemini (2 models)
- Gemini 2.5 Pro
- Gemini 2.5 Flash

## Environment Variables

Required for external providers:
```bash
OPENAI_API_KEY_ARN="arn:aws:secretsmanager:..."
GEMINI_API_KEY_ARN="arn:aws:secretsmanager:..."
```

## Installation

### Required Dependencies
Add to package.json:
```json
{
  "dependencies": {
    "@radix-ui/react-select": "^2.0.0",
    "@radix-ui/react-tooltip": "^1.0.0",
    "tailwindcss-merge": "^2.2.0"
  }
}
```

Install:
```bash
npm install @radix-ui/react-select @radix-ui/react-tooltip tailwindcss-merge
```

## Usage

### In IntakeForm
```tsx
import { ModelSelector } from '@/components/ModelSelector';
import { useModelAvailability } from '@/hooks/useModelAvailability';

function MyForm() {
  const { availability, loading } = useModelAvailability();
  const [modelConfig, setModelConfig] = useState();

  return (
    <ModelSelector
      value={modelConfig}
      onChange={setModelConfig}
      openAiAvailable={availability.openAiAvailable}
      geminiAvailable={availability.geminiAvailable}
    />
  );
}
```

### In WorkflowBoard
```tsx
import { WorkflowBoardHeader } from '@/components/WorkflowBoardHeader';

function WorkflowPage({ workflow }) {
  return <WorkflowBoardHeader workflow={workflow} />;
}
```

## Accessibility Features

✅ **Keyboard Navigation**
- Tab to focus trigger
- Enter/Space to open dropdown
- Arrow keys to navigate options
- Enter to select
- Escape to close

✅ **Screen Reader Support**
- ARIA labels on trigger
- ARIA attributes on options
- Disabled state announced
- Tooltip content read aloud

✅ **Visual Indicators**
- Focus ring on trigger
- Hover states on options
- Disabled styling (opacity)
- Check icon for selected item

## Testing

Run tests:
```bash
npm test -- ModelSelector.test.tsx
```

Test coverage:
- Provider grouping
- Bedrock models always enabled
- External models disabled without API key
- External models enabled with API key
- Default selection
- onChange callbacks
- Tooltip display
- Keyboard navigation
- Accessibility

## Integration with Workflow Engine

The selected `modelConfig` is stored in `WorkflowState` and should be:
1. Passed to the workflow engine on creation
2. Used in `InvokeHarnessCommand` via the `model` parameter
3. Applied to all agent invocations in the workflow

Example engine integration:
```typescript
const command = new InvokeHarnessCommand({
  harnessId: agentId,
  model: workflowState.modelConfig?.bedrockModelConfig || 
         workflowState.modelConfig?.openAiModelConfig ||
         workflowState.modelConfig?.geminiModelConfig,
  // ... other params
});
```

## Backward Compatibility

Existing workflows without `modelConfig` will:
- Default to Claude Sonnet 4.5
- Continue working without changes
- Can be updated to specify a model

## Future Enhancements

- [ ] Per-agent model selection
- [ ] Model performance metrics
- [ ] Cost tracking by model
- [ ] Dynamic model list from API
- [ ] Model parameter customization (temperature, top_p)
- [ ] Streaming support indicator
