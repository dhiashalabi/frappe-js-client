# Frappe JS Client

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

[![npm version](https://badge.fury.io/js/frappe-js-client.svg)](https://badge.fury.io/js/frappe-js-client)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![docs](https://img.shields.io/badge/docs-dhiashalabi.github.io-blue)](https://dhiashalabi.github.io/frappe-js-client/)

Zero-dependency TypeScript/JavaScript client for [Frappe Framework](https://frappeframework.com) REST APIs. Uses `globalThis.fetch`.

Supports **Frappe v14, v15, and v16**. Default `apiVersion` is **`2`** (`/api/v2`, Frappe 15+). Pass `{ apiVersion: 1 }` for classic `/api/method` + `/api/resource` — that is the v14-safe path, and it also works on v15 and v16.

Realtime is optional: `frappe-js-client/realtime` with peer `socket.io-client`. Core stays zero-dependency.

**Docs:** [dhiashalabi.github.io/frappe-js-client](https://dhiashalabi.github.io/frappe-js-client/)

## Installation

```bash
pnpm add frappe-js-client
# or
npm install frappe-js-client
```

No runtime dependencies.

## Quick start

```typescript
import { createFrappeClient, tokenAuth, consoleLogger } from 'frappe-js-client'

const frappe = createFrappeClient({
    url: 'https://frappe.example.com',
    auth: tokenAuth({ apiKey: '...', apiSecret: '...' }),
    logger: consoleLogger(), // optional; pathname only, no query/headers/bodies
})

const user = await frappe.db.getDoc('User', 'Administrator')
```

Session login (classic `/api/method/login`):

```typescript
await frappe.auth.login({
    username: 'admin',
    password: 'password',
})
```

Extended modules (`permission`, `workflow`, `report`, `desk`, `site`):

```typescript
import { withExtended } from 'frappe-js-client/extended'

const app = withExtended(frappe)
await app.workflow.apply(doc, 'Approve')
```

Realtime (optional peer `socket.io-client`):

```typescript
import { createRealtime } from 'frappe-js-client/realtime'

const realtime = createRealtime(app)
realtime.subscribeDoc('ToDo', 'TD-1', (event) => console.log(event))
```

Full guides: [documentation](https://dhiashalabi.github.io/frappe-js-client/docs/getting-started). API reference: [Client API](https://dhiashalabi.github.io/frappe-js-client/docs/api) · [Codegen](https://dhiashalabi.github.io/frappe-js-client/docs/codegen).

## Development

Requires [pnpm](https://pnpm.io) 11 and Node.js **20+** (CI uses Node 22).

This package lives in a pnpm workspace. Clone the repo root, not `packages/client` alone:

```bash
git clone https://github.com/dhiashalabi/frappe-js-client.git
cd frappe-js-client
pnpm install
pnpm test
pnpm lint
pnpm build
pnpm docs:start
```

Unit tests: `pnpm test`. Integration and browser tests require a separately managed Frappe site:

```bash
FRAPPE_TEST_URL=http://frappe14.localhost:8000 pnpm test:integration
FRAPPE_TEST_URL=http://frappe14.localhost:8000 pnpm test:browser
```

Live tests need a running site. Do not commit credentials (`.env` / `.env.live` are gitignored):

```bash
FRAPPE_LIVE_URL=http://127.0.0.1:8001 pnpm test:live
```

If the URL host is not the Frappe site name (for example `127.0.0.1` vs `frappe16.localhost`), pass `siteName` into `createFrappeClient` so requests send `Host` / `X-Frappe-Site-Name`.

## License

MIT. See [LICENSE](LICENSE).

## Support

- [Issues](https://github.com/dhiashalabi/frappe-js-client/issues)
- [Discussions](https://github.com/dhiashalabi/frappe-js-client/discussions)
