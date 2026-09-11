# TypeScript

## Manual document types

```typescript
import { createFrappeClient, type FrappeDoc, type FrappeInsert, FrappeError } from 'frappe-js-client'

type ToDo = FrappeDoc<{
    doctype: 'ToDo'
    description: string
    status: 'Open' | 'Closed'
}>

type ToDoInsert = FrappeInsert<ToDo>

const frappe = createFrappeClient({ url })
const row = await frappe.db.getDoc<ToDo>('ToDo', 'abc')
await frappe.db.createDoc<ToDo>('ToDo', { description: 'Follow up', status: 'Open' })
```

`FrappeDoc<T>` adds `name`, `doctype`, `owner`, `creation`, `modified`, `modified_by`, `idx`, `docstatus` (`0 | 1 | 2`), and optional `parent` / `parentfield` / `parenttype`. Extra keys from the API exist at runtime but are not typed.

`FrappeInsert<T>` is the create payload: server-assigned meta is omitted, and `doctype` is optional because `createDoc` already takes it.

`Link<"Customer">` is a branded `string` for documentation. At runtime it is still a string.

`DocFromMap<Docs, K>` looks up a generated map entry, or falls back to `FrappeDoc<object>`.

Literal `fields` arrays on `getDocList` / `paginate` narrow the row (`Pick`) when passed `as const`. `fields: '*'` (the default) keeps the full document.

Failures are `instanceof FrappeError` (and `instanceof Error`).

Prefer importing types from `frappe-js-client/types` in generated files so runtime code is not pulled in.

## Generate types from your site

[`@frappe-js-client/codegen`](./codegen.md) (`frappe-codegen`) against a live v15+ site writes `GeneratedDocTypes` / `GeneratedInserts`:

```typescript
import { createFrappeClient } from 'frappe-js-client'
import type { GeneratedDocTypes, GeneratedInserts } from './generated/frappe-types'

const frappe = createFrappeClient<GeneratedDocTypes>({ url, auth })
const todo = await frappe.db.getDoc('ToDo', name)
await frappe.db.createDoc('ToDo', {
    description: 'Follow up',
    status: 'Open',
} satisfies GeneratedInserts['ToDo'])
```

Check fields are required on the read type (`0 | 1`) and optional on `*Insert`. See [Codegen](./codegen.md).
