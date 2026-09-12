# Errors

Every failure throws a `FrappeError` (`extends Error`). `instanceof FrappeError` catches the whole taxonomy. Import from `frappe-js-client` or `frappe-js-client/errors`.

```typescript
import {
    AuthenticationError,
    CsrfError,
    DuplicateEntryError,
    FeatureNotSupportedError,
    FrappeError,
    NotFoundError,
    PermissionError,
    RateLimitError,
    TimeoutError,
    ValidationError,
} from 'frappe-js-client/errors'

try {
    await frappe.db.getDoc('User', 'missing')
} catch (error) {
    if (error instanceof FrappeError) {
        error.status // 0 on network / timeout / cancel (no HTTP response)
        error.statusText
        error.message
        error.frappeExceptionType
        error.exc // raw traceback when the server sent it
        error.serverMessages
        error.errors // v2 `{ errors: [...] }` entries, when present
        error.extra // unrecognized server fields; never shadows a named field
        error.request // { method, url, requestId }
        error.cause // original failure when mapped from a thrown network error
        error.responseText // raw body text when the transport decoded it
    }
}
```

`FrappeError` has **no index signature**. `error.stauts` (a typo) is a TypeScript error, not silent `undefined`. Extra server keys live under `extra`.

## Classes

| Class                      | When                                                                                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ConfigurationError`       | Bad client options, closed realtime instance, missing `socket.io-client`, upload progress + middleware, missing document name, invalid pagination |
| `FeatureNotSupportedError` | v2-only method on `apiVersion: 1`, or `validateLinkAndFetch` without `frappeVersion: 16`                                                          |
| `TransportError`           | No HTTP response (DNS, connection refused, TLS)                                                                                                   |
| `TimeoutError`             | Per-attempt `timeout` or wall-clock `deadline` elapsed (`extends TransportError`)                                                                 |
| `CancelledError`           | `AbortSignal` aborted the request (`extends TransportError`)                                                                                      |
| `ResponseError`            | A successful HTTP response has an invalid structural shape                                                                                        |
| `AuthenticationError`      | HTTP 401, or `exc_type: AuthenticationError`                                                                                                      |
| `PermissionError`          | HTTP 403, or `exc_type: PermissionError`                                                                                                          |
| `NotFoundError`            | HTTP 404, or `exc_type: DoesNotExistError`                                                                                                        |
| `ValidationError`          | HTTP 417, or `ValidationError` / `MandatoryError` / `LinkValidationError` / `UniqueValidationError` / `InvalidNameError`                          |
| `DuplicateEntryError`      | HTTP 409, or `exc_type: DuplicateEntryError`                                                                                                      |
| `RateLimitError`           | HTTP 429, or `exc_type: TooManyRequestsError`                                                                                                     |
| `CsrfError`                | `exc_type: CSRFTokenError`                                                                                                                        |
| `ServerError`              | Any other non-2xx                                                                                                                                 |

`exc_type` (v1) / `errors[0].type` (v2) wins over HTTP status when the type is recognized. Helpers `serverErrorFor`, `mapServerError`, `mapNetworkError`, `parseServerMessages`, and `isHttpOk` are exported for tests and custom transports.

`ConfigurationError` and `FeatureNotSupportedError` use `status: 0` (no HTTP round-trip).

## `ConfigurationError` cases

Thrown locally, before or instead of a network call:

- Missing / empty / non-http(s) `url`
- `apiVersion` not `1` or `2`
- `frappeVersion` not `14`, `15`, or `16`
- Non-positive or non-finite `timeout` / per-request `timeout`
- Non-finite `deadline`
- Pagination `limit` not a finite positive integer; `start` not a finite non-negative integer
- List `asDict: false` (typed list rows are object-shaped)
- `getDoc` / `updateDoc` / `deleteDoc` without a document name
- `retry()` constructed with invalid `attempts` / `baseDelayMs` / `maxDelayMs`
- `onUploadProgress` combined with client middleware
- `createRealtime().connect()` without `socket.io-client`
- Using a closed `FrappeRealtime` instance

## v1 vs v2 bodies

- **v1:** `exc_type`, `exception`, `exc`, `_server_messages`
- **v2:** `{ errors: [{ type, exception?, message?, title?, indicator? }] }` — no top-level `exc_type`

`message` is chosen in this order: `data.message` → `errors[0].message` → `serverMessages[0].message` → last non-empty line of `data.exception` → last non-empty line of `errors[0].exception` → HTML `<title>` when the body looks like HTML → `Request failed with status N`.

Binary downloads (`file.download`, prepared-report download) still produce a `FrappeError` when the server returns JSON in a `blob` / `arraybuffer` body — the transport always decodes non-2xx bodies as text.

`FrappeError.request.url` contains the origin and path only; query strings and fragments are removed so parameters such as API secrets cannot leak through error reporting. A parsed `Retry-After` delay is available as `retryAfterMs`, while raw response headers remain private.

`retry()` does not retry `CancelledError` or `TimeoutError`. It does retry `TransportError` and HTTP 429 / 5xx on idempotent verbs (GET/HEAD/PUT/DELETE) by default.

Middleware that returns a non-2xx `FrappeResponse` is still mapped through `mapServerError` (fail closed). See [Middleware](./middleware.md).
