# Middleware

Import factories from `frappe-js-client/middleware`. Nothing runs unless you pass it to `createFrappeClient({ middleware })` or `withMiddleware`. The first array entry is the **outermost** wrapper (runs first, sees the response last).

There is no `logging()` middleware. Use `logger: consoleLogger()` on the client.

```typescript
import { createFrappeClient, consoleLogger } from 'frappe-js-client'
import { retry, timing } from 'frappe-js-client/middleware'

const frappe = createFrappeClient({
    url,
    frappeVersion: 16,
    logger: consoleLogger(),
    middleware: [
        retry({ attempts: 2, baseDelayMs: 250 }),
        timing({ onTiming: (e) => console.debug(e.path, e.durationMs) }),
    ],
})
```

`withMiddleware(...mw)` **appends** to the existing list.

## `retry(options?)`

| Option              | Default                        | Meaning                                                                                    |
| ------------------- | ------------------------------ | ------------------------------------------------------------------------------------------ |
| `attempts`          | `2`                            | Extra tries after the first failure (2 → 3 total sends).                                   |
| `baseDelayMs`       | `250`                          | Delay before the first retry; doubles each attempt.                                        |
| `maxDelayMs`        | `30000`                        | Caps exponential backoff.                                                                  |
| `jitter`            | `false`                        | Uses full jitter between zero and the calculated backoff.                                  |
| `respectRetryAfter` | `true`                         | Uses a valid `Retry-After` delay from 429/5xx responses.                                   |
| `methods`           | `GET`, `HEAD`, `PUT`, `DELETE` | POST/PATCH are not retried by default (a lost response does not mean the mutation failed). |
| `shouldRetry`       | network / 429 / 5xx            | Return `true` to retry.                                                                    |

Default `shouldRetry` does **not** retry `CancelledError` or `TimeoutError`. It does retry `TransportError` and HTTP 429 / 5xx on the allowed methods.

Each retry gets a full per-attempt `timeout`. `RequestOptions.deadline` is shared across attempts.
Deadline expiration interrupts retry backoff and prevents another attempt. `Retry-After` accepts delta-seconds or an HTTP date. `attempts` must be a finite non-negative integer; `baseDelayMs` and `maxDelayMs` must be finite and non-negative. Invalid values throw `ConfigurationError` when `retry()` is constructed.

## `timing({ onTiming })`

Calls `onTiming({ method, path, durationMs, status? })` after the inner pipeline (including on throw — then `status` is omitted). `path` is pathname only (no query). Correlation ids belong on `logger`, not here.

## `composeMiddleware(middleware, terminal)`

Builds the same pipeline the client uses. Useful if you write a custom `Transport` and still want `retry` / `timing`. The first array entry is outermost.

## Custom middleware

```typescript
import type { Middleware } from 'frappe-js-client/middleware'

const addTrace: Middleware = async (req, next) => {
    req.headers['X-Trace'] = req.requestId
    const res = await next(req)
    return res
}

const frappe = createFrappeClient({ url, frappeVersion: 16, middleware: [addTrace] })
```

`FrappeRequest`: `method`, `url`, `headers`, `body`, `signal`, `deadline`, `requestId`.

`FrappeResponse`: `status`, `statusText`, `headers`, `body`, `responseText?`.

### Fail closed

If middleware returns a response whose `status` is not 2xx, the client still throws `FrappeError` (`mapServerError`). Returning `{ status: 404, ... }` does not succeed the call. Throw, or return 2xx.

## Redaction helpers

`redactHeaders(headers)` and `redactBody(body)` strip secrets for logs you write yourself. They never mutate the original.

| Helper          | Redacted keys                                                                     |
| --------------- | --------------------------------------------------------------------------------- |
| `redactHeaders` | `authorization`, `cookie`, `x-frappe-csrf-token`, `set-cookie` (case-insensitive) |
| `redactBody`    | `api_secret`, `pwd`, `password`, `secret` (top-level keys only)                   |

The built-in `logger` never receives headers or bodies, so you do not need these for `consoleLogger()`.

## Upload progress

`file.upload(..., { onProgress })` cannot be used on a client that has **any** middleware. Progress uses XHR, which cannot run the pipeline. Throws `ConfigurationError`. Remove middleware from that client, or omit `onProgress`.
