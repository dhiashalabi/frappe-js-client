# Packages

This repo publishes two npm packages. The client never depends on codegen.

| Package            | npm                                                                  | Role                                              |
| ------------------ | -------------------------------------------------------------------- | ------------------------------------------------- |
| `packages/client`  | [`frappe-js-client`](https://www.npmjs.com/package/frappe-js-client) | REST client                                       |
| `packages/codegen` | [`frappe-codegen`](https://www.npmjs.com/package/frappe-codegen)     | CLI + library that emits typed DocType interfaces |

Node **20+**. Optional peer on the client: `socket.io-client` ^4, only for `frappe-js-client/realtime`.

## `frappe-js-client`

Zero runtime dependencies.

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

There is no `unsafeTransport()` helper. Pass a `Transport` as `createFrappeClient({ transport })`.

ESM and CJS are both published (`import` / `require`). Types resolve via `exports`.

### Guides

- [Creating a client](./client.md)
- [Authentication](./authentication.md)
- [Middleware](./middleware.md)
- [Errors](./errors.md)
- [Testing](./testing.md)
- [Realtime](./realtime.md)
- [TypeScript](./typescript.md)
- [Frappe versions](./frappe-versions.md)
- Generated API: **Client API** in the sidebar

## `frappe-codegen`

Depends on `frappe-js-client`. Requires Frappe **v15+** (`apiVersion: 2`) because meta is `GET /api/v2/doctype/{doctype}/meta`.

- Binary: `frappe-codegen`
- Programmatic: `import { generateModule, resolveDocTypes, … } from 'frappe-codegen'`
- One export map (`.`); the CLI is not a library export

Full guide: [Codegen](./codegen.md). Generated API: **Codegen API** in the sidebar.
