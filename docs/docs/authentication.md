# Authentication

## Session methods (`frappe.auth`)

Classic login returns the **full envelope** (`message`, `home_page`, `full_name`, `tmp_id`, …), not a nested `.data` object. `getLoggedUser()` returns a **string**.

```typescript
const session = await frappe.auth.login({
    username: 'admin',
    password: 'password',
    device: 'desktop',
})

const otpSession = await frappe.auth.login({
    username: 'admin',
    password: 'password',
    otp: '123456',
    tmpId: session.tmp_id!,
    device: 'mobile',
})

const user: string = await frappe.auth.getLoggedUser()
await frappe.auth.ping() // classic: frappe.ping; v2: ping
await frappe.auth.forgetPassword('admin@example.com')
await frappe.auth.logout()
```

`login` accepts `UserPassCredentials` or `OTPCredentials` (`username` / `password` / `otp` / `tmpId` / `device`).

Password reset POSTs to `/api/method/frappe.core.doctype.user.user.reset_password`. Login, logout, and password reset always use classic `/api/method/...`, even when `apiVersion` is `2`.

`logout()` always calls the strategy `reset()`, including when the logout request fails.

## Strategies

Pass `auth` into `createFrappeClient`, or derive with `withAuth`:

| Helper                              | `name`      | Behavior                                                                                                                                   |
| ----------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `anonymousAuth()`                   | `anonymous` | Default. No headers.                                                                                                                       |
| `tokenAuth({ apiKey, apiSecret })`  | `token`     | `Authorization: token key:secret`. Server-side only.                                                                                       |
| `bearerAuth({ token, scheme? })`    | `bearer`    | `token` is `() => string \| Promise \| undefined`. `scheme` defaults to `'Bearer'` (`'token'` is allowed). Empty tokens delete the header. |
| `oauthAuth({ getToken, refresh? })` | `oauth`     | Caches the token. Sends `Bearer`. On HTTP 401, `refresh` runs once and the request is retried. `reset()` clears the cache.                 |
| `cookieAuth()`                      | `cookie`    | Session cookies + CSRF.                                                                                                                    |

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

### `cookieAuth()`

- **Browser:** the browser cookie jar + CSRF from `window.csrf_token`, `<meta name="csrf-token">`, or the `csrf_token` cookie. `credentials` default to `'include'`.
- **Node:** an in-memory jar filled from `Set-Cookie` via `onResponse`. Sends `Cookie` and CSRF headers. The jar is on the strategy as `.jar`.

`AuthStrategy.onResponse(headers, req)` runs after every response. `cookieAuth()` uses it to merge `Set-Cookie` — there is no `captureCookies` hook.

Do not share one cookie-authenticated client across users in Node. Derive with `withAuth(cookieAuth())` per session.

## Custom strategy

There is no `customAuth()` helper. Implement `AuthStrategy`:

```typescript
import type { AuthStrategy } from 'frappe-js-client'

const hmacAuth: AuthStrategy = {
    name: 'hmac',
    async apply(headers, req) {
        headers['X-Signature'] = await sign(req)
    },
    onResponse(headers, req) {
        /* optional */
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

`onUnauthorized` returning `true` makes the transport call `apply` again and retry **once** (used by `oauthAuth` refresh).

## Credentials option

`createFrappeClient({ credentials })` sets `RequestInit.credentials` for the default transport. Default: `'include'` when `auth.name === 'cookie'` **and** the runtime is a browser; otherwise `'same-origin'`.
