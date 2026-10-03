# Deprecation of frappe-js-client and frappe-codegen

> [!CAUTION]
> **`frappe-js-client` is deprecated.** It gets no new features and no fixes, including security
> fixes. Use [`@frappeforge/client`](https://www.npmjs.com/package/@frappeforge/client)
> ([repository](https://github.com/frappeforge/frappeforge)).

Installed versions keep working. Nothing is unpublished, so existing lockfiles still install.

## Why deprecate instead of releasing 4.0

The problems below are in the design of 3.x, not in a few bugs. Fixing them changes the package
format, the error shape, the pagination contract and every method name. That would break every app
that uses the package, so a 4.0 would be a new library under the old name. That library is
`@frappeforge/client`, and it was written from scratch rather than ported.

### 1. On Frappe 16, correct behavior depends on a flag you have to remember

`db.validateLink` calls `frappe.client.validate_link`, which **Frappe 16 removed**. It switches to
the replacement only when you pass `frappeVersion: 16`. The client never checks which version the
server runs, so a v16 app without the flag compiles and passes review, then fails in production.
`search.searchWidget` and `db.getDocList({ expand })` depend on the same flag.

`@frappeforge/client` uses only server calls that behave the same on Frappe 15 and 16, so it has no
version flag.

### 2. Errors carry the server's Python traceback

`FrappeError.exc` holds the raw server traceback, which includes file paths, source lines and
sometimes the values being processed. Every `console.error(error)`, log line or error tracker
passes it on, including from a user's browser.

`@frappeforge/client` errors carry the server's own messages and never the traceback.

### 3. The package ships two copies of itself

`frappe-js-client` has a CommonJS build and an ES module build. When one part of an app loads one
build and another part loads the other, there are two `FrappeError` classes, and
`error instanceof FrappeError` returns `false` for a real Frappe error. This is the "dual package
hazard", and it makes error handling fail without any warning.

`@frappeforge/client` ships only an ES module build. CommonJS code on Node.js 22.12+ can still
`require()` it.

### 4. Paging through a list can skip or repeat rows

`db.paginate` and `getDocListPage` page by offset (`limit_start`). When a row is inserted or
deleted during the walk, every later page shifts: rows are skipped or returned twice. This affects
exports, syncs and batch jobs, and nothing reports it.

`frappe.doc.paginate` continues after the last `name` it read, so a row that matches for the whole
walk is returned exactly once, whatever changes during the walk.

### 5. It targets platforms that are end of life

The package supports Node.js 20 (end of life 30 April 2026) and Frappe v14 (end of life
31 January 2026). It keeps two REST adapters and the version flag mainly to serve them.

`@frappeforge/client` supports Frappe v15 and v16 on Node.js 22.12+, and any runtime with `fetch`.

### 6. Method names don't match Frappe

`frappe.db.getDoc` suggests direct database access. The package never had that: every call goes
through Frappe's document layer, permissions and hooks.

`@frappeforge/client` uses Frappe's own function names: `get_doc` is `frappe.doc.get`, and
`set_value` is `frappe.doc.setValue`. If you know Frappe's Python API, you already know the
client's.

### 7. Releases can't be verified

`frappe-js-client` was published without npm provenance, so nothing links a tarball on npm to the
source that built it.

Every `@frappeforge/*` release is built and published by CI with a signed provenance attestation,
which you can check with `npm audit signatures`.

## Migrating

`@frappeforge/client` is before `1.0.0`, so a minor version can still contain breaking changes.
Each one is listed in its changelog.

```sh
npm uninstall frappe-js-client
npm install @frappeforge/client
```

| `frappe-js-client`                                   | `@frappeforge/client`                              |
| ---------------------------------------------------- | -------------------------------------------------- |
| `createFrappeClient(options)`                        | `createClient(options)`                            |
| `tokenAuth`, `bearerAuth`, `cookieAuth`, `oauthAuth` | `tokenAuth`, `bearerAuth`, `sessionAuth`           |
| `auth.login`, `auth.logout`, `auth.getLoggedUser`    | `auth.login`, `auth.logout`, `auth.getLoggedUser`  |
| `db.getDoc`, `db.getSingle`                          | `doc.get`, `doc.getSingle`                         |
| `db.getDocList`, `db.paginate`                       | `doc.getList`, `doc.paginate`                      |
| `db.getCount`                                        | `doc.count`                                        |
| `db.getValue`, `db.getSingleValue`, `db.exists`      | `doc.getValue`, `doc.getSingleValue`, `doc.exists` |
| `db.validateLink`, `db.validateLinkAndFetch`         | `doc.validateLink`                                 |
| `db.isDocumentAmended`, `db.getPassword`             | `doc.isAmended`, `doc.getPassword`                 |
| `db.createDoc`, `db.insertMany`                      | `doc.insert`, `doc.insertMany`                     |
| `db.updateDoc`, `db.setValue`                        | `doc.setValue`                                     |
| `db.renameDoc`, `db.deleteDoc`                       | `doc.rename`, `doc.delete`                         |
| `db.submit`, `db.cancel`                             | `doc.submit`, `doc.cancel`                         |
| `permission.has`                                     | `doc.hasPermission`                                |
| `FrappeError` and its subclasses                     | `FrappeError` and its subclasses (no `exc`)        |
| `frappe-codegen`                                     | `@frappeforge/codegen` (not yet published)         |

Not in `@frappeforge/client` yet: `call` (whitelisted methods), `file` (upload and download),
`search`, `realtime`, `permission.getForDoc`, and the `workflow`, `report`, `desk` and `site`
modules. Until they land, call the endpoint with `frappe.request()`:

```ts
const { message } = await frappe.request<{ message: string }>({ path: '/api/method/frappe.ping' })
```

If you depend on one of these and can't use `request()`, pin `frappe-js-client@3` until it lands.
It keeps installing, but it will not change.
