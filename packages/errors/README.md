# TIMPS - Error Package

Error handling utilities and error codes.

## Usage

```typescript
import { errors, ErrorCodes, TIMPSError } from '@timps/errors';

// Create specific errors
throw errors.notFound('integration', 'github');
throw errors.unauthorized('Invalid token');
throw errors.rateLimited(60);

// Check if error is retryable
import { isRetryableError } from '@timps/errors';

if (isRetryableError(error)) {
  await retryOperation();
}
```

## Error Codes

| Code | Status | Description |
|------|--------|--------------|
| UNKNOWN | 500 | Unknown error |
| NOT_FOUND | 404 | Resource not found |
| UNAUTHORIZED | 401 | Authentication required |
| FORBIDDEN | 403 | Access denied |
| BAD_REQUEST | 400 | Invalid request |
| VALIDATION_ERROR | 422 | Validation failed |
| CONFLICT | 409 | Resource conflict |
| RATE_LIMITED | 429 | Too many requests |
| NETWORK_ERROR | 0 | Network issue |
| TIMEOUT | 408 | Request timed out |
| SERVER_ERROR | 500 | Server error |
| SERVICE_UNAVAILABLE | 503 | Service down |

## Retry Logic

Errors with `retryable: true` should be retried with exponential backoff.