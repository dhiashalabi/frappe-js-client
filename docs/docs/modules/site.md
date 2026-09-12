# Site

Extended module. Use `withExtended`. The only method is `getTimeZone`.

```typescript
import { createFrappeClient } from 'frappe-js-client'
import { withExtended } from 'frappe-js-client/extended'

const frappe = withExtended(createFrappeClient({ url }))
const { time_zone } = await frappe.site.getTimeZone()
```

| Method                  | Returns                 | Server                        |
| ----------------------- | ----------------------- | ----------------------------- |
| `getTimeZone(options?)` | `{ time_zone: string }` | `frappe.client.get_time_zone` |

Trailing [`RequestOptions`](../client.md#per-request-options) are accepted.

Document CRUD, passwords, and link validation live on [`db`](./database.md). File attachment uses [`file`](./files.md).
