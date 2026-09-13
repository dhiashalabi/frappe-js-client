# Frappe version support

REST generation (`apiVersion`) and Frappe release (`frappeVersion`) are independent.

| `apiVersion`  | Paths                           | Frappe                               |
| ------------- | ------------------------------- | ------------------------------------ |
| `1`           | `/api/method` + `/api/resource` | v14, v15, v16                        |
| `2` (default) | `/api/v2/*`                     | v15, v16 — **does not exist on v14** |

This client **never** calls `/api/v1/...`. That prefix 404s on v14. Classic unversioned paths still work on v15 and v16.

Pass `frappeVersion: 14 | 15 | 16` when you know the site's release. It only affects capabilities that differ by release. When omitted, every capability uses the conservative value that is correct on every supported release — except `validateLink` on Frappe 16, which **requires** `frappeVersion: 16` because `frappe.client.validate_link` was removed.

## Capabilities

`Capabilities` (on the internal adapter; typed from `frappe-js-client`) has three fields:

| Field                           | True when                                        | Effect                                                                                                                                                 |
| ------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `validateLinkAndFetch`          | `frappeVersion === 16`                           | `db.validateLinkAndFetch()` is allowed; `db.validateLink()` routes to `validate_link_and_fetch`                                                        |
| `listExpand`                    | `frappeVersion !== 14`                           | `getDocList` / `getDocListPage` / `paginate` may send `expand`. False on Frappe 14 (`FeatureNotSupportedError`). Unset → true.                         |
| `restListHonorsExtendedFilters` | `apiVersion === 1` **or** `frappeVersion === 15` | v2 REST document list is used for `orFilters` / `parent` / `expand`. Otherwise those list args go through `GET /api/v2/method/frappe.client.get_list`. |

`validateLink()` calls `frappe.client.validate_link` on Frappe 14/15 (and when `frappeVersion` is omitted). On Frappe 16 it calls `frappe.client.validate_link_and_fetch` (`fields` → `fields_to_fetch`). Invalid links return `{ name: null }` on 14/15 and `{}` on 16 — treat a missing/null `name` as invalid.

## Matrix

| Operation                                                                        | v14 + `apiVersion: 1`                       | v15 + `apiVersion: 2`      | v16 + `apiVersion: 2`                                                    |
| -------------------------------------------------------------------------------- | ------------------------------------------- | -------------------------- | ------------------------------------------------------------------------ |
| `getDoc` / `createDoc` / `updateDoc` / `deleteDoc`                               | `/api/resource`                             | `/api/v2/document`         | same                                                                     |
| `updateDoc` verb                                                                 | PUT                                         | PATCH                      | PATCH                                                                    |
| `getDocList` / `getDocListPage` / `paginate`                                     | `limit_start` / `limit_page_length`         | REST list                  | REST; `orFilters` / `parent` / `expand` via `frappe.client.get_list` RPC |
| `getDocList` `expand`                                                            | `FeatureNotSupportedError` if set           | `expand` on `get_list`     | same as v15 via RPC                                                      |
| `validateLink`                                                                   | `frappe.client.validate_link`               | same                       | `frappe.client.validate_link_and_fetch` if `frappeVersion: 16`           |
| `validateLinkAndFetch`                                                           | `FeatureNotSupportedError`                  | `FeatureNotSupportedError` | `frappe.client.validate_link_and_fetch` if `frappeVersion: 16`           |
| `copyDoc` / `getMeta` / `runMethod` / `call.doctypeMethod` / `call.runDocMethod` | `FeatureNotSupportedError`                  | yes                        | yes                                                                      |
| `search.searchLink`                                                              | `{ results: [...] }` normalized to an array | bare array                 | bare array                                                               |
| `search.searchWidget`                                                            | `{ values: [...] }` normalized to an array  | returned array             | returned array                                                           |
| Login / logout / password reset / upload / download                              | always classic `/api/method/...`            | same                       | same                                                                     |

Classic success bodies unwrap `{ message }`. API v2 unwraps `{ data }`.

## RPC catalog vs Frappe 14 / 15 / 16

Every public client method was checked against [frappe/frappe](https://github.com/frappe/frappe) branches `version-14`, `version-15`, and `version-16`.

**Present on all three (no extra gate)**

- Auth: `login`, `logout`, `getLoggedUser`, `forgetPassword`, `ping` (v1 `frappe.ping`, v2 `/api/v2/method/ping`)
- DB: `getDoc`, `getDocList`, `createDoc`, `updateDoc`, `deleteDoc`, `getCount` (v1 RPC / v2 doctype count), `getValue`, `setValue`, `getSingle`, `getSingleValue`, `setSingle`, `renameDoc`, `submit`, `cancel`, `insertMany`, `updateMany`, `getPassword`, `isDocumentAmended`
- File: `upload`, `download`
- Search: `searchLink`, `searchWidget`, `getLinkTitle`
- Permission: `has`, `getForDoc`
- Workflow: `getTransitions`, `apply`, `canCancelDocument`, `bulkApproval`, `getCommonTransitionActions`
- Report: `get`, `getList`, `countRows`, `run`, `getScript`, `prepare`, `getQueued`, `stop`, `download`
- Desk: share (`add`, `setPermission`, `getUsers`), comments, assign (`assign`, `assignMultiple`, `unassign`, `closeAssignment`), tags
- Site: `getTimeZone`
- Composed (no extra RPC): `exists`, `getLastDoc`, `paginate`, `getComments`

**Already gated by `apiVersion: 2` (v15+)**

- `copyDoc`, `getMeta`, `runMethod`, `call.doctypeMethod`, `call.runDocMethod`

**Release-specific**

- `validateLink` / `validateLinkAndFetch` — see the matrix above
- `getDocList` `expand` — Frappe 15+ (`FeatureNotSupportedError` on `frappeVersion: 14`)

**Not wrapped**

- `frappe.client.get_js`, `awesomebar_search`, v16 `stop_prepared_report`, `frappe.client.attach_file`

## Limitations

- `frappe-codegen` reads DocType meta from `GET /api/v2/doctype/{dt}/meta` (Frappe v15+). There is no v1 fallback.
- `cookieAuth()` in browsers cannot read `HttpOnly` cookies (the browser still sends them). After `login()` in a headless SPA, `window.csrf_token` is not refreshed automatically — Desk embeds are fine; SPAs need a CSRF bootstrap. CSRF is read from `window.csrf_token`, `<meta name="csrf_token">`, or the `csrf_token` cookie.
- Upload progress cannot be combined with client middleware (`ConfigurationError`).
- Realtime is a separate optional entry (`frappe-js-client/realtime`) and needs `socket.io-client`.
- Login, logout, password reset, upload, and download always use classic `/api/method/...`, including on `apiVersion: 2`.
- Filter values cannot be `Date` objects — format with `formatFrappeDate` / `formatFrappeDatetime`.
- Pagination is always bounded (`limit` default 20). There is no “fetch all”.
- `getDoc({ expandLinks: true })` is a classic REST query param (`expand_links`). Frappe 14 ignores it. The v2 adapter does not send it.
