# Creating a client

```typescript
import { createFrappeClient, tokenAuth, consoleLogger } from 'frappe-js-client'
import { withExtended } from 'frappe-js-client/extended'
import { retry } from 'frappe-js-client/middleware'

const frappe = createFrappeClient({
    url: 'https://frappe.example.com',
    auth: tokenAuth({ apiKey: '...', apiSecret: '...' }),
    headers: { 'X-App': 'desk' },
    timeout: 30_000,
    logger: consoleLogger(),
    middleware: [retry()],
})
```

`createFrappeClient` returns a frozen config plus modules. Core modules are properties, not factories: `frappe.db`, `frappe.auth`, `frappe.file`, `frappe.call`, `frappe.search`.

## Options

| Option          | Default            | Meaning                                                                                                                                                                                                                                                             |
| --------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `url`           | **required**       | Site base URL (`http` or `https`). Trailing `/` is stripped. Stored as `config.baseUrl`.                                                                                                                                                                            |
| `apiVersion`    | `2`                | `1` = classic `/api/method` + `/api/resource`. `2` = `/api/v2` (Frappe 15+).                                                                                                                                                                                        |
| `frappeVersion` | unset              | `14` \| `15` \| `16`. Optional hint for release-specific capabilities.                                                                                                                                                                                              |
| `timeout`       | `30_000`           | Milliseconds, **per attempt**. Must be `> 0`.                                                                                                                                                                                                                       |
| `auth`          | `anonymousAuth()`  | See [Authentication](./authentication.md).                                                                                                                                                                                                                          |
| `headers`       | `{}`               | Lowest precedence; per-request headers win. Frozen on `config.headers`.                                                                                                                                                                                             |
| `siteName`      | unset              | When the URL host is not the Frappe site (e.g. `127.0.0.1` vs `frappe16.localhost`). Sets `X-Frappe-Site-Name`, and `Host` outside browsers (browsers forbid `Host`). In a browser without `siteName`, `X-Frappe-Site-Name` defaults to `window.location.hostname`. |
| `logger`        | off                | Receives pathname + method + status + duration + `requestId` only — never query, headers, or bodies. `consoleLogger()` writes to `console.debug`. A throwing logger is ignored.                                                                                     |
| `middleware`    | `[]`               | First entry is outermost. See [Middleware](./middleware.md).                                                                                                                                                                                                        |
| `fetch`         | `globalThis.fetch` | Ignored if `transport` is set.                                                                                                                                                                                                                                      |
| `transport`     | `FetchTransport`   | Replace the network layer. `createTestClient()` injects `MemoryTransport`.                                                                                                                                                                                          |
| `credentials`   | see below          | `RequestInit.credentials` for the default transport.                                                                                                                                                                                                                |

**Credentials default:** `'include'` when `auth.name === 'cookie'` **and** the runtime is a browser; otherwise `'same-origin'`. XHR `withCredentials` follows the same rule.

Invalid `url` or `timeout` throws `ConfigurationError`.

## Derived clients

`withAuth`, `withMiddleware`, and `withHeaders` return a **new** client sharing nothing mutable except what you pass in. Do not share one cookie-authenticated client across users in a Node server — derive per session:

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

`timeout` resets on each `retry()` attempt. `deadline` does not.

## Dates in filters

Filter values are `string | number | boolean | null`. Do not pass `Date` objects. Format with `formatFrappeDate` / `formatFrappeDatetime` from `frappe-js-client` (`YYYY-MM-DD` / `YYYY-MM-DD HH:mm:ss` in local time).

## Transport notes

- Default transport is `fetch`. It is not a public export.
- `onUploadProgress` (file uploads: `onProgress`) cannot be combined with client middleware — XHR cannot run the middleware pipeline (`ConfigurationError`).
- Without `XMLHttpRequest`, upload progress is best-effort (0% then 100%) around `fetch`.
- Query booleans encode as `'1'` / `'0'`.
