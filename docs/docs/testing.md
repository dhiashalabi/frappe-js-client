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
| `new MemoryTransport()`              | In-memory `Transport` you can pass as `transport` yourself     |

Both helpers use `https://test.local`, Frappe 16, and API v2 by default. Pass `apiVersion`, `frappeVersion`, `auth`, `headers`, `timeout`, `logger`, or `middleware` to override them.

The shared pipeline invokes authentication and response hooks for memory responses, including cookie-jar updates. `MemoryTransport` itself owns only mocked HTTP attempts.

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
    match: (req) => new URL(req.url).searchParams.get('q') === 'yes',
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
| `status`  | Default `200`. The client pipeline maps status `>= 400` through `mapServerError`                      |
| `headers` | Become a `Headers` object; `cookieAuth().onResponse` sees them                                              |
| `body`    | Response body (already unwrapped later by the executor, so wrap `{ data }` / `{ message }` as Frappe would) |
| `once`    | Remove the route after one match                                                                            |
| `match`   | Extra predicate on the `TransportRequest`                                                                   |

`mock()` returns `this` so you can chain.

Non-2xx mocked responses (`status >= 400`) go through `mapServerError` when used by a client, so `instanceof NotFoundError` works. A direct `MemoryTransport.request()` returns the raw response and requires an absolute URL, headers, and credentials. A cancelled client request throws `CancelledError`. No matching route throws an error describing the missing mock.

`transport.requests` records prepared attempts (absolute URLs, merged headers, serialized bodies) in order. `transport.reset()` clears routes **and** requests.

`MemoryTransport` does not simulate timeouts or network failures unless you omit the route (plain `Error`) or mock a 5xx body.

## Browser tests

`pnpm test:browser` builds the package and runs a self-contained fixture in Chromium, Firefox, and WebKit. It covers login, cookie and CSRF handling, cancellation, XHR upload progress, and authenticated download.

For a live site, run `FRAPPE_TEST_URL=http://frappe14.localhost:8000 pnpm test:browser:live` after building the client. Live mode fails at startup if the URL is missing or unreachable. Set `FRAPPE_TEST_API_VERSION`, `FRAPPE_TEST_FRAPPE_VERSION`, and `FRAPPE_TEST_SITE_NAME` as needed for the site.

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
