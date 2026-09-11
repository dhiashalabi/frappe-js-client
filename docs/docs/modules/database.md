# Database

`frappe.db` is document CRUD. Names with spaces are encoded (`Sales Order`). Every method accepts trailing [`RequestOptions`](../client.md#per-request-options).

For site-specific field types, generate `GeneratedDocTypes` with [`frappe-codegen`](../codegen.md) and pass them to `createFrappeClient<GeneratedDocTypes>(...)`.

List pagination is always explicit. `limit` defaults to **20**. There is no “fetch all” — use `paginate()`.

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

`getDoc` / `updateDoc` / `deleteDoc` reject if the document name is missing.

Literal `fields` arrays narrow the row type (`Pick`). `fields: '*'` (the default) keeps the full document. Pass `as const` when you want that narrowing.

### Filters

```typescript
type Filter = [field, operator, value] | [field, 'in' | 'not in' | 'between', value[]]
```

Single-value operators: `=`, `>`, `<`, `>=`, `<=`, `<>`, `like`, `not like`, `!=`, `Timespan`, `is`, `is not`.

Values are `string | number | boolean | null`. Format dates with `formatFrappeDate` / `formatFrappeDatetime`.

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
// always frappe.client.validate_link — every Frappe release

const v16 = createFrappeClient({ url, apiVersion: 2, frappeVersion: 16 })
await v16.db.validateLinkAndFetch('User', 'Administrator', ['full_name'], { filters: { enabled: 1 } })
```

`validateLinkAndFetch` throws `FeatureNotSupportedError` unless `frappeVersion: 16`. Use `validateLink()` otherwise.

## API v2 only (Frappe v15+)

Throws `FeatureNotSupportedError` on `apiVersion: 1`.

```typescript
const v2 = createFrappeClient({ url, apiVersion: 2 })

await v2.db.copyDoc('ToDo', 'abc') // ignoreNoCopy defaults to true; copy is not inserted
await v2.db.copyDoc('ToDo', 'abc', false)
await v2.db.getMeta('ToDo')
await v2.db.runMethod('ToDo', 'abc', 'close', { reason: 'done' })
```
