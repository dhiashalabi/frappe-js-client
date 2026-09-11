# Permissions

Extended module. Attach with `withExtended`. `has()` is a convenience read of what the server would allow right now — Frappe remains the authority on every write.

```typescript
import { createFrappeClient } from 'frappe-js-client'
import { withExtended } from 'frappe-js-client/extended'
import type { PermissionType } from 'frappe-js-client/extended'

const frappe = withExtended(createFrappeClient({ url }))

const { has_permission } = await frappe.permission.has('User', 'Administrator') // default 'read'
await frappe.permission.has('User', 'Administrator', 'write')
const all = await frappe.permission.getForDoc('User', 'Administrator')
```

`PermissionType`: `select`, `read`, `write`, `create`, `delete`, `submit`, `cancel`, `amend`, `print`, `email`, `report`, `import`, `export`, `share`.

`getForDoc` returns `Permissions` — each key is a `number` (Frappe's 0/1 flags).
