# API Routes

This directory contains Next.js App Router API endpoints for the AgentCore Console.

## Structure

```
src/app/api/
├── models/          # Model selection endpoints
│   ├── route.ts     # GET /api/models
│   └── route.test.ts
└── README.md       # This file
```

## Available Endpoints

### GET /api/models

Returns available AI models for workflow execution.

**Documentation**: See [API_MODELS.md](../../../docs/API_MODELS.md)

**Example Request**:
```bash
curl http://localhost:3000/api/models
```

**Example Response**:
```json
{
  "models": [
    {
      "provider": "bedrock",
      "modelId": "anthropic.claude-sonnet-4-5",
      "displayName": "Claude Sonnet 4.5",
      "description": "Balanced performance and speed",
      "isDefault": true
    }
  ]
}
```

## Development

### Running Tests

```bash
# Run all tests
npm test

# Run tests for specific endpoint
npm test src/app/api/models/route.test.ts

# Run with coverage
npm run test:coverage

# Run with UI
npm run test:ui
```

### Adding a New Endpoint

1. Create a new directory under `src/app/api/`
2. Add `route.ts` with your handler (GET, POST, etc.)
3. Add `route.test.ts` with comprehensive tests
4. Update this README with endpoint documentation
5. Add detailed docs to `docs/` if needed

**Example route.ts**:

```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Your logic here
    return NextResponse.json({ data: '...'}, { status: 200 });
  } catch (error) {
    console.error('[API] Error:', error);
    return NextResponse.json(
      { error: 'Error message' },
      { status: 500 }
    );
  }
}
```

## Code Standards

### TypeScript

- Use strict typing for all parameters and return values
- Import types from `@/lib/workflow/types` when applicable
- Define local interfaces for API-specific types

### Error Handling

- Always wrap handlers in try/catch
- Log errors with `console.error` including context
- Return appropriate HTTP status codes
- Return JSON error objects with `error` and `message` fields

### Testing

- Write comprehensive tests for all endpoints
- Test success cases, error cases, and edge cases
- Verify response format, status codes, and headers
- Aim for >80% code coverage
- Use vitest for unit/integration tests

### Caching

- Add appropriate `Cache-Control` headers for cacheable responses
- Consider stale-while-revalidate for frequently accessed data
- Document cache strategy in endpoint documentation

## Related Documentation

- [API Models Documentation](../../../docs/API_MODELS.md)
- [Workflow Types](../../lib/workflow/types.ts)
- [Model Configuration](../../lib/workflow/model-config.ts)
- [Vitest Configuration](../../../vitest.config.ts)
