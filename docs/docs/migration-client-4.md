# Migrate to frappe-js-client 4.0

`frappeVersion` is required when creating a production client. Set it to the server major release. Frappe 14 defaults to classic API v1 and rejects API v2; Frappe 15/16 default to API v2 and still accept explicit API v1.

```ts
const client = createFrappeClient({ url, frappeVersion: 16, auth })
```

Generated maps can now be passed together. Known DocType names require their mapped create, update, and bulk-insert payloads. For a DocType name known only at runtime, a `string` variable remains available with weaker compile-time guarantees. Regenerate types with frappe-codegen 2.0 to get insert maps with child-table insert shapes and optional Check defaults.

```ts
const client = createFrappeClient<GeneratedDocTypes, GeneratedInserts>({ url, frappeVersion: 16, auth })
await client.db.createDoc('ToDo', { description: 'Follow up' })
```

A custom `Transport.request()` now receives one prepared HTTP operation: an absolute URL, method, merged headers, serialized `body`, credentials, response type, progress callback, and cancellation signal. It performs one attempt and returns `{ data, status, statusText, headers }` even for non-2xx HTTP responses. The client pipeline applies authentication, middleware, retries, deadlines, error mapping, and logging. Remove URL construction, authentication, retries, and error mapping from custom transports. Middleware now runs for XHR upload-progress requests.

`createTestClient()` and `createExtendedTestClient()` default to Frappe 16 and API v2. `MemoryTransport` receives the same prepared request shape; route predicates can inspect `new URL(req.url).searchParams` and serialized `req.body`. A direct memory transport call returns the raw HTTP response. Client calls still map errors through the pipeline. `MemoryTransportOptions.auth` and `baseUrl` are removed because authentication belongs to the client pipeline.

Standard Frappe endpoints now reject malformed `{ data }` and `{ message }` success envelopes with `ResponseError`. Custom RPC result types remain the caller's responsibility. Unknown server exception names, including JavaScript prototype property names, remain inside the `FrappeError` hierarchy.

Internal adapter and wiring types are not supported extension points. Use `Transport`, `AuthStrategy`, and `Middleware` from the public entry points. Keep the previous stable client available while migrating with `pnpm add frappe-js-client@3.4.0` (or the equivalent npm command).
