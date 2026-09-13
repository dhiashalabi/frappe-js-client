# Permissions

Extended module. Attach with `withExtended`. `has()` is a convenience read of what the server would allow right now — Frappe remains the authority on every write.

Every method accepts trailing [`RequestOptions`](../client.md#per-request-options).

```typescript
import { createFrappeClient } from 'frappe-js-client'
import { withExtended } from 'frappe-js-client/extended'
import type { PermissionType } from 'frappe-js-client/extended'

const frappe = withExtended(createFrappeClient({ url, frappeVersion: 16 }))

const { has_permission } = await frappe.permission.has('User', 'Administrator') // default 'read'
await frappe.permission.has('User', 'Administrator', 'write')
const all = await frappe.permission.getForDoc('User', 'Administrator')
```

## Methods

| Method                                | Returns                       | Server                                                                      |
| ------------------------------------- | ----------------------------- | --------------------------------------------------------------------------- |
| `has(doctype, name, permissionType?)` | `{ has_permission: boolean }` | `frappe.client.has_permission`. Default type `'read'`                       |
| `getForDoc(doctype, name)`            | `Permissions`                 | `frappe.client.get_doc_permissions`. Unwraps `{ permissions }` when present |

`PermissionType`: `select`, `read`, `write`, `create`, `delete`, `submit`, `cancel`, `amend`, `print`, `email`, `report`, `import`, `export`, `share`.

`Permissions` — each key is a `number` (Frappe's 0/1 flags) for those same names.
