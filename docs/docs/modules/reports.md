# Reports

Extended module. Use `withExtended`. Other whitelist methods stay on `frappe.call`.

```typescript
import { createFrappeClient } from 'frappe-js-client'
import { withExtended } from 'frappe-js-client/extended'

const frappe = withExtended(createFrappeClient({ url }))
```

## Report view

```typescript
await frappe.report.get({
    doctype: 'ToDo',
    fields: ['name', 'status'],
    filters: [['status', '=', 'Open']],
    orFilters: [['priority', '=', 'High']],
    orderBy: 'modified desc',
    start: 0,
    pageLength: 20,
    groupBy: 'status',
})
// { keys, values, user_info? } — compressed columns

await frappe.report.getList({ doctype: 'ToDo', fields: ['name'] })
await frappe.report.countRows({ doctype: 'ToDo' }) // number | null; named so it is not db.getCount
```

## Query reports

```typescript
await frappe.report.run(
    'Permitted Documents For User',
    { User: 'Administrator' },
    {
        ignorePreparedReport: true,
        customColumns: [],
        isTree: false,
        parentField: undefined,
        areDefaultFilters: true,
        jsFilters: [],
        user: 'Administrator',
    },
)
await frappe.report.getScript('Permitted Documents For User')
```

`filters` on `run` / `prepare` / `getQueued` is `Record<string, unknown> | string`.

## Prepared reports

```typescript
await frappe.report.prepare('Database Storage Usage by Tables', {})
await frappe.report.getQueued('Database Storage Usage by Tables', {})
await frappe.report.stop('PREP-0001') // delete_prepared_reports on the server
const blob = await frappe.report.download('PREP-0001')
```
