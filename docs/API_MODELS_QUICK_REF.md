# GET /api/models - Quick Reference

## Endpoint
**URL**: `/api/models`  
**Method**: GET  
**Auth**: None required

## Response (200 OK)

```json
{
  "models": [
    {
      "provider": "bedrock" | "openai" | "gemini",
      "modelId": "string",
      "displayName": "string",
      "description": "string (optional)",
      "isDefault": boolean
    }
  ]
}
```

## Default Model

- **Provider**: bedrock
- **Model ID**: anthropic.claude-sonnet-4-5
- **Display Name**: Claude Sonnet 4.5
- **isDefault**: true

## Available Models (6 total)

### BEDROCK
- `anthropic.claude-sonnet-4-5` (DEFAULT)
- `anthropic.claude-opus-4`

### OPENAI
- `gpt-4-turbo`
- `o1-preview`

### GEMINI
- `gemini-pro`
- `gemini-1.5-pro`

## Cache Headers

```
Cache-Control: public, s-maxage=3600, stale-while-revalidate=7200
```

- Cached for 1 hour
- Stale content served for up to 2 hours

## Error Response (500)

```json
{
  "error": "Failed to fetch available models",
  "message": "Error details"
}
```

## Testing

```bash
# Run tests
npm test src/app/api/models/route.test.ts

# Run with coverage
npm run test:coverage
```

## Documentation

- **Full API docs**: [API_MODELS.md](../API_MODELS.md)
- **API directory guide**: [src/app/api/README.md](../../src/app/api/README.md)

## Related Files

- **Types**: `src/lib/workflow/types.ts` (ModelConfig)
- **Validation**: `src/lib/workflow/model-config.ts`

## Status

✅ **Production Ready**
- 17 tests passing
- >80% code coverage
- Fully documented
- Type-safe
- Ready for frontend integration

---

**PR**: #15  
**Branch**: feature/TEAM-76-api-dev  
**Ticket**: TEAM-76
