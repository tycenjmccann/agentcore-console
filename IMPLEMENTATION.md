# ModelSelector Component Implementation

## Overview
This implementation adds a model selector to workflow intake forms, allowing users to choose which LLM model and provider their workflow agents use.

## Components Created

### 1. Type Definitions (`src/types/model.ts`)
- `ModelProvider`: Union type for supported providers
- `ModelConfig`: Main configuration interface
- `BedrockModelConfig`, `OpenAiModelConfig`, `GeminiModelConfig`: Provider-specific configs
- `ModelOption`: UI model representation
- `WorkflowState`: Extended with modelConfig property

### 2. UI Components

#### `src/components/ui/select.tsx`
- Native HTML select wrapper with Tailwind styling
- `Select`, `SelectGroup`, `SelectItem` components
- Consistent with existing design system

#### `src/components/ui/tooltip.tsx`
- Tooltip component for disabled model tooltips
- Supports multiple positioning sides
- Accessible with proper ARIA attributes

### 3. Workflow Components

#### `src/components/workflow/ModelSelector.tsx`
**Features:**
- Grouped dropdown by provider (Bedrock, OpenAI, Gemini)
- All 10 models displayed:
  - Bedrock: Claude Sonnet 4.5, Claude Opus 4.5, Claude Haiku 4.5, Nova Pro, Nova Lite
  - OpenAI: GPT-5.5, o3, o4-mini
  - Gemini: Gemini 2.5 Pro, Gemini 2.5 Flash
- Default selection: Claude Sonnet 4.5
- Availability detection via API endpoint
- Disabled state for unavailable external providers
- Accessibility: ARIA labels, keyboard navigation
- Info panel showing current selection

#### `src/components/workflow/IntakeForm.tsx`
**Integration:**
- Includes ModelSelector component
- Updates WorkflowState.modelConfig via onChange handler
- Form validation and submission
- Loading and disabled states

#### `src/components/workflow/WorkflowBoard.tsx`
**Display:**
- Shows selected model in header
- Format: "Provider - Model Name"
- Falls back to default when not configured

### 4. API Endpoint (`src/app/api/config/api-keys/route.ts`)
**Functionality:**
- Server-side check for API key environment variables
- Returns boolean availability for OpenAI and Gemini
- Secure: Only returns availability status, not actual keys

## Environment Variables

Add to `.env.local` or deployment environment:

```bash
# Optional: Enable OpenAI models
OPENAI_API_KEY_ARN=arn:aws:secretsmanager:region:account:secret:name

# Optional: Enable Gemini models
GEMINI_API_KEY_ARN=arn:aws:secretsmanager:region:account:secret:name
```

## Usage

### In a Next.js Page

```tsx
import { IntakeForm } from "@/components/workflow/IntakeForm";
import { WorkflowState } from "@/types/model";

export default function WorkflowPage() {
  const handleSubmit = async (state: WorkflowState) => {
    // Submit workflow with model config
    await fetch("/api/workflows", {
      method: "POST",
      body: JSON.stringify(state),
    });
  };

  return <IntakeForm onSubmit={handleSubmit} />;
}
```

### Standalone ModelSelector

```tsx
import { ModelSelector } from "@/components/workflow/ModelSelector";
import { ModelConfig } from "@/types/model";
import { useState } from "react";

export default function MyComponent() {
  const [model, setModel] = useState<ModelConfig>();

  return (
    <ModelSelector
      value={model}
      onChange={setModel}
    />
  );
}
```

## Model ID Format

Model IDs match the InvokeHarnessCommand format:

- **Bedrock**: Full model ARN (e.g., `global.anthropic.claude-sonnet-4-5-20250929-v1:0`)
- **OpenAI**: Model identifier (e.g., `gpt-5.5`, `o3`, `o4-mini`)
- **Gemini**: Model identifier (e.g., `gemini-2.5-pro`, `gemini-2.5-flash`)

## ModelConfig Structure

The selected model is stored in `WorkflowState.modelConfig`:

```typescript
{
  provider: "bedrock" | "openai" | "gemini",
  modelId: string,
  displayName: string,
  // Provider-specific config (one of):
  bedrockModelConfig?: { modelId: string },
  openAiModelConfig?: { modelId: string, apiKeyArn: string },
  geminiModelConfig?: { modelId: string, apiKeyArn: string }
}
```

## Accessibility

- ✅ Keyboard navigation (arrow keys, Enter, Escape)
- ✅ ARIA labels and descriptions
- ✅ Screen reader support
- ✅ Focus management
- ✅ Disabled state indicators

## Testing

### Manual Testing

1. **Default Selection**: Verify Claude Sonnet 4.5 is selected by default
2. **Bedrock Models**: All 5 Bedrock models should be enabled
3. **External Providers Without Keys**: OpenAI and Gemini models should show "(API key not configured)" and be disabled
4. **External Providers With Keys**: Set environment variables and verify models are enabled
5. **Model Change**: Select different models and verify WorkflowState updates
6. **Keyboard Navigation**: Tab to selector, use arrow keys, press Enter
7. **WorkflowBoard Display**: Verify selected model appears in workflow header

### Integration with Engine

The workflow engine should:
1. Read `modelConfig` from `WorkflowState`
2. Pass to `InvokeHarnessCommand` via `model` parameter
3. Use same model for all agents in the workflow

## Acceptance Criteria Status

- ✅ ModelSelector component renders with provider grouping
- ✅ All 10 models displayed correctly
- ✅ Bedrock models always enabled
- ✅ External provider models disabled with message when API key not configured
- ✅ External provider models enabled when API key env var present
- ✅ Default selection is Claude Sonnet 4.5
- ✅ Selection updates WorkflowState.modelConfig correctly
- ✅ Component follows existing UI/UX patterns
- ✅ Accessible via keyboard and screen readers

## Files Created

```
src/
├── types/
│   └── model.ts                           # Type definitions
├── components/
│   ├── ui/
│   │   ├── select.tsx                    # Select component
│   │   └── tooltip.tsx                   # Tooltip component
│   └── workflow/
│       ├── ModelSelector.tsx             # Main model selector
│       ├── IntakeForm.tsx                # Intake form with integration
│       └── WorkflowBoard.tsx             # Workflow board with model display
└── app/
    └── api/
        └── config/
            └── api-keys/
                └── route.ts              # API key availability endpoint
```

## Next Steps

1. Commit all files to feature branch
2. Create pull request
3. Add integration tests
4. Update workflow engine to consume modelConfig
5. Deploy and verify in staging environment
