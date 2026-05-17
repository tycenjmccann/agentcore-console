# Model Selector Implementation - TEAM-47

## Overview
This implementation adds a model/provider selector to workflow intake forms, allowing users to choose which LLM model agents use for workflow execution.

## Components Implemented

### 1. ModelSelector Component (`src/components/ModelSelector.tsx`)
- **Provider Grouping**: Models grouped by Bedrock, OpenAI, and Gemini with visual separators
- **Availability Detection**: Checks API key environment variables via `/api/models/availability`
- **Default Selection**: Claude Sonnet 4.5 (Bedrock)
- **Accessibility**: Full keyboard navigation, ARIA labels, screen reader support
- **UI Framework**: Radix UI Select for accessible dropdown patterns
- **Styling**: Tailwind CSS following existing design system

### 2. WorkflowBoard Component (`src/components/WorkflowBoard.tsx`)
- **Model Display**: Shows selected model/provider in workflow header
- **Format**: "Provider - Model Name" (e.g., "Bedrock - Claude Sonnet 4.5")
- **Task Tracking**: Real-time agent task status with polling
- **Metadata**: Workflow status, priority, creation time, task progress

### 3. IntakeForm Component (`src/components/IntakeForm.tsx`)
- **Integration**: ModelSelector integrated with form validation
- **State Management**: ModelConfig stored in WorkflowIntakeData
- **Validation**: Prevents submission without model selection
- **Display**: Shows selected model configuration before submission

### 4. API Endpoint (`src/app/api/models/availability/route.ts`)
- **Availability Check**: Server-side environment variable validation
- **Bedrock**: Always returns `true` (IAM authentication)
- **OpenAI**: Checks `OPENAI_API_KEY_ARN`
- **Gemini**: Checks `GEMINI_API_KEY_ARN`

## Supported Models

### Bedrock (Always Available)
1. Claude Sonnet 4.5 - `anthropic.claude-sonnet-4-5-v1:0` ⭐ Default
2. Claude Opus 4.5 - `anthropic.claude-opus-4-5-v1:0`
3. Claude Haiku 4.5 - `anthropic.claude-haiku-4-5-v1:0`
4. Amazon Nova Pro - `amazon.nova-pro-v1:0`
5. Amazon Nova Lite - `amazon.nova-lite-v1:0`

### OpenAI (Requires API Key)
6. GPT-5.5 - `gpt-5.5`
7. o3 - `o3`
8. o4-mini - `o4-mini`

### Gemini (Requires API Key)
9. Gemini 2.5 Pro - `gemini-2.5-pro`
10. Gemini 2.5 Flash - `gemini-2.5-flash`

## Installation

### 1. Install Dependencies

```bash
npm install @radix-ui/react-select
```

### 2. Environment Variables

Add to `.env.local` (optional - enables external providers):

```bash
# OpenAI API Key ARN from AWS Secrets Manager
OPENAI_API_KEY_ARN=arn:aws:secretsmanager:us-east-1:123456789012:secret:openai-key-xxx

# Gemini API Key ARN from AWS Secrets Manager  
GEMINI_API_KEY_ARN=arn:aws:secretsmanager:us-east-1:123456789012:secret:gemini-key-xxx
```

**Note**: Bedrock models work without any configuration (uses IAM)

## Usage Examples

### Basic Workflow Creation

```typescript
import IntakeForm, { WorkflowIntakeData } from "@/components/IntakeForm";

export default function WorkflowPage() {
  const handleSubmit = async (data: WorkflowIntakeData) => {
    const response = await fetch("/api/workflows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: data.title,
        description: data.description,
        priority: data.priority,
        modelConfig: data.modelConfig,
      }),
    });
    
    if (response.ok) {
      const { id } = await response.json();
      router.push(`/workflows/${id}`);
    }
  };

  return <IntakeForm onSubmit={handleSubmit} />;
}
```

### Display Workflow with Model Info

```typescript
import { WorkflowBoard } from "@/components/WorkflowBoard";

export default function WorkflowDetailPage({ params }: { params: { id: string } }) {
  return (
    <div className="container mx-auto p-6">
      <WorkflowBoard workflowId={params.id} />
    </div>
  );
}
```

## TypeScript Types

```typescript
export interface ModelConfig {
  provider: "bedrock" | "openai" | "gemini";
  modelId: string;
  displayName: string;
  bedrockModelConfig?: { modelId: string };
  openAiModelConfig?: { modelId: string; apiKeyArn: string };
  geminiModelConfig?: { modelId: string; apiKeyArn: string };
}

export interface WorkflowIntakeData {
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "critical";
  modelConfig: ModelConfig;
}
```

## Engine Integration

The workflow engine should:

1. Read `modelConfig` from WorkflowState
2. Pass configuration to `InvokeHarnessCommand` via `model` parameter
3. All agents in a workflow use the same model

Example:

```typescript
import { InvokeHarnessCommand } from "@aws-sdk/client-bedrock-agentcore";

const command = new InvokeHarnessCommand({
  harnessId: agentId,
  payload: { /* agent input */ },
  model: workflowState.modelConfig?.bedrockModelConfig || 
         workflowState.modelConfig?.openAiModelConfig ||
         workflowState.modelConfig?.geminiModelConfig,
});
```

## Acceptance Criteria Status

✅ **AC1: Model Selector Component**
- ModelSelector dropdown displays all providers and models
- Bedrock models always enabled
- External provider models disabled with tooltip when API key not configured
- External provider models enabled when API key env var set
- Default selection is Claude Sonnet 4.5

✅ **AC2: Integration with IntakeForm**
- ModelSelector integrated into IntakeForm
- Form validation requires model selection
- onChange handler updates WorkflowState.modelConfig
- Selected model displayed before submission

✅ **AC3: WorkflowBoard Display**
- WorkflowBoard header shows selected model/provider
- Display format: "Provider - Model Name"
- Clear and consistent visual design

✅ **AC4: Accessibility**
- Keyboard navigation (Tab, Arrow keys, Enter, Escape)
- ARIA labels and roles
- Screen reader compatible
- Focus management

✅ **AC5: Styling and UX**
- Follows existing Tailwind design system
- Consistent with dashboard patterns
- Loading states and error handling
- Helpful tooltips for disabled options

## Testing

### Manual Testing Checklist

- [ ] ModelSelector renders with all 10 models grouped by provider
- [ ] Bedrock models are always enabled and selectable
- [ ] OpenAI models show "API key not configured" when `OPENAI_API_KEY_ARN` not set
- [ ] Gemini models show "API key not configured" when `GEMINI_API_KEY_ARN` not set
- [ ] Default selection is Claude Sonnet 4.5 on first load
- [ ] Keyboard navigation works (Tab through options, Enter to select, Escape to close)
- [ ] Screen reader announces model selections correctly
- [ ] IntakeForm prevents submission without model selection
- [ ] WorkflowBoard displays selected model in header
- [ ] Model configuration persists across page refreshes

### Accessibility Testing

Use browser dev tools or axe-core:

```bash
# Check accessibility
npx @axe-core/cli http://localhost:3000/workflows/new
```

## Architecture Notes

### Why Radix UI Select?

1. **Accessibility**: Built-in ARIA patterns, keyboard navigation
2. **Customization**: Fully stylable with Tailwind
3. **Reliability**: Production-ready, maintained by Radix team
4. **Size**: Lightweight compared to alternatives
5. **TypeScript**: Full type safety out of the box

### Provider Availability Logic

- **Bedrock**: Always `true` - uses IAM role credentials
- **OpenAI**: Requires `OPENAI_API_KEY_ARN` environment variable
- **Gemini**: Requires `GEMINI_API_KEY_ARN` environment variable

API keys are stored in AWS Secrets Manager and referenced by ARN.

## Troubleshooting

### Models Not Showing Up
- Verify Radix UI installed: `npm list @radix-ui/react-select`
- Check browser console for errors
- Confirm API route returns data: `curl http://localhost:3000/api/models/availability`

### External Providers Always Disabled
- Add env vars to `.env.local`
- Restart dev server: `npm run dev`
- Check env vars are loaded: `console.log(process.env.OPENAI_API_KEY_ARN)`

### TypeScript Errors
- Ensure ModelConfig exported from ModelSelector component
- Check import paths use `@/` alias
- Run type check: `npm run build`

## Next Steps

1. **Backend Integration**: Wire up modelConfig to workflow engine
2. **Persistence**: Store modelConfig in database/state management
3. **Testing**: Add unit tests for ModelSelector component
4. **Analytics**: Track model selection preferences
5. **Cost Tracking**: Display estimated costs per model
6. **Advanced Features**: 
   - Per-agent model overrides
   - Model parameter customization (temperature, max tokens)
   - Dynamic model list from API

## Files Changed

```
✅ src/components/ModelSelector.tsx         (upgraded with Radix UI)
✅ src/components/IntakeForm.tsx            (already integrated)
✅ src/components/WorkflowBoard.tsx         (created)
✅ src/app/api/models/availability/route.ts (already exists)
✅ package.json                             (added @radix-ui/react-select)
```

## Related Documentation

- [Bedrock AgentCore SDK](https://docs.aws.amazon.com/bedrock/latest/APIReference/welcome.html)
- [Radix UI Select](https://www.radix-ui.com/primitives/docs/components/select)
- [Next.js 14 App Router](https://nextjs.org/docs/app)
- [Tailwind CSS](https://tailwindcss.com/docs)

---

**Implementation completed by**: team-frontend-dev  
**Ticket**: TEAM-47  
**Branch**: feature/TEAM-47-frontend-dev  
**Status**: Ready for PR
