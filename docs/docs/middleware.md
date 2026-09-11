# Middleware

Import factories from `frappe-js-client/middleware`. Nothing runs unless you pass it to `createFrappeClient({ middleware })` or `withMiddleware`. The first array entry is the **outermost** wrapper (runs first, sees the response last).

There is no `logging()` middleware. Use `logger: consoleLogger()` on the client.

```typescript
import { createFrappeClient, consoleLogger } from 'frappe-js-client'
import { retry, timing } from 'frappe-js-client/middleware'

const frappe = createFrappeClient({
    url,
    logger: consoleLogger(),
    middleware: [
        retry({ attempts: 2, baseDelayMs: 250 }),
        timing({ onTiming: (e) => console.debug(e.path, e.durationMs) }),
    ],
})
```

## `retry(options?)`

| Option        | Default                        | Meaning                                                                                    |
| ------------- | ------------------------------ | ------------------------------------------------------------------------------------------ |
| `attempts`    | `2`                            | Extra tries after the first failure (2 → 3 total sends).                                   |
| `baseDelayMs` | `250`                          | Delay before the first retry; doubles each attempt.                                        |
| `methods`     | `GET`, `HEAD`, `PUT`, `DELETE` | POST/PATCH are not retried by default (a lost response does not mean the mutation failed). |
| `shouldRetry` | network / 429 / 5xx            | Return `true` to retry.                                                                    |

Default `shouldRetry` does **not** retry `CancelledError` or `TimeoutError`. It does retry `TransportError` and HTTP 429 / 5xx on the allowed methods.

Each retry gets a full per-attempt `timeout`. `RequestOptions.deadline` is shared across attempts.

## `timing({ onTiming })`

Calls `onTiming({ method, path, durationMs, requestId, status? })` after the inner pipeline. `path` is pathname only (no query).

## `composeMiddleware(middleware, terminal)`

Builds the same pipeline the client uses. Useful if you write a custom `Transport` and still want `retry` / `timing`.

## Redaction helpers

`redactHeaders(headers)` and `redactBody(body)` strip secrets for logs you write yourself. The built-in `logger` never receives headers or bodies, so you do not need these for `consoleLogger()`.

## Upload progress

`file.upload(..., { onProgress })` cannot be used on a client that has **any** middleware. Progress uses XHR, which cannot run the pipeline. Throws `ConfigurationError`. Remove middleware from that client, or omit `onProgress`.
