# Database

`frappe.db` is document CRUD. Names with spaces are encoded (`Sales Order`). Every method accepts trailing [`RequestOptions`](../client.md#per-request-options).

For site-specific field types, generate `GeneratedDocTypes` with [`frappe-codegen`](../codegen.md) and pass them to `createFrappeClient<GeneratedDocTypes>(...)`.

List pagination is always explicit. `limit` defaults to **20**. There is no “fetch all” — use `paginate()`. `limit` must be a finite positive integer; `start` must be a finite non-negative integer (`ConfigurationError` otherwise).

`getDoc` / `updateDoc` / `deleteDoc` reject with `ConfigurationError` if the document name is missing. Slash-delimited names are supported and each segment is URL-encoded; empty, `.` and `..` segments are rejected.

## Method catalog

| Method                                               | Returns                  | Notes                                                                                         |
| ---------------------------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------- |
| `getDoc(doctype, name, args?)`                       | document                 | `args.expandLinks?: boolean`                                                                  |
| `getDocList(doctype, args?)`                         | `RowFor[]`               | Uses `getDocListPage` and returns `.data`                                                     |
| `getDocListPage(doctype, args?)`                     | `{ data, hasNextPage? }` | `hasNextPage` is set on Frappe v16 `/api/v2` lists                                            |
| `paginate(doctype, args?)`                           | `AsyncGenerator`         | Bounded pages until `hasNextPage === false`, or a short last page when `hasNextPage` is unset |
| `createDoc(doctype, value)`                          | document                 | Server fills `name` / owner / timestamps                                                      |
| `updateDoc(doctype, name, value)`                    | document                 | PUT classic, PATCH on v2                                                                      |
| `deleteDoc(doctype, name)`                           | `void`                   |                                                                                               |
| `getLastDoc(doctype, args?)`                         | document \| `null`       | Default `orderBy`: `{ field: 'creation', order: 'desc' }`, then `getDoc` of that name         |
| `getCount(doctype, args?)`                           | `number`                 | `filters`, `debug`, `cache`                                                                   |
| `exists(doctype, name)`                              | `boolean`                | `getCount` with `filters: [['name', '=', name]]`                                              |
| `getValue(doctype, fieldName, args?)`                | field or dict            | `fieldName` is `string` or `string[]`; `asDict` defaults `true`                               |
| `setValue(doctype, name, field, value?)`             | document                 | Map form: `setValue(dt, name, { field: value })` — do not pass `value`                        |
| `getSingle(doctype)`                                 | document                 | `frappe.client.get` with no name                                                              |
| `getSingleValue(doctype, field)`                     | value                    |                                                                                               |
| `setSingle(doctype, values)`                         | document                 | `setValue(doctype, doctype, values)`                                                          |
| `renameDoc(doctype, old, new, merge?)`               | `string`                 | `merge` defaults `false`                                                                      |
| `submit(doc)`                                        | document                 | Needs `doctype` + `name` on `doc`                                                             |
| `cancel(doctype, name)`                              | document                 |                                                                                               |
| `insertMany(docs)`                                   | `string[]`               | Names of inserted docs                                                                        |
| `updateMany(docs)`                                   | `BulkUpdateResponse`     | `{ failed_docs: [{ doc, exc }] }`. Wire sends `docname` (falls back to `name`)                |
| `getPassword(doctype, name, field)`                  | `string`                 | **POST** body — not a query string                                                            |
| `isDocumentAmended(doctype, name)`                   | `boolean`                |                                                                                               |
| `validateLink(doctype, name, fields?)`               | dict                     | `validate_link` on 14/15; `validate_link_and_fetch` on 16. `fields` defaults `['name']`       |
| `validateLinkAndFetch(doctype, name, fields, args?)` | dict                     | Frappe 16 only — pass `frappeVersion: 16`. Optional `filters`.                                |
| `copyDoc(doctype, name, ignoreNoCopy?)`              | document                 | **v2 only**. Copy is **not** inserted. `ignoreNoCopy` defaults `true`                         |
| `getMeta(doctype)`                                   | meta                     | **v2 only** (`GET /api/v2/doctype/{dt}/meta`)                                                 |
| `runMethod(doctype, name, method, args?)`            | unknown                  | **v2 only** — document controller method                                                      |

v2-only methods throw `FeatureNotSupportedError` on `apiVersion: 1`. `getDocList` `expand` throws `FeatureNotSupportedError` when `frappeVersion: 14`.

## CRUD

```typescript
const todo = await frappe.db.getDoc('ToDo', 'abc')
const withLinks = await frappe.db.getDoc('ToDo', 'abc', { expandLinks: true })

const rows = await frappe.db.getDocList('ToDo', {
    fields: ['name', 'status'] as const,
    filters: [['status', '=', 'Open']],
    orFilters: [['priority', '=', 'High']],
    orderBy: { field: 'modified', order: 'desc' },
    groupBy: 'status',
    limit: 20,
    start: 0,
    parent: 'Task',
    expand: ['assigned_to'],
    debug: true,
    asDict: true,
})

const page = await frappe.db.getDocListPage('ToDo', { limit: 20, start: 0 })
page.data
page.hasNextPage // set on Frappe v16 `/api/v2` lists

for await (const row of frappe.db.paginate('ToDo', { fields: ['name'], limit: 50 })) {
    // bounded pages until hasNextPage is false, or a short last page
}

const created = await frappe.db.createDoc('ToDo', {
    description: 'Follow up',
    status: 'Open',
})
await frappe.db.updateDoc('ToDo', created.name, { status: 'Closed' }) // PUT classic, PATCH on v2
await frappe.db.deleteDoc('ToDo', created.name) // Promise<void>

await frappe.db.insertMany([{ doctype: 'ToDo', description: 'A' }]) // Promise<string[]>
await frappe.db.updateMany([{ doctype: 'ToDo', name: created.name, status: 'Closed' }])
// wire sends `docname` (falls back to `name`) as JSON for Frappe `bulk_update`

const last = await frappe.db.getLastDoc('ToDo', {
    filters: [['status', '=', 'Open']],
    orderBy: { field: 'modified', order: 'desc' },
})
// T | null
```

Literal `fields` arrays narrow the row type (`Pick`). `fields: '*'` (the default) keeps the full document and is sent to Frappe as `["*"]`. Pass `as const` when you want that narrowing. List results are always object-shaped, so `asDict` can only be `true`; passing `false` at runtime throws `ConfigurationError`.

`insertMany` takes insert payloads with a required `doctype`; stored-document metadata such as `name`, `owner`, and timestamps is not required.

### `paginate` stop conditions

1. `hasNextPage === false` — stop (honored even if the page is full).
2. `hasNextPage` is not `true` **and** `data.length < limit` — stop.
3. Otherwise `start += limit` and fetch the next page.

### Filters

```typescript
type Filter = [field, operator, value] | [field, 'in' | 'not in' | 'between', value[]]
```

Single-value operators: `=`, `>`, `<`, `>=`, `<=`, `<>`, `like`, `not like`, `!=`, `Timespan`, `is`, `is not`.

Values are `string | number | boolean | null`. Format dates with `formatFrappeDate` / `formatFrappeDatetime`.

`getCount` / `getValue` also accept object filters (`Record<string, Value>`). `getValue` additionally accepts a filter string.

On Frappe 16 + `apiVersion: 2`, `orFilters` / `parent` / `expand` are sent through `GET /api/v2/method/frappe.client.get_list` because the v16 REST list handler does not honor them. `expand` itself is Frappe 15+ — with `frappeVersion: 14` the client throws `FeatureNotSupportedError`. See [Frappe versions](../frappe-versions.md).

## Values, count, rename, submit

```typescript
await frappe.db.getCount('ToDo', { filters: [['status', '=', 'Open']], debug: true, cache: true })
await frappe.db.exists('User', 'Administrator')

await frappe.db.getValue('User', 'first_name', { filters: [['name', '=', 'Administrator']] })
await frappe.db.getValue('User', ['first_name', 'email'], { filters: { name: 'Administrator' } })
await frappe.db.setValue('User', 'Administrator', 'first_name', 'Ada')
await frappe.db.setValue('User', 'Administrator', { first_name: 'Ada', last_name: 'Lovelace' })

await frappe.db.renameDoc('ToDo', 'old', 'new') // merge defaults to false
await frappe.db.renameDoc('ToDo', 'old', 'new', true)
await frappe.db.submit(salesInvoice)
await frappe.db.cancel('Sales Invoice', salesInvoice.name)
```

## Single DocTypes

Singles use `frappe.client.get` with no name (`getSingle`), not `getDoc`:

```typescript
const settings = await frappe.db.getSingle('System Settings')
await frappe.db.getSingleValue('System Settings', 'time_zone')
await frappe.db.setSingle('System Settings', { time_zone: 'Asia/Amman' })
```

## Passwords, amended docs, links

```typescript
await frappe.db.getPassword('User', 'Administrator', 'api_secret') // POST body; not a query string
await frappe.db.isDocumentAmended('Sales Invoice', 'SINV-0001')

await frappe.db.validateLink('User', 'Administrator', ['name', 'full_name'])
// Frappe 14/15: frappe.client.validate_link
// Frappe 16 (frappeVersion: 16): frappe.client.validate_link_and_fetch

const v16 = createFrappeClient({ url, apiVersion: 2, frappeVersion: 16 })
await v16.db.validateLinkAndFetch('User', 'Administrator', ['full_name'], { filters: { enabled: 1 } })
```

`validateLinkAndFetch` throws `FeatureNotSupportedError` unless `frappeVersion: 16`. On Frappe 16, `validateLink()` hits the same RPC without filters. Invalid links return `{ name: null }` on 14/15 and `{}` on 16.

## API v2 only (Frappe v15+)

Throws `FeatureNotSupportedError` on `apiVersion: 1`.

```typescript
const v2 = createFrappeClient({ url, apiVersion: 2 })

await v2.db.copyDoc('ToDo', 'abc') // ignoreNoCopy defaults to true; copy is not inserted
await v2.db.copyDoc('ToDo', 'abc', false)
await v2.db.getMeta('ToDo')
await v2.db.runMethod('ToDo', 'abc', 'close', { reason: 'done' })
```
