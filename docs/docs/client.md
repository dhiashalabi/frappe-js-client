# Creating a client

```typescript
import { createFrappeClient, tokenAuth, consoleLogger } from 'frappe-js-client'
import { withExtended } from 'frappe-js-client/extended'
import { retry } from 'frappe-js-client/middleware'

const frappe = createFrappeClient({
    url: 'https://frappe.example.com',
    frappeVersion: 16,
    auth: tokenAuth({ apiKey: '...', apiSecret: '...' }),
    headers: { 'X-App': 'desk' },
    timeout: 30_000,
    logger: consoleLogger(),
    middleware: [retry()],
})
```

`createFrappeClient` returns an immutable client: frozen `config` plus modules. Core modules are properties, not factories: `frappe.db`, `frappe.auth`, `frappe.file`, `frappe.call`, `frappe.search`.

The optional `Docs` and `Inserts` generics default to `object`. Pass `GeneratedDocTypes` from [`frappe-codegen`](./codegen.md) so `db.getDoc('ToDo', name)` infers the row.

```typescript
const typed = createFrappeClient<GeneratedDocTypes, GeneratedInserts>({ url, frappeVersion: 16, auth })
```

## Options

| Option          | Default            | Meaning                                                                                                                                                                                                                                                             |
| --------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `url`           | **required**       | Site base URL (`http` or `https`). Trailing `/` is stripped. Stored as `config.baseUrl`.                                                                                                                                                                            |
| `apiVersion`    | `1` for Frappe 14; `2` for 15/16                | `1` = classic `/api/method` + `/api/resource`. `2` = `/api/v2` (Frappe 15+). Only `1` or `2`.                                                                                                                                                                       |
| `frappeVersion` | **required**              | `14` \| `15` \| `16`. Selects the supported server release, capability routing, and the default API generation. Frappe 14 rejects API v2. |
| `timeout`       | `30_000`           | Milliseconds, **per attempt**. Must be finite and `> 0`.                                                                                                                                                                                                            |
| `auth`          | `anonymousAuth()`  | See [Authentication](./authentication.md).                                                                                                                                                                                                                          |
| `headers`       | `{}`               | Lowest precedence; per-request headers win. Frozen on `config.headers`.                                                                                                                                                                                             |
| `siteName`      | unset              | When the URL host is not the Frappe site (e.g. `127.0.0.1` vs `frappe16.localhost`). Sets `X-Frappe-Site-Name`, and `Host` outside browsers (browsers forbid `Host`). In a browser without `siteName`, `X-Frappe-Site-Name` defaults to `window.location.hostname`. |
| `logger`        | off                | Receives pathname + method + status + duration + `requestId` only — never query, headers, or bodies. See [Logging](#logging).                                                                                                                                       |
| `middleware`    | `[]`               | First entry is outermost. See [Middleware](./middleware.md).                                                                                                                                                                                                        |
| `fetch`         | `globalThis.fetch` | Ignored if `transport` is set. For polyfills, instrumentation, or SSR runtimes without a global `fetch`.                                                                                                                                                            |
| `transport`     | `FetchTransport`   | Replace the network layer. `createTestClient()` injects `MemoryTransport`. `FetchTransport` is not a public export.                                                                                                                                                 |
| `credentials`   | see below          | `RequestInit.credentials` for the default transport.                                                                                                                                                                                                                |

**Credentials default:** `'include'` when `auth.name === 'cookie'` **and** the runtime is a browser; otherwise `'same-origin'`. XHR `withCredentials` follows the same rule.

Invalid `url`, `apiVersion`, `frappeVersion`, or timing values throw `ConfigurationError` **before** authentication or network activity — including when using an injected transport.

`url` must parse as `http:` or `https:`. Timeouts must be finite and positive. Per-request `deadline` must be a finite Unix timestamp in milliseconds.

## Frozen config

`frappe.config` is `FrappeClientConfig` (not the input options):

| Field           | Source                               |
| --------------- | ------------------------------------ |
| `baseUrl`       | Normalized `url` (no trailing slash) |
| `apiVersion`    | Version-derived default                          |
| `frappeVersion` | Required                             |
| `timeout`       | Default `30_000`                     |
| `siteName`      | Optional                             |
| `headers`       | Frozen copy                          |
| `auth`          | Strategy instance                    |
| `logger`        | Optional                             |
| `middleware`    | Frozen array                         |
| `fetch`         | Optional override                    |
| `transport`     | Optional override                    |
| `credentials`   | Optional override                    |

There is no `config.url`. Use `config.baseUrl`.

## Derived clients

`withAuth`, `withMiddleware`, and `withHeaders` return a **new** client. The original is unchanged.

| Method                  | Behavior                                                                |
| ----------------------- | ----------------------------------------------------------------------- |
| `withAuth(auth)`        | Replaces the strategy                                                   |
| `withMiddleware(...mw)` | **Appends** to the existing middleware list                             |
| `withHeaders(headers)`  | **Merges** over existing client headers (per-request headers still win) |

Do not share one cookie-authenticated client across users in a Node server — derive per session:

```typescript
import { cookieAuth } from 'frappe-js-client'

const perUser = frappe.withAuth(cookieAuth())
await perUser.auth.login({ username, password })
```

Extended modules stay attached when you derive from an extended client:

```typescript
const app = withExtended(frappe)
const authed = app.withAuth(tokenAuth({ apiKey: 'k', apiSecret: 's' }))
await authed.report.run('Sales Analytics')
```

`logger`, `transport`, `fetch`, `timeout`, `apiVersion`, `frappeVersion`, `siteName`, and `credentials` are copied onto the derived client. There is no `withLogger` / `withTimeout` helper — create a new client if those must change.

## Modules

| Property     | Package  | Role                                                         |
| ------------ | -------- | ------------------------------------------------------------ |
| `auth`       | core     | `login`, `getLoggedUser`, `logout`, `forgetPassword`, `ping` |
| `db`         | core     | Document CRUD, lists, bulk, passwords, link validation       |
| `call`       | core     | Arbitrary method RPC                                         |
| `file`       | core     | Multipart upload and blob download                           |
| `search`     | core     | Link search / titles                                         |
| `permission` | extended | `has` / `getForDoc`                                          |
| `workflow`   | extended | Transitions, apply, bulk approval                            |
| `desk`       | extended | Comments, assignments, tags, share                           |
| `report`     | extended | Report view, query reports, prepared reports                 |
| `site`       | extended | `getTimeZone`                                                |

`withExtended(client)` shares the same transport, auth, and config — it does not open a second HTTP client.

## Per-request options

Every public method (except `file.upload`, which uses `UploadOptions`) accepts a trailing `RequestOptions`:

```typescript
interface RequestOptions {
    signal?: AbortSignal
    timeout?: number // per attempt; overrides client timeout
    deadline?: number // wall-clock ms (`Date.now() + budget`) across retries
    headers?: Record<string, string>
    requestId?: string // generated if omitted; appears on `FrappeError.request.requestId`
}
```

`timeout` resets on each `retry()` attempt. `deadline` does not. The deadline covers authentication, token refresh, retry backoff, response parsing, and upload stream preparation as well as the network request.

Header overrides are case-insensitive: a per-request `authorization` replaces a configured `Authorization` entry instead of creating a duplicate.

Invalid per-request `timeout` / `deadline` throw `ConfigurationError` before the request is sent.

## Logging

Pass `logger: consoleLogger()` or any `{ debug(event: FrappeLogEvent): void }`.

`FrappeLogEvent`:

| Field        | Meaning                                                    |
| ------------ | ---------------------------------------------------------- |
| `method`     | HTTP method                                                |
| `path`       | Pathname only (query stripped)                             |
| `status`     | HTTP status, or the mapped `FrappeError.status` on failure |
| `durationMs` | Elapsed time                                               |
| `requestId`  | Correlation id                                             |
| `error`      | `Error.name` only (never `message`) when the request threw |

`consoleLogger()` writes a single `console.debug` line:

```text
[frappe-js-client] GET /api/v2/document/User/Administrator -> 200 (12.4ms) [uuid]
```

A throwing logger is ignored — it cannot fail the request. There is no `logging()` middleware.

## Custom transport

Implement `Transport` and pass it as `transport`:

```typescript
import type { Transport, TransportRequest, TransportResponse } from 'frappe-js-client'

const tracing: Transport = {
    async request<T>(req: TransportRequest): Promise<TransportResponse<T>> {
        // issue the HTTP call yourself, then return { data, status, statusText, headers }
    },
}

const frappe = createFrappeClient({ url, frappeVersion: 16, transport: tracing })
```

`TransportRequest` describes one prepared attempt: an absolute `url`, `method`, merged `headers`, serialized `body`, `credentials`, `responseType`, `signal`, and `onUploadProgress`. The transport returns a response for every HTTP status, including errors. The pipeline owns authentication, middleware, retry, timing, and error mapping.

For tests, use [`createTestClient`](./testing.md) (`MemoryTransport`) instead of a hand-rolled fake. The default `FetchTransport` is not exported.

Custom transports automatically inherit `retry`, timing, authentication, logging, and errors from the client pipeline. HTTP failures are mapped to `FrappeError` — see [Fail closed](#fail-closed).

## Fail closed

If middleware returns a `FrappeResponse` whose `status` is not 2xx, the client **throws** `mapServerError(...)`. Middleware cannot swallow HTTP errors by returning a non-2xx response. Throw or return 2xx.

## Dates in filters

Filter values are `string | number | boolean | null`. Do not pass `Date` objects (`JSON.stringify` would emit a UTC ISO instant, which Frappe does not accept).

```typescript
import { formatFrappeDate, formatFrappeDatetime } from 'frappe-js-client'

formatFrappeDate(new Date()) // YYYY-MM-DD, local time
formatFrappeDatetime(new Date()) // YYYY-MM-DD HH:mm:ss, local time
formatFrappeDatetime(new Date(), 'Asia/Riyadh') // explicit Frappe site timezone
```

Pass an IANA timezone from `frappe.site.getTimeZone()` when the runtime and Frappe site use different local timezones.

## Transport notes

- Default transport is `fetch`. It is not a public export.
- `onUploadProgress` (file uploads: `onProgress`) cannot be combined with client middleware — XHR cannot run the middleware pipeline (`ConfigurationError`).
- Without `XMLHttpRequest`, upload progress is best-effort (0% then 100%) around `fetch`.
- Query booleans encode as `'1'` / `'0'`.
- Auth `onUnauthorized` returning `true` replays **once per logical request**, even when retry middleware is also present.
- There is no `unsafeTransport()` helper.
