# Theme Preferences API

RESTful API endpoints for managing user theme preferences in the AgentCore Console.

## Base URL

```
/api/preferences/theme
```

## Endpoints

### GET /api/preferences/theme

Retrieve the current theme preference for the session.

**Headers:**
- `x-session-id` (optional): Session identifier
- `Cookie: session-id` (optional): Session cookie

**Response:**
```json
{
  "theme": "light" | "dark" | "system"
}
```

**Status Codes:**
- `200 OK`: Theme preference retrieved successfully (defaults to "system" if not set)
- `500 Internal Server Error`: Server error

**Example:**
```bash
curl -X GET http://localhost:3000/api/preferences/theme
```

---

### PUT /api/preferences/theme

Update the theme preference for the session.

**Headers:**
- `Content-Type: application/json`
- `x-session-id` (optional): Session identifier
- `Cookie: session-id` (optional): Session cookie

**Request Body:**
```json
{
  "theme": "light" | "dark" | "system"
}
```

**Response:**
```json
{
  "theme": "light" | "dark" | "system",
  "updated": true
}
```

**Status Codes:**
- `200 OK`: Theme preference updated successfully
- `400 Bad Request`: Invalid theme value
- `500 Internal Server Error`: Server error

**Example:**
```bash
curl -X PUT http://localhost:3000/api/preferences/theme \
  -H "Content-Type: application/json" \
  -d '{"theme": "dark"}'
```

---

### DELETE /api/preferences/theme

Reset the theme preference to system default.

**Headers:**
- `x-session-id` (optional): Session identifier
- `Cookie: session-id` (optional): Session cookie

**Response:**
```json
{
  "deleted": true
}
```

**Status Codes:**
- `200 OK`: Theme preference reset successfully
- `500 Internal Server Error`: Server error

**Example:**
```bash
curl -X DELETE http://localhost:3000/api/preferences/theme
```

---

## Session Management

The API uses session identifiers to track user preferences:

1. **Cookie-based**: Automatically uses `session-id` cookie if present
2. **Header-based**: Falls back to `x-session-id` header
3. **Default**: Uses "default" session if neither is provided

## Storage

Currently uses in-memory storage via `Map<string, ThemePreference>`. This is suitable for:
- Development and testing
- Single-server deployments
- Session-based preferences

**Production Considerations:**
- Replace with database storage for persistence
- Consider Redis for distributed session storage
- Integrate with user authentication system

## Error Handling

All endpoints return consistent error responses:

```json
{
  "error": "Error message describing what went wrong"
}
```

## Integration with Frontend

The frontend should:

1. **On mount**: Check localStorage first, then call GET endpoint
2. **On change**: Update localStorage AND call PUT endpoint
3. **On reset**: Clear localStorage AND call DELETE endpoint

This ensures:
- Fast initial load (localStorage)
- Cross-device sync (API)
- Offline support (localStorage fallback)

**Example Frontend Integration:**

```typescript
// Get theme preference
const getTheme = async (): Promise<ThemePreference> => {
  const localTheme = localStorage.getItem('theme') as ThemePreference;
  if (localTheme) return localTheme;
  
  const response = await fetch('/api/preferences/theme');
  const data = await response.json();
  return data.theme;
};

// Update theme preference
const setTheme = async (theme: ThemePreference): Promise<void> => {
  localStorage.setItem('theme', theme);
  await fetch('/api/preferences/theme', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ theme }),
  });
};

// Reset theme preference
const resetTheme = async (): Promise<void> => {
  localStorage.removeItem('theme');
  await fetch('/api/preferences/theme', { method: 'DELETE' });
};
```

## Testing

See `tests/api/preferences/theme.test.ts` for integration tests.

**Manual Testing:**

```bash
# Start the dev server
npm run dev

# Test GET (should return system default)
curl http://localhost:3000/api/preferences/theme

# Test PUT (set to dark)
curl -X PUT http://localhost:3000/api/preferences/theme \
  -H "Content-Type: application/json" \
  -d '{"theme": "dark"}'

# Test GET again (should return dark)
curl http://localhost:3000/api/preferences/theme

# Test PUT with invalid value (should return 400)
curl -X PUT http://localhost:3000/api/preferences/theme \
  -H "Content-Type: application/json" \
  -d '{"theme": "invalid"}'

# Test DELETE (reset to system)
curl -X DELETE http://localhost:3000/api/preferences/theme
```

## Security Considerations

- No authentication required (follows current app pattern)
- Session IDs should be cryptographically secure if added
- Consider rate limiting for production
- Validate all inputs strictly
- No sensitive data stored in theme preferences