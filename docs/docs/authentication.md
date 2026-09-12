# Authentication

How the client attaches credentials to **every** request. Session methods (`login`, `logout`, …) are on [`frappe.auth`](./modules/auth.md).

Pass `auth` into `createFrappeClient`, or derive with `withAuth`.

## Strategies

| Helper                              | `name`      | Behavior                                                                                                                                                                                         |
| ----------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `anonymousAuth()`                   | `anonymous` | Default. No headers.                                                                                                                                                                             |
| `tokenAuth({ apiKey, apiSecret })`  | `token`     | `Authorization: token key:secret`. Server-side only.                                                                                                                                             |
| `bearerAuth({ token, scheme? })`    | `bearer`    | `token` is `() => string \| Promise \| undefined`. `scheme` defaults to `'Bearer'` (`'token'` is allowed). Empty tokens delete the header.                                                       |
| `oauthAuth({ getToken, refresh? })` | `oauth`     | Caches the token. Concurrent loads/refreshes are deduplicated. On HTTP 401, `refresh` runs once and the request is replayed once. `reset()` clears the cache and invalidates late async results. |
| `cookieAuth()`                      | `cookie`    | Session cookies + CSRF.                                                                                                                                                                          |

```typescript
import { oauthAuth } from 'frappe-js-client'

const auth = oauthAuth({
    getToken: () => storedAccessToken,
    refresh: async () => {
        storedAccessToken = await refreshAccessToken()
        return storedAccessToken
    },
})
```

### `tokenAuth`

Frappe API key/secret. Safe for server-side use only — the secret must not ship to a browser bundle.

### `bearerAuth`

Caller-supplied accessor. `scheme` is `'Bearer'` (OAuth) or `'token'` (Frappe API-key style). If `token()` returns empty/`undefined`, the `Authorization` header is removed.

### `oauthAuth`

Always sends `Bearer`. Optional `refresh` runs at most **once per request** after HTTP 401; a second 401 is `AuthenticationError`. `reset()` (called from `logout()`) bumps an internal generation so in-flight loads cannot write a stale token back.

### `cookieAuth()`

- **Browser:** the browser cookie jar + CSRF from `window.csrf_token`, `<meta name="csrf_token">`, or the `csrf_token` cookie. `credentials` default to `'include'`.
- **Node:** an in-memory jar filled from `Set-Cookie` via `onResponse`. Cookies are matched by host/domain, path, expiry, and `Secure`; same-name cookies with different scopes are preserved. The CSRF header uses only a `csrf_token` cookie valid for the request URL. The jar is on the strategy as `.jar` (`Map<string, CookieRecord>`).

`AuthStrategy.onResponse(headers, req)` runs after every response, including a 401 that is followed by an authentication replay. `cookieAuth()` uses it to merge `Set-Cookie` — there is no `captureCookies` hook.

Do not share one cookie-authenticated client across users in Node. Derive with `withAuth(cookieAuth())` per session.

`logout()` always calls `reset()`, which clears the Node jar.

After `login()` in a headless SPA, `window.csrf_token` is not refreshed automatically — Desk embeds are fine; SPAs need a CSRF bootstrap. Browsers cannot read `HttpOnly` cookies (they still send them).

## Custom strategy

There is no `customAuth()` helper. Implement `AuthStrategy`:

```typescript
import type { AuthStrategy, FrappeRequestInfo } from 'frappe-js-client'

const hmacAuth: AuthStrategy = {
    name: 'hmac',
    async apply(headers, req: FrappeRequestInfo) {
        headers['X-Signature'] = await sign(req)
    },
    onResponse(headers, req) {
        /* optional; cookieAuth uses this for Set-Cookie */
    },
    reset() {
        /* optional; called from logout() */
    },
    async onUnauthorized() {
        // return true to retry the request once after re-apply
        return false
    },
}
```

`FrappeRequestInfo` is `{ method, url }` — never headers or body.

`onUnauthorized` returning `true` makes the transport call `apply` again and replay **once per logical request**, even when retry middleware is also present (used by `oauthAuth` refresh).

## Credentials option

`createFrappeClient({ credentials })` sets `RequestInit.credentials` for the default transport. Default: `'include'` when `auth.name === 'cookie'` **and** the runtime is a browser; otherwise `'same-origin'`.

## Session API

`frappe.auth.login` / `getLoggedUser` / `logout` / `forgetPassword` / `ping` — see [Auth](./modules/auth.md).
