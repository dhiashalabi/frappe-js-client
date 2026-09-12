# Realtime

`frappe-js-client/realtime` is an optional entry. Core `frappe-js-client` stays zero-dependency. Install the peer only if you use this module:

```bash
pnpm add socket.io-client
```

```typescript
import { createFrappeClient, tokenAuth } from 'frappe-js-client'
import { createRealtime } from 'frappe-js-client/realtime'

const frappe = createFrappeClient({
    url: 'https://frappe.example.com',
    auth: tokenAuth({ apiKey: '...', apiSecret: '...' }),
})

const realtime = createRealtime(frappe)
const stop = realtime.subscribeDoc('ToDo', 'TD-0001', (event) => {
    console.log(event.doctype, event.name)
})

realtime.subscribeDocType('ToDo', (event) => {
    console.log('list', event.doctype)
})

const stopViewers = realtime.subscribeDocViewers('ToDo', 'TD-0001', (event) => {
    console.log(event.viewers)
})

const stopDisconnect = realtime.on('disconnect', (reason) => {
    console.log(reason)
})

stop()
stopViewers()
stopDisconnect()
realtime.close()
```

## Options

`createRealtime(client, options?)`:

| Option                        | Default                    | Meaning                                                                                                                                             |
| ----------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `socketUrl`                   | `client.config.baseUrl`    | Socket.IO server URL                                                                                                                                |
| `allowCrossOriginCredentials` | `false`                    | Permit client cookies/authorization on a socket origin different from the HTTP site.                                                                |
| `path`                        | `/socket.io`               | Socket.IO path                                                                                                                                      |
| `reconnection`                | `true`                     |                                                                                                                                                     |
| `reconnectionAttempts`        | `Infinity`                 | Matches Frappe's `socketio_client.js`                                                                                                               |
| `reconnectionDelay`           | `1000`                     | ms                                                                                                                                                  |
| `reconnectionDelayMax`        | `5000`                     | ms                                                                                                                                                  |
| `transports`                  | `['websocket', 'polling']` | Tried in order                                                                                                                                      |
| `autoConnect`                 | `true`                     | Connect on create. Set `false` to call `.connect()` yourself.                                                                                       |
| `auth`                        | derived                    | Extra `socket.handshake.auth` payload. Object, or `(ctx) => …` / async. Merged over `{ cookie?, authorization? }` from the client's `AuthStrategy`. |

Client credentials are resolved again for every Socket.IO handshake, so rotating bearer/OAuth tokens are not captured permanently at construction. On a different `socketUrl` origin, client cookies and authorization are omitted unless `allowCrossOriginCredentials: true` is explicit. Custom `auth` values are still sent to the socket origin you selected.

`RealtimeAuthContext` is `{ cookie?, authorization? }` — values taken from `client.config.auth.apply(...)`.

## Methods

| Method                                        | Meaning                                                                                                                                      |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `connected`                                   | Whether the socket is currently connected                                                                                                    |
| `connect()`                                   | Connects if needed. Concurrent callers share one in-flight connect. Resolves on `connect`, rejects on `connect_error`.                       |
| `close()`                                     | Disconnects and drops all subscriptions. Safe to call more than once. After close, create a **new** instance — the old one cannot reconnect. |
| `subscribeDoc(doctype, name, handler)`        | `doc_update` for one document                                                                                                                |
| `subscribeDocType(doctype, handler)`          | `list_update` for a DocType                                                                                                                  |
| `subscribeDocViewers(doctype, name, handler)` | `doc_viewers` presence                                                                                                                       |
| `on(event, handler)`                          | Connection lifecycle: `connect`, `disconnect`, `reconnect`, `reconnect_attempt`, `reconnect_error`, `reconnect_failed`, `connect_error`      |

Every subscribe / `on` returns `Unsubscribe` (`() => void`).
Unsubscribe functions are idempotent. Multiple subscribers to the same document share one Socket.IO `doc_subscribe` until the last unsubscribe. Active document and DocType subscriptions are restored after Socket.IO reconnects without duplicating handlers. Calling a subscribe method after `close()` throws `ConfigurationError`.

`socket.io-client` is loaded lazily on `connect()`. Importing `frappe-js-client/realtime` without the peer installed is fine; `connect()` throws `ConfigurationError` if it is missing. Using a closed instance also throws `ConfigurationError`.

With `autoConnect: true` (default), a failed first connect is swallowed; later `.connect()` or `connect_error` listeners surface it.

## Event payloads

| Type              | Fields                                                                                                            |
| ----------------- | ----------------------------------------------------------------------------------------------------------------- |
| `DocUpdateEvent`  | `doctype`, `name`, plus any extra keys the server sent                                                            |
| `ListUpdateEvent` | `doctype`, plus extra keys                                                                                        |
| `DocViewersEvent` | `doctype`, `name`, `viewers: Array<{ user, ... }>`                                                                |
| `EvictionEvent`   | `{ userId?, ... }` — exported payload shape for Frappe's eviction message; there is no dedicated subscribe helper |

Connection `on()` payloads:

| Event               | Payload           |
| ------------------- | ----------------- |
| `connect`           | `void`            |
| `disconnect`        | `string` (reason) |
| `reconnect`         | `number`          |
| `reconnect_attempt` | `number`          |
| `reconnect_error`   | `Error`           |
| `reconnect_failed`  | `void`            |
| `connect_error`     | `Error`           |
