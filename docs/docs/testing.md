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

Both helpers call `createFrappeClient({ url: 'https://test.local', transport, auth, ...options })`. Default `auth` is `anonymousAuth()`. Pass `apiVersion`, `frappeVersion`, `auth`, `headers`, `timeout` the same way you would in production.

You can also construct `new MemoryTransport({ auth })` and pass it as `transport` yourself.

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
| `path`    | Exact path or `RegExp` against the path **without** the query string                                        |
| `status`  | Default `200`                                                                                               |
| `headers` | Become a `Headers` object; `cookieAuth().onResponse` sees them                                              |
| `body`    | Response body (already unwrapped later by the executor, so wrap `{ data }` / `{ message }` as Frappe would) |
| `once`    | Remove the route after one match                                                                            |
| `match`   | Extra predicate on the `TransportRequest`                                                                   |

Non-2xx mocked responses go through `mapServerError`, so `instanceof NotFoundError` works. An aborted `signal` throws `CancelledError`. No matching route throws a plain `Error` describing the missing mock.

`transport.requests` is the list of `TransportRequest`s issued. `transport.reset()` clears routes and requests.

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
