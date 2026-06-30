# @timps/errors

Structured error types with 20 error codes, retryable detection, and factory methods.

```typescript
import { errors, TIMPSError, isRetryableError, formatError } from '@timps/errors'

throw errors.notFound('integration', 'github')
throw errors.rateLimited(60)

if (isRetryableError(error)) await retry()
```

## Error Codes

| Factory | Code | HTTP Status |
|---------|------|-------------|
| `notFound()` | `NOT_FOUND` | 404 |
| `unauthorized()` | `UNAUTHORIZED` | 401 |
| `forbidden()` | `FORBIDDEN` | 403 |
| `badRequest()` | `BAD_REQUEST` | 400 |
| `validation()` | `VALIDATION_ERROR` | 422 |
| `rateLimited()` | `RATE_LIMITED` | 429 |
| `timeout()` | `TIMEOUT` | 408 |
| `internal()` | `INTERNAL_ERROR` | 500 |

Plus: `NETWORK_ERROR`, `SERVICE_UNAVAILABLE`, `CONFLICT`, `PARSE_ERROR`, `ENCODING_ERROR`, `CERTIFICATE_ERROR`, `SSL_ERROR`, `HANDSHAKE_ERROR`, `ABORTED`, `REQUEST_SIZE_EXCEEDED`, `RESPONSE_SIZE_EXCEEDED`

## Exports

`TIMPSError`, `TIMPSErrorOptions`, `ErrorCodes`, `ErrorCode`, `errors` (factory object), `isTIMPSError()`, `getErrorCode()`, `isRetryableError()`, `formatError()`, `createError()`
