# frappe-js-client

Zero-dependency TypeScript/JavaScript client for [Frappe Framework](https://frappeframework.com) REST APIs (v14, v15, v16). Uses `globalThis.fetch`.

Supports **Frappe v14, v15, and v16**. Default `apiVersion` is **`2`** (`/api/v2`, Frappe 15+). Pass `{ apiVersion: 1 }` for classic `/api/method` + `/api/resource` (the v14-safe path). Realtime is optional (`frappe-js-client/realtime` + `socket.io-client`); core is zero-dependency.

**Docs:** [dhiashalabi.github.io/frappe-js-client](https://dhiashalabi.github.io/frappe-js-client/)

## Packages

| Package                                | npm                         | Role                                    |
| -------------------------------------- | --------------------------- | --------------------------------------- |
| [`packages/client`](packages/client)   | `frappe-js-client`          | REST client                             |
| [`packages/codegen`](packages/codegen) | `@frappe-js-client/codegen` | CLI that emits typed DocType interfaces |

Requires **Node.js 20+** and **pnpm 11**.

## Install

```bash
pnpm add frappe-js-client
```

```typescript
import { createFrappeClient, tokenAuth } from 'frappe-js-client'

const frappe = createFrappeClient({
    url: 'https://frappe.example.com',
    auth: tokenAuth({ apiKey: '...', apiSecret: '...' }),
})

const users = await frappe.db.getDocList('User', { fields: ['name', 'email'], limit: 20 })
```

## Development

```bash
pnpm install
pnpm gate
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, tests, and the changeset workflow.

## License

MIT
