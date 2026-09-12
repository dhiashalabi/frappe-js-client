# Auth (`frappe.auth`)

Session helpers on the **core** client. These hit classic `/api/method/...` even when `apiVersion` is `2` — v16 `/api/v2/method/login` does not create a session.

How the client _authenticates_ each request (token, cookie, OAuth, …) lives on [`Authentication`](../authentication.md). This page is the `frappe.auth` module.

Every method accepts trailing [`RequestOptions`](../client.md#per-request-options).

## Methods

| Method                 | Returns        | Notes                                                                        |
| ---------------------- | -------------- | ---------------------------------------------------------------------------- |
| `login(credentials)`   | `AuthResponse` | Full login envelope, not a nested `.data` object                             |
| `getLoggedUser()`      | `string`       | Current user name                                                            |
| `logout()`             | `void`         | Always `reset()`s the auth strategy, including when the logout request fails |
| `forgetPassword(user)` | `void`         | POST `frappe.core.doctype.user.user.reset_password`                          |
| `ping()`               | `string`       | Health check: `ping` on v2, `frappe.ping` on classic REST                    |

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
await frappe.auth.ping()
await frappe.auth.forgetPassword('admin@example.com')
await frappe.auth.logout()
```

## Credentials

`login` accepts `UserPassCredentials` or `OTPCredentials`:

| Field      | First factor | OTP follow-up                                  |
| ---------- | ------------ | ---------------------------------------------- |
| `username` | required     | optional                                       |
| `password` | required     | optional                                       |
| `otp`      | optional     | required                                       |
| `tmpId`    | optional     | required (`tmp_id` from the previous response) |
| `device`   | optional     | optional (`desktop`, `mobile`, …)              |

Wire names: `usr`, `pwd`, `otp`, `tmp_id`, `device`.

## `AuthResponse`

Typical fields. Extra server keys exist at runtime (`[key: string]: unknown`).

| Field          | Meaning                                              |
| -------------- | ---------------------------------------------------- |
| `message`      | Status text (`Logged In`, …)                         |
| `home_page`    | Desk/home path                                       |
| `full_name`    | Display name                                         |
| `tmp_id`       | Second-factor token for the OTP request              |
| `verification` | `{ method, message?, status? }` when 2FA is required |
| `exc_type`     | Present on some failure envelopes                    |

## See also

- [Authentication](../authentication.md) — `tokenAuth`, `cookieAuth`, `oauthAuth`, custom strategies
- [Errors](../errors.md) — `AuthenticationError`, `CsrfError`
