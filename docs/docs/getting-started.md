---
sidebar_position: 1
---

# Getting started

`frappe-js-client` is a zero-dependency TypeScript client for [Frappe Framework](https://frappeframework.com) REST APIs (v14, v15, v16). Transport is `globalThis.fetch`.

## Install

```bash
pnpm add frappe-js-client
# or
npm install frappe-js-client
```

Node **20+** (or a browser with `fetch`). Optional peers:

| When                            | Install                                          |
| ------------------------------- | ------------------------------------------------ |
| Socket.IO document events       | `socket.io-client` (`frappe-js-client/realtime`) |
| Typed DocTypes from a live site | `frappe-codegen` (dev)                           |

## Quick start

```typescript
import { createFrappeClient, tokenAuth } from 'frappe-js-client'

const frappe = createFrappeClient({
    url: 'https://frappe.example.com',
    auth: tokenAuth({ apiKey: '...', apiSecret: '...' }),
})

const user = await frappe.db.getDoc('User', 'Administrator')
const open = await frappe.db.getDocList('ToDo', {
    fields: ['name', 'description', 'status'],
    filters: [['status', '=', 'Open']],
    limit: 10,
})
await frappe.auth.ping()
```

Default `apiVersion` is **`2`** (`/api/v2`, Frappe 15+). Pass `{ apiVersion: 1 }` for classic `/api/method` + `/api/resource` (required on Frappe 14). Login, logout, and password reset always use classic `/api/method/...` even on v2 — v16 `/api/v2/method/login` does not create a session.

## Core vs extended

The root import is the **core** client: `auth`, `db`, `file`, `call`, `search`.

Desk-adjacent modules live on `frappe-js-client/extended` so a CRUD-only consumer does not load them:

```typescript
import { withExtended } from 'frappe-js-client/extended'

const app = withExtended(frappe)
await app.workflow.apply({ doctype: 'ToDo', name: 'TD-1' }, 'Approve')
```

## Entry points

| Import                        | Role                                                                                |
| ----------------------------- | ----------------------------------------------------------------------------------- |
| `frappe-js-client`            | `createFrappeClient`, auth helpers, errors, types, `consoleLogger`, date formatters |
| `frappe-js-client/extended`   | `withExtended` — `permission`, `workflow`, `report`, `desk`, `site`                 |
| `frappe-js-client/errors`     | Error classes (also re-exported from the root)                                      |
| `frappe-js-client/middleware` | `retry`, `timing`, `composeMiddleware`, redaction helpers                           |
| `frappe-js-client/types`      | Type-only (`FrappeDoc`, module interfaces) — used by codegen output                 |
| `frappe-js-client/testing`    | `createTestClient`, `MemoryTransport`, fixtures                                     |
| `frappe-js-client/realtime`   | `createRealtime` (optional `socket.io-client`)                                      |

See [Packages](./packages.md) for the codegen CLI as well.

## Next

- [Creating a client](./client.md) — every `createFrappeClient` option
- [Frappe versions](./frappe-versions.md) — `apiVersion` vs `frappeVersion`
- [Authentication](./authentication.md)
- [Database](./modules/database.md)
- [Codegen](./codegen.md)
