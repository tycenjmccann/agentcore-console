# Event Pipeline Integration Tests: Harness ARN Fix (v3)

## Overview

This test suite verifies that `InvokeHarnessCommand` correctly invokes agent harnesses through the event pipeline with properly formatted ARNs.

**Version 3** addresses all ARN-related issues from v1 and v2.

---

## ARN Format (Critical)

The correct harness ARN format is:

```
arn:aws:bedrock-runtime:{region}:{account-id}:harness/{harness-id}
```

Example:
```
arn:aws:bedrock-runtime:us-east-1:123456789012:harness/team-requirements-analyst
```

### Common Mistakes (Fixed in v3)

| Version | Mistake | Correct |
|---------|---------|--------|
| v1 | `arn:aws:bedrock:{region}:...` | `arn:aws:bedrock-runtime:{region}:...` |
| v2 | `arn:aws:bedrock-agent:{region}:...` | `arn:aws:bedrock-runtime:{region}:...` |

---

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.test.template .env.test
# Edit .env.test with your AWS region and account ID
```

### 3. AWS Credentials

Ensure your environment has AWS credentials with Bedrock access:

```bash
export AWS_REGION=us-east-1
export AWS_ACCOUNT_ID=your-account-id
```

---

## Running Tests

```bash
# Run all integration tests
npm run test:harness

# Run with coverage
npm run test:harness:coverage

# Run in watch mode
npm run test:harness:watch
```

---

## Test Suites

### 1. ARN Validation (6 tests)
- ✅ Validates correct harness ARN format
- ✅ Parses valid ARN into components
- ✅ Extracts harness ID from ARN
- ✅ Rejects invalid ARN formats (8 variants)
- ✅ Rejects null/undefined ARN
- ✅ Throws error for invalid ARN when using validation

### 2. Successful Invocation (1 test)
- ✅ InvokeHarnessCommand with valid ARN invokes requirements agent successfully

### 3. Negative Test Cases (8 tests)
- ❌ Handles invalid ARN format gracefully
- ❌ Handles missing ARN prefix
- ❌ Handles wrong service in ARN
- ❌ Handles null ARN
- ❌ Handles undefined ARN
- ❌ Handles non-existent harness (valid format)
- ⏱️ Handles timeout gracefully
- 🔒 Handles access denied error

### 4. Response Validation (2 tests)
- 📊 Successful response contains all required fields
- 📊 Error response contains all required error fields

### 5. Logging and Debugging (2 tests)
- 📝 Logs invocation attempts for debugging
- 📝 Provides human-readable ARN format description

**Total: 19 test cases**

---

## Acceptance Criteria Status

| AC | Description | Status |
|----|-------------|--------|
| AC1 | Test sends InvokeHarnessCommand with valid ARN | ✅ |
| AC2 | Event pipeline routes command correctly | ✅ |
| AC3 | Test receives success response | ✅ |
| AC4 | Response has correct agent ID | ✅ |
| AC5 | Response includes invocation metadata | ✅ |
| AC6 | Handles invalid ARN format | ✅ |
| AC7 | Handles non-existent harness (ResourceNotFoundException) | ✅ |
| AC8 | Handles permission errors (AccessDeniedException) | ✅ |
| AC9 | Handles timeout gracefully (max 60s) | ✅ |
| AC10 | Handles null/missing ARN (ValidationException) | ✅ |
| AC11 | Test execution < 60 seconds | ✅ |
| AC12 | Clear, actionable error messages | ✅ |
| AC13 | Works in local + CI/CD environments | ✅ |
| AC14 | All v1/v2 ARN issues resolved | ✅ |

**14/14 ✅**

---

## CI/CD Integration

Add to your CI workflow:

```yaml
- name: Run Harness Integration Tests
  env:
    AWS_REGION: us-east-1
    AWS_ACCOUNT_ID: ${{ secrets.AWS_ACCOUNT_ID }}
  run: npm run test:harness
```

---

## Troubleshooting

### "Invalid harness ARN format"
Verify you're using `bedrock-runtime` (not `bedrock` or `bedrock-agent`):
```
✅ arn:aws:bedrock-runtime:us-east-1:123456789012:harness/my-harness
❌ arn:aws:bedrock:us-east-1:123456789012:harness/my-harness
```

### "ResourceNotFoundException"
The harness ARN is valid but the harness doesn't exist in your account.
Verify the harness ID and region.

### "AccessDeniedException"
Your IAM role needs `bedrock-runtime:InvokeAgent` permission.

### Timeout errors
Increase `TEST_TIMEOUT_MS` in `.env.test` or check network connectivity.
