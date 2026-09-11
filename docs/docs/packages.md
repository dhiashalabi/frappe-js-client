# Packages

This repo publishes two npm packages. The client never depends on codegen.

| Package            | npm                                                                                    | Role                                              |
| ------------------ | -------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `packages/client`  | [`frappe-js-client`](https://www.npmjs.com/package/frappe-js-client)                   | REST client                                       |
| `packages/codegen` | [`@frappe-js-client/codegen`](https://www.npmjs.com/package/@frappe-js-client/codegen) | CLI + library that emits typed DocType interfaces |

## `frappe-js-client`

Zero runtime dependencies. Optional peer: `socket.io-client` ^4, only for `frappe-js-client/realtime`.

### Subpath exports

| Subpath        | What you import                                                                                                                                                                                                                                           |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.`            | `createFrappeClient`, `tokenAuth` / `cookieAuth` / `oauthAuth` / `bearerAuth` / `anonymousAuth`, `consoleLogger`, `formatFrappeDate` / `formatFrappeDatetime`, all error classes, core types, module types for `auth` / `db` / `file` / `call` / `search` |
| `./extended`   | `withExtended`, `ExtendedFrappeClient`, types for `permission` / `workflow` / `report` / `desk` / `site`                                                                                                                                                  |
| `./errors`     | Same error taxonomy as the root (`FrappeError`, `AuthenticationError`, …)                                                                                                                                                                                 |
| `./middleware` | `composeMiddleware`, `retry`, `timing`, `redactHeaders`, `redactBody`                                                                                                                                                                                     |
| `./types`      | Type-only barrel (`FrappeDoc`, `FrappeInsert`, `Link`, module interfaces). Codegen output imports this.                                                                                                                                                   |
| `./testing`    | `createTestClient`, `createExtendedTestClient`, `MemoryTransport`, fixtures                                                                                                                                                                               |
| `./realtime`   | `createRealtime` and realtime types                                                                                                                                                                                                                       |

There is no `logging()` middleware. Logging is `logger: consoleLogger()` on the client.

There is no `customAuth()` factory. Implement [`AuthStrategy`](./authentication.md) yourself.

## `@frappe-js-client/codegen`

Depends on `frappe-js-client`. Requires Frappe **v15+** (`apiVersion: 2`) because meta is `GET /api/v2/doctype/{doctype}/meta`.

- Binary: `frappe-codegen`
- Programmatic: `import { generateModule, resolveDocTypes, … } from '@frappe-js-client/codegen'`

Full guide: [Codegen](./codegen.md).
