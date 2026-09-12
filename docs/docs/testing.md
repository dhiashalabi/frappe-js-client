# Testing

`frappe-js-client/testing` builds a real `FrappeClient` (or extended client) backed by `MemoryTransport`. Application code typed `(client: FrappeClient) => …` can take the test client with no extra types.

```typescript
import {
    createTestClient,
    createExtendedTestClient,
    fixtureUser,
    fixtureValidationErrorBody,
    fixturePermissionErrorBody,
} from 'frappe-js-client/testing'

const { client, transport } = createTestClient()
transport.mock({
    method: 'GET',
    path: '/api/v2/document/User/Administrator',
    body: { data: fixtureUser },
})
const user = await client.db.getDoc('User', 'Administrator')

const ext = createExtendedTestClient({ apiVersion: 1, frappeVersion: 15 })
```

## Helpers

| Export                               | Returns                                                        |
| ------------------------------------ | -------------------------------------------------------------- |
| `createTestClient(options?)`         | `{ client: FrappeClient, transport: MemoryTransport }`         |
| `createExtendedTestClient(options?)` | `{ client: ExtendedFrappeClient, transport: MemoryTransport }` |
| `new MemoryTransport({ auth? })`     | In-memory `Transport` you can pass as `transport` yourself     |

Both helpers call `createFrappeClient({ url: 'https://test.local', transport, auth, ...options })`. Default `auth` is `anonymousAuth()`. Pass `apiVersion`, `frappeVersion`, `auth`, `headers`, `timeout`, `logger`, `middleware` the same way you would in production.

When `auth` is supplied, `MemoryTransport` calls `auth.onResponse` with each mocked response's headers — the same hook `FetchTransport` uses (cookie jar tests work).

## Mocking routes

```typescript
transport.mock({
    method: 'GET',
    path: '/api/v2/document/ToDo',
    body: { data: [], has_next_page: false },
    once: true, // consumed after one hit
})

transport.mock({
    method: 'GET',
    path: /^\/api\/v2\/document\/User/,
    match: (req) => req.params?.q === 'yes',
    status: 200,
    headers: { 'set-cookie': 'sid=abc; Path=/' },
    body: { data: fixtureUser },
})
```

`MemoryRoute`:

| Field     | Meaning                                                                                                     |
| --------- | ----------------------------------------------------------------------------------------------------------- |
| `method`  | HTTP method (compared case-insensitively)                                                                   |
| `path`    | Exact path or `RegExp` against the path **without** the query string (URL-decoded)                          |
| `status`  | Default `200`. Status `>= 400` is mapped through `mapServerError`                                           |
| `headers` | Become a `Headers` object; `cookieAuth().onResponse` sees them                                              |
| `body`    | Response body (already unwrapped later by the executor, so wrap `{ data }` / `{ message }` as Frappe would) |
| `once`    | Remove the route after one match                                                                            |
| `match`   | Extra predicate on the `TransportRequest`                                                                   |

`mock()` returns `this` so you can chain.

Non-2xx mocked responses (`status >= 400`) go through `mapServerError`, so `instanceof NotFoundError` works. An aborted `signal` throws `CancelledError`. No matching route throws a **plain** `Error` describing the missing mock (not a `FrappeError`). Status `3xx` is treated as success.

`transport.requests` is the list of `TransportRequest`s issued (in order). `transport.reset()` clears routes **and** requests.

`MemoryTransport` does not simulate timeouts or network failures unless you omit the route (plain `Error`) or mock a 5xx body.

## Browser tests

`FRAPPE_TEST_URL=http://frappe14.localhost:8000 pnpm test:browser` builds the package, then runs it in Chromium, Firefox, and WebKit. Cancellation and binary-error cases are local. Login, cookies, XHR upload progress, and authenticated downloads go to a separately managed Frappe site.

Use the site hostname in `FRAPPE_TEST_URL` when the bench is multi-tenant. The helper connects on loopback (so `*.localhost` works in Node) and sends that hostname as `X-Frappe-Site-Name`. Frappe 14 is detected automatically; set `FRAPPE_TEST_API_VERSION` / `FRAPPE_TEST_FRAPPE_VERSION` to override. If the URL is an IP address, set `FRAPPE_TEST_SITE_NAME`.

## Fixtures

| Export                       | Shape                                                 |
| ---------------------------- | ----------------------------------------------------- |
| `fixtureUser`                | A `FrappeDoc` User (`test.user@example.com`)          |
| `fixtureValidationErrorBody` | v1 `ValidationError` envelope with `_server_messages` |
| `fixturePermissionErrorBody` | v1 `PermissionError` envelope                         |

```typescript
transport.mock({
    method: 'GET',
    path: '/api/v2/document/ToDo/missing',
    status: 404,
    body: { errors: [{ type: 'DoesNotExistError', message: 'not found' }] },
})
```
