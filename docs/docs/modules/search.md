# Search

`frappe.search` is on the core client.

`searchLink` normalizes both Frappe 14 (`{ results: [...] }`) and Frappe 15+ (bare array) to `LinkSearchResult[]` (`value`, `description`, optional `label`).

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
