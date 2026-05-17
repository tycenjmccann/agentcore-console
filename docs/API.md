# API Documentation: Model Selector Endpoints

## Base URL

```
Production: https://agentcore-console.yourcompany.com
Staging: https://staging.agentcore-console.yourcompany.com
Local: http://localhost:3000
```

## Authentication

All API endpoints require authentication via session cookie or JWT token.

---

## GET /api/models

Retrieve the list of available AI models for workflow selection.

### Response

```json
{
  "models": [
    {
      "provider": "bedrock",
      "modelId": "global.anthropic.claude-sonnet-4-5-20250929-v1:0",
      "displayName": "Claude Sonnet 4.5",
      "description": "Balanced performance and speed",
      "isDefault": true
    }
  ]
}
```

### Caching
- Cache Duration: 1 hour (3600 seconds)
- CDN Compatible: Yes

---

## POST /api/workflow/start

Start a new workflow with optional model configuration.

### Request Body

```json
{
  "title": "Build Feature",
  "description": "Implementation task",
  "repoConfig": { /* ... */ },
  "sources": [],
  "modelConfig": {
    "provider": "openai",
    "modelId": "gpt-4-turbo"
  }
}
```

### Response

```json
{
  "workflowId": "wf_1234567890_abc123",
  "status": "started",
  "modelConfig": { /* ... */ },
  "url": "/workflow/wf_1234567890_abc123"
}
```

## Rate Limits

| Endpoint | Rate Limit |
|----------|------------|
| GET /api/models | 100/min |
| POST /api/workflow/start | 10/min |

## Version

Current version: 1.0 (2025-01-13)

Last Updated: 2025-01-13
