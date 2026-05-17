# Models API Documentation

## Overview
The Models API provides access to available AI models that can be used for workflow execution.

## Endpoint

### GET /api/models

Returns a list of available AI models with metadata.

**URL**: `/api/models`  
**Method**: `GET`  
**Auth required**: No  
**Permissions required**: None

#### Success Response

**Code**: `200 OK`

**Content example**:

```json
{
  "models": [
    {
      "provider": "bedrock",
      "modelId": "anthropic.claude-sonnet-4-5",
      "displayName": "Claude Sonnet 4.5",
      "description": "Balanced performance and speed — ideal for most development tasks",
      "isDefault": true
    },
    {
      "provider": "bedrock",
      "modelId": "anthropic.claude-opus-4",
      "displayName": "Claude Opus 4",
      "description": "Highest capability model for complex reasoning and code generation",
      "isDefault": false
    },
    {
      "provider": "openai",
      "modelId": "gpt-4-turbo",
      "displayName": "GPT-4 Turbo",
      "description": "OpenAI's fastest high-intelligence model",
      "isDefault": false
    },
    {
      "provider": "openai",
      "modelId": "o1-preview",
      "displayName": "OpenAI o1 Preview",
      "description": "Advanced reasoning model for complex problem-solving",
      "isDefault": false
    },
    {
      "provider": "gemini",
      "modelId": "gemini-pro",
      "displayName": "Gemini Pro",
      "description": "Google's most capable model for text and code",
      "isDefault": false
    },
    {
      "provider": "gemini",
      "modelId": "gemini-1.5-pro",
      "displayName": "Gemini 1.5 Pro",
      "description": "Enhanced version with improved performance",
      "isDefault": false
    }
  ]
}
```

#### Response Schema

```typescript
interface ModelsResponse {
  models: ModelMetadata[];
}

interface ModelMetadata {
  provider: 'bedrock' | 'openai' | 'gemini';
  modelId: string;
  displayName: string;
  description?: string;
  isDefault: boolean;
}
```

**Field Descriptions**:

- `provider` (string, required): AI provider name. One of: `bedrock`, `openai`, `gemini`
- `modelId` (string, required): Provider-specific model identifier
- `displayName` (string, required): Human-readable model name for UI display
- `description` (string, optional): Brief description of model capabilities
- `isDefault` (boolean, required): Whether this is the default model (exactly one model will have `true`)

#### Error Response

**Code**: `500 Internal Server Error`

**Content example**:

```json
{
  "error": "Failed to fetch available models",
  "message": "Error details here"
}
```

## Usage Examples

### JavaScript/TypeScript (fetch)

```typescript
const response = await fetch('/api/models');
const data = await response.json();

if (response.ok) {
  console.log('Available models:', data.models);
  const defaultModel = data.models.find(m => m.isDefault);
  console.log('Default model:', defaultModel);
} else {
  console.error('Error:', data.error);
}
```

### React Component Example

```typescript
import { useState, useEffect } from 'react';

interface ModelMetadata {
  provider: string;
  modelId: string;
  displayName: string;
  description?: string;
  isDefault: boolean;
}

export function ModelSelector() {
  const [models, setModels] = useState<ModelMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/models')
      .then(res => res.json())
      .then(data => {
        setModels(data.models);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) return <div>Loading models...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <select>
      {models.map(model => (
        <option 
          key={`${model.provider}-${model.modelId}`} 
          value={model.modelId}
        >
          {model.displayName} {model.isDefault && '(Default)'}
        </option>
      ))}
    </select>
  );
}
```

### cURL

```bash
curl http://localhost:3000/api/models
```

## Caching

The endpoint includes cache headers for performance optimization:

```
Cache-Control: public, s-maxage=3600, stale-while-revalidate=7200
```

- Response is cached for 1 hour (3600 seconds)
- Stale content can be served for up to 2 hours while revalidating

## Notes

- The list of available models is currently hardcoded
- Future enhancement: Configure available models via environment variables
- Default model: Claude Sonnet 4.5 (Bedrock)
- Model selection applies only to dev agents in workflows
- System agents (designers, reviewers) always use the default model

## Related Types

See `src/lib/workflow/types.ts` for the complete type definitions:

```typescript
export type ModelConfig = 
  | { provider: 'bedrock'; modelId: string }
  | { provider: 'openai'; modelId: string }
  | { provider: 'gemini'; modelId: string };
```

## Testing

Run tests with:

```bash
npm test src/app/api/models/route.test.ts
```

Run with coverage:

```bash
npm run test:coverage
```

Target coverage: >80% for all metrics (statements, branches, functions, lines)
