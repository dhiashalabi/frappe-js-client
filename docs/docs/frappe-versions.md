# Frappe version support

REST generation (`apiVersion`) and Frappe release (`frappeVersion`) are independent.

| `apiVersion`  | Paths                           | Frappe                               |
| ------------- | ------------------------------- | ------------------------------------ |
| `1`           | `/api/method` + `/api/resource` | v14, v15, v16                        |
| `2` (default) | `/api/v2/*`                     | v15, v16 — **does not exist on v14** |

This client **never** calls `/api/v1/...`. That prefix 404s on v14. Classic unversioned paths still work on v15 and v16.

Pass `frappeVersion: 14 | 15 | 16` when you know the site's release. It only affects capabilities that differ by release. When omitted, every capability uses the conservative value that is correct on every supported release.

## Capabilities

`Capabilities` (on the internal adapter; typed from `frappe-js-client`) has two fields:

| Field                           | True when                                        | Effect                                                                                                                                                 |
| ------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `validateLinkAndFetch`          | `frappeVersion === 16`                           | `db.validateLinkAndFetch()` is allowed                                                                                                                 |
| `restListHonorsExtendedFilters` | `apiVersion === 1` **or** `frappeVersion === 15` | v2 REST document list is used for `orFilters` / `parent` / `expand`. Otherwise those list args go through `GET /api/v2/method/frappe.client.get_list`. |

`validateLink()` always uses `frappe.client.validate_link` on every release. `validateLinkAndFetch()` is a separate method.

## Matrix

| Operation                                                                        | v14 + `apiVersion: 1`                       | v15 + `apiVersion: 2`      | v16 + `apiVersion: 2`                                                    |
| -------------------------------------------------------------------------------- | ------------------------------------------- | -------------------------- | ------------------------------------------------------------------------ |
| `getDoc` / `createDoc` / `updateDoc` / `deleteDoc`                               | `/api/resource`                             | `/api/v2/document`         | same                                                                     |
| `updateDoc` verb                                                                 | PUT                                         | PATCH                      | PATCH                                                                    |
| `getDocList` / `getDocListPage` / `paginate`                                     | `limit_start` / `limit_page_length`         | REST list                  | REST; `orFilters` / `parent` / `expand` via `frappe.client.get_list` RPC |
| `validateLink`                                                                   | `frappe.client.validate_link`               | same                       | same                                                                     |
| `validateLinkAndFetch`                                                           | `FeatureNotSupportedError`                  | `FeatureNotSupportedError` | `frappe.client.validate_link_and_fetch` if `frappeVersion: 16`           |
| `copyDoc` / `getMeta` / `runMethod` / `call.doctypeMethod` / `call.runDocMethod` | `FeatureNotSupportedError`                  | yes                        | yes                                                                      |
| `search.searchLink`                                                              | `{ results: [...] }` normalized to an array | bare array                 | bare array                                                               |
| Login / logout / password reset / upload / download                              | always classic `/api/method/...`            | same                       | same                                                                     |

Classic success bodies unwrap `{ message }`. API v2 unwraps `{ data }`.

## Limitations

- `@frappe-js-client/codegen` reads DocType meta from `GET /api/v2/doctype/{dt}/meta` (Frappe v15+). There is no v1 fallback.
- `cookieAuth()` in browsers cannot read `HttpOnly` cookies (the browser still sends them). After `login()` in a headless SPA, `window.csrf_token` is not refreshed automatically — Desk embeds are fine; SPAs need a CSRF bootstrap.
- Upload progress cannot be combined with client middleware (`ConfigurationError`).
- Realtime is a separate optional entry (`frappe-js-client/realtime`) and needs `socket.io-client`.
