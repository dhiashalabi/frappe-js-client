# frappe-js-client

> [!CAUTION]
> **`frappe-js-client` is deprecated.** It gets no new features and no fixes, including security fixes.
> Use [`@frappeforge/client`](https://www.npmjs.com/package/@frappeforge/client) instead.

**Why:** fixing the design of 3.x would break every app that uses it, so the fix is a new package.

1. **Frappe 16 needs a flag you have to remember.** `db.validateLink` calls an API Frappe 16 removed unless you pass `frappeVersion: 16`; the client never checks the server's version.
2. **Errors carry the server's Python traceback** (`FrappeError.exc`) into logs, error trackers and browsers.
3. **Two builds, two `FrappeError` classes.** The CommonJS and ES module builds can both load, and then `instanceof FrappeError` is `false` for a real Frappe error.
4. **Pagination can skip or repeat rows** when data changes during the walk, because it pages by offset.
5. **It targets end-of-life platforms:** Node.js 20 and Frappe v14.
6. **Method names don't match Frappe** (`db.getDoc` for `get_doc`), and **releases have no npm provenance.**

Full reasons and a method-by-method migration table: [DEPRECATION.md](https://github.com/dhiashalabi/frappe-js-client/blob/master/DEPRECATION.md).

Zero-dependency TypeScript/JavaScript client for [Frappe Framework](https://frappeframework.com) REST APIs (v14, v15, v16). Uses `globalThis.fetch`.

Supports **Frappe v14, v15, and v16**. Default `apiVersion` is **`2`** (`/api/v2`, Frappe 15+). Pass `{ apiVersion: 1 }` for classic `/api/method` + `/api/resource` (the v14-safe path). Realtime is optional (`frappe-js-client/realtime` + `socket.io-client`); core is zero-dependency.

**Docs:** [dhiashalabi.github.io/frappe-js-client](https://dhiashalabi.github.io/frappe-js-client/)

## Packages

| Package                                | npm                | Role                                    |
| -------------------------------------- | ------------------ | --------------------------------------- |
| [`packages/client`](packages/client)   | `frappe-js-client` | REST client                             |
| [`packages/codegen`](packages/codegen) | `frappe-codegen`   | CLI that emits typed DocType interfaces |

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
