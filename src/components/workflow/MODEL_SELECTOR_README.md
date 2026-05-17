# Model Selector Feature

## Overview

The Model Selector feature allows users to choose which AI model (provider + model ID) to use for dev agents when starting a workflow. It supports Bedrock, OpenAI, and Gemini providers.

## Architecture

### Type Definitions (`src/lib/workflow/model-config.ts`)

```typescript
export type ModelProvider = "bedrock" | "openai" | "gemini";

export type ModelConfig =
  | { provider: "bedrock"; modelId: string }
  | { provider: "openai"; modelId: string }
  | { provider: "gemini"; modelId: string };

export interface AvailableModel {
  provider: ModelProvider;
  modelId: string;
  displayName: string;
  description?: string;
  isDefault: boolean;
}
```

### Components

#### ModelSelector (`src/components/workflow/ModelSelector.tsx`)

A dropdown component that fetches available models from `/api/models` and allows users to select one.

**Features:**
- Fetches models on mount
- Auto-selects default model (Claude Sonnet 4.5)
- Groups models by provider
- Shows "Default" badge for the default model
- Loading and error states with retry
- Keyboard accessible
- Shows model descriptions on hover

**Props:**
```typescript
interface ModelSelectorProps {
  value: ModelConfig | null;
  onChange: (config: ModelConfig) => void;
  disabled?: boolean;
}
```

**Usage:**
```tsx
import { ModelSelector } from "@/components/workflow/ModelSelector";
import { useState } from "react";

function MyForm() {
  const [modelConfig, setModelConfig] = useState<ModelConfig | null>(null);
  
  return (
    <ModelSelector
      value={modelConfig}
      onChange={setModelConfig}
      disabled={false}
    />
  );
}
```

#### IntakeForm (`src/components/workflow/IntakeForm.tsx`)

Integrated the ModelSelector into the existing workflow intake form. The selected model is included in the workflow start request payload.

## API Integration

The component fetches models from `GET /api/models` which returns:

```json
{
  "models": [
    {
      "provider": "bedrock",
      "modelId": "anthropic.claude-sonnet-4-5",
      "displayName": "Claude Sonnet 4.5",
      "description": "Balanced performance and speed",
      "isDefault": true
    },
    {
      "provider": "bedrock",
      "modelId": "anthropic.claude-opus-4",
      "displayName": "Claude Opus 4",
      "description": "Highest capability model",
      "isDefault": false
    },
    {
      "provider": "openai",
      "modelId": "gpt-4-turbo",
      "displayName": "GPT-4 Turbo",
      "description": "Fast and capable",
      "isDefault": false
    },
    {
      "provider": "gemini",
      "modelId": "gemini-pro",
      "displayName": "Gemini Pro",
      "isDefault": false
    }
  ]
}
```

## Workflow Integration

When a user starts a workflow, the selected model configuration is included in the request:

```typescript
const workflowInput: WorkflowInput & { modelConfig: ModelConfig } = {
  title: "My Feature",
  description: "Feature description",
  repoConfig: { /* ... */ },
  sources: [],
  modelConfig: {
    provider: "bedrock",
    modelId: "anthropic.claude-sonnet-4-5"
  }
};
```

This `modelConfig` flows through to the workflow engine, which passes it to dev agents via `InvokeHarnessCommand`.

## Testing

### Unit Tests (`src/components/workflow/ModelSelector.test.tsx`)

Comprehensive test suite with 11 test cases covering:

1. ✅ Loading state rendering
2. ✅ Fetching and displaying models
3. ✅ Auto-selecting default model
4. ✅ Displaying selected model with badge
5. ✅ Dropdown open/close functionality
6. ✅ Grouping models by provider
7. ✅ Selection change handling
8. ✅ Error state display
9. ✅ Retry mechanism
10. ✅ Disabled state
11. ✅ Model description display

**Running Tests:**
```bash
npm test ModelSelector
```

### Test Coverage

Target: **>80% coverage**

The test suite achieves comprehensive coverage of:
- State management (loading, error, success)
- User interactions (click, select)
- API integration (fetch, error handling)
- Accessibility (disabled state)
- UI rendering (badges, descriptions, grouping)

## UI/UX Design

### Visual Hierarchy

1. **Label**: "AI Model" in gray-400
2. **Selected Display**:
   - Sparkles icon (brand-400)
   - Model display name (gray-200)
   - "Default" badge (brand background) if applicable
   - Provider name in brackets (gray-500)
3. **Dropdown**: Grouped by provider with section headers

### States

- **Loading**: Spinner + "Loading models..."
- **Error**: Alert icon + error message + retry button
- **Loaded**: Selected model display + chevron
- **Open**: Full dropdown with all models grouped
- **Disabled**: Grayed out, cursor not-allowed

### Accessibility

- ✅ Keyboard navigation support
- ✅ Clear focus states
- ✅ Disabled state properly marked
- ✅ Error messages are visible
- ✅ Labels for all inputs

## Implementation Checklist

- [x] Create ModelConfig type definitions
- [x] Build ModelSelector component
- [x] Integrate with IntakeForm
- [x] Add comprehensive tests (11 test cases)
- [x] Handle loading state
- [x] Handle error state with retry
- [x] Auto-select default model
- [x] Group models by provider
- [x] Show default badge
- [x] Show model descriptions
- [x] Keyboard accessibility
- [x] Responsive design
- [x] Document usage

## Future Enhancements

### Phase 2 (Nice to Have)

1. **Model Performance Metrics**: Show average response time, cost per request
2. **Model Comparison**: Side-by-side comparison of model capabilities
3. **Recently Used**: Quick access to recently selected models
4. **Favorites**: Allow users to favorite models
5. **Model Search**: Search/filter models by name or capability
6. **Custom Models**: Allow users to add custom model configurations
7. **Cost Calculator**: Estimate workflow cost based on model selection
8. **Model Recommendations**: Suggest best model based on workflow type

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Known Issues

None currently.

## Troubleshooting

### Models not loading

**Symptom**: "Failed to fetch models" error

**Solutions**:
1. Check `/api/models` endpoint is deployed
2. Verify API returns valid JSON
3. Check network tab for CORS errors
4. Click "Retry" button to retry fetch

### Default model not pre-selected

**Symptom**: No model selected on page load

**Solutions**:
1. Verify API marks one model with `isDefault: true`
2. Check browser console for errors
3. Verify `onChange` callback is provided

### Dropdown not opening

**Symptom**: Click on selector does nothing

**Solutions**:
1. Check if component is disabled
2. Verify no JavaScript errors in console
3. Check z-index conflicts with other UI elements

## Contact

For questions or issues with this feature, contact the frontend team or open a GitHub issue.
