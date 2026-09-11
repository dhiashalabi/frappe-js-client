# RPC (`call`)

`frappe.call` runs Frappe whitelist methods. Classic success unwraps `{ message }`. API v2 unwraps `{ data }`. Object GET params are JSON-stringified. `delete` puts args on the query string.

```typescript
await frappe.call.get('frappe.ping')
await frappe.call.get('custom.search', { filters: { status: 'Open' } })
await frappe.call.post('custom.run', { names: ['a'] })
await frappe.call.put('custom.update', { name: 'a' })
await frappe.call.delete('custom.delete', { name: 'a' })
```

`ApiArgs` is `Record<string, string | number | boolean | object | null | undefined>`.

## v2 controller shortcuts

Throws `FeatureNotSupportedError` on `apiVersion: 1`.

```typescript
const frappe = createFrappeClient({ url, apiVersion: 2 })

await frappe.call.doctypeMethod('ToDo', 'bulk_close', { names: ['a'] })
await frappe.call.runDocMethod('set_status', { doctype: 'ToDo', name: 'a' }, { status: 'Closed' })
```

`doctypeMethod(doctype, method, args?)` hits the DocType controller. `runDocMethod(method, document, args?)` hits a method on a specific document.

Whitelisted methods that already have a typed wrapper (`db.getPassword`, `report.run`, …) should use that wrapper instead of `call`.
