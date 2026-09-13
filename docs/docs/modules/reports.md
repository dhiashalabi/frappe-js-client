# Reports

Extended module. Use `withExtended`. Other whitelist methods stay on `frappe.call`. Every method accepts trailing [`RequestOptions`](../client.md#per-request-options).

```typescript
import { createFrappeClient } from 'frappe-js-client'
import { withExtended } from 'frappe-js-client/extended'

const frappe = withExtended(createFrappeClient({ url, frappeVersion: 16 }))
```

## Method catalog

| Method                             | Returns                               | Server                                                               |
| ---------------------------------- | ------------------------------------- | -------------------------------------------------------------------- |
| `get(args)`                        | `{ keys, values, user_info? }`        | `frappe.desk.reportview.get`                                         |
| `getList(args)`                    | `T[]`                                 | `frappe.desk.reportview.get_list`                                    |
| `countRows(args)`                  | `number \| null`                      | `frappe.desk.reportview.get_count`. Named so it is not `db.getCount` |
| `run(reportName, filters?, args?)` | `QueryReportResult`                   | `frappe.desk.query_report.run`                                       |
| `getScript(reportName)`            | `QueryReportScript`                   | `frappe.desk.query_report.get_script`                                |
| `prepare(reportName, filters?)`    | `PreparedReportRef` (`{ name, ... }`) | `make_prepared_report`                                               |
| `getQueued(reportName, filters)`   | `unknown[]`                           | `get_reports_in_queued_state`                                        |
| `stop(preparedReportName)`         | `unknown`                             | `delete_prepared_reports`                                            |
| `download(preparedReportName)`     | `Blob`                                | `download_attachment` (`arraybuffer`)                                |

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

`ReportViewArgs`: `doctype`, optional `fields`, `filters` (array or object), `orFilters`, `orderBy` (string), `start`, `pageLength`, `groupBy`.

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

`QueryReportRunArgs`: `ignorePreparedReport`, `customColumns`, `isTree`, `parentField`, `areDefaultFilters`, `jsFilters`, `user`.

`QueryReportResult` includes `result`, `columns`, `message`, `chart`, `report_summary`, `skip_total_row`, `status`, `execution_time`, `add_total_row`, `prepared_report`, plus extra keys.

`QueryReportScript`: `script`, `html_format`, `execution_time`, `filters`, `custom_report_name`.

## Prepared reports

```typescript
await frappe.report.prepare('Database Storage Usage by Tables', {})
await frappe.report.getQueued('Database Storage Usage by Tables', {})
await frappe.report.stop('PREP-0001') // delete_prepared_reports on the server
const blob = await frappe.report.download('PREP-0001')
```

JSON error bodies on `download` are still `FrappeError` (non-2xx is decoded as text).
