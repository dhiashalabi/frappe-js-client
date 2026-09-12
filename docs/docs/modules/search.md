# Search

`frappe.search` is on the core client. Every method accepts trailing [`RequestOptions`](../client.md#per-request-options).

`searchLink` normalizes both Frappe 14 (`{ results: [...] }`) and Frappe 15+ (bare array) to `LinkSearchResult[]` (`value`, `description`, optional `label`). Unrecognized bodies reject with `ResponseError`.

## Methods

| Method                              | Returns                 | Server                                                      |
| ----------------------------------- | ----------------------- | ----------------------------------------------------------- |
| `searchLink(doctype, txt, args?)`   | `LinkSearchResult[]`    | `frappe.desk.search.search_link`                            |
| `searchWidget(doctype, txt, args?)` | `T` (default `unknown`) | `frappe.desk.search.search_widget`                          |
| `getLinkTitle(doctype, name)`       | `string`                | `frappe.desk.search.get_link_title` (`docname` on the wire) |

```typescript
await frappe.search.searchLink('User', 'Admin', {
    query: undefined,
    filters: { enabled: 1 },
    pageLength: 10,
    searchField: 'full_name',
    referenceDoctype: 'ToDo',
    ignoreUserPermissions: false,
    linkFieldname: 'user',
})

await frappe.search.searchWidget('User', 'Ad', {
    start: 0,
    asDict: true,
    filterFields: ['email'],
    pageLength: 20,
})

await frappe.search.getLinkTitle('User', 'Administrator')
```

## `SearchLinkArgs` / `SearchWidgetArgs`

| Field                   | Wire                          |
| ----------------------- | ----------------------------- |
| `query`                 | `query`                       |
| `filters`               | `filters` (`Record` or array) |
| `pageLength`            | `page_length`                 |
| `searchField`           | `searchfield`                 |
| `referenceDoctype`      | `reference_doctype`           |
| `ignoreUserPermissions` | `ignore_user_permissions`     |
| `linkFieldname`         | `link_fieldname`              |
| `start`                 | `start` (widget only)         |
| `filterFields`          | `filter_fields` (widget only) |
| `asDict`                | `as_dict` (widget only)       |
