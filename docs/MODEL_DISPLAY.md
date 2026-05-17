# Model Display Implementation

## Overview
This implementation adds a model/provider display badge to the WorkflowBoard header, showing users which LLM model is being used for the current workflow.

## Components

### ModelDisplay Component
Location: `src/components/ModelDisplay.tsx`

**Features:**
- Displays "Provider - Model Name" format (e.g., "Bedrock - Claude Sonnet 4.5")
- Shows provider badge icon (B for Bedrock, O for OpenAI, G for Gemini)
- Responsive design: full text on desktop, shortened on mobile
- Tooltip on hover showing full model ID for debugging
- Default fallback to Claude Sonnet 4.5 when no config provided

**Props:**
```typescript
interface ModelDisplayProps {
  modelConfig?: ModelConfig;
}
```

### WorkflowBoard Component
Location: `src/components/WorkflowBoard.tsx`

**Changes:**
- Added ModelDisplay component to header (right side)
- Reads modelConfig from WorkflowState
- Passes config to ModelDisplay component

## Types
Location: `src/types.ts`

### ModelConfig Interface
```typescript
export interface ModelConfig {
  provider: 'bedrock' | 'openai' | 'gemini';
  modelId: string;
  displayName: string;
  bedrockModelConfig?: { modelId: string };
  openAiModelConfig?: { modelId: string; apiKeyArn: string };
  geminiModelConfig?: { modelId: string; apiKeyArn: string };
}
```

### WorkflowState Interface
Updated to include:
```typescript
modelConfig?: ModelConfig;
```

## Styling
- Uses Tailwind CSS utility classes
- Blue theme (bg-blue-50, border-blue-200, text-blue-700)
- Responsive breakpoints (sm: prefix for desktop)
- Hover effects for interactivity

## Edge Cases Handled

1. **No modelConfig provided**: Displays default "Bedrock - Claude Sonnet 4.5"
2. **Invalid modelConfig**: Component gracefully handles with Unknown provider
3. **Mobile devices**: Shows shortened display (just model name)
4. **Long model IDs**: Tooltip uses break-all for proper wrapping
5. **Switching workflows**: Component re-renders with new modelConfig

## Testing
Location: `src/components/__tests__/ModelDisplay.test.tsx`

**Test Coverage:**
- Default model rendering
- All provider types (Bedrock, OpenAI, Gemini)
- Tooltip functionality
- Provider badge icons
- Responsive display

## Usage Example

```tsx
import { WorkflowBoard } from './components/WorkflowBoard';
import { WorkflowState } from './types';

const workflow: WorkflowState = {
  workflowId: 'wf_123',
  status: 'in_progress',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  modelConfig: {
    provider: 'bedrock',
    modelId: 'us.anthropic.claude-sonnet-4-5-20250131-v1:0',
    displayName: 'Claude Sonnet 4.5',
    bedrockModelConfig: {
      modelId: 'us.anthropic.claude-sonnet-4-5-20250131-v1:0'
    }
  }
};

<WorkflowBoard workflow={workflow} />
```

## Browser Support
- Modern browsers with CSS Grid and Flexbox support
- Responsive design works on mobile and desktop
- Tooltip requires JavaScript enabled

## Accessibility
- Semantic HTML with proper button role
- Hover and click support for tooltip
- Keyboard navigation support (can be enhanced)
- Color contrast meets WCAG standards

## Future Enhancements
- Add keyboard shortcuts for tooltip
- Add ARIA labels for screen readers
- Support for custom provider icons
- Animation on model change
- Copy model ID to clipboard on click
