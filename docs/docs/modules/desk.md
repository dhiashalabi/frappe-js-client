# Desk

Extended module. Use `withExtended`. Comments, ToDo assignments, tags, and document share.

Every method accepts trailing [`RequestOptions`](../client.md#per-request-options). `removeTag` / `unassign` drop a reversible association. Destroying a document is `db.deleteDoc`.

```typescript
import { createFrappeClient } from 'frappe-js-client'
import { withExtended } from 'frappe-js-client/extended'

const frappe = withExtended(createFrappeClient({ url }))

await frappe.desk.addComment({
    referenceDoctype: 'ToDo',
    referenceName: 'abc',
    content: 'Looks good',
    commentEmail: 'Administrator',
    commentBy: 'Administrator',
})
await frappe.desk.updateComment('comment-name', 'Edited')
await frappe.desk.getComments('ToDo', 'abc')

await frappe.desk.assign({
    doctype: 'ToDo',
    name: 'abc',
    assignTo: 'Administrator', // or string[]
    description: 'Please review',
    priority: 'High',
    date: '2026-09-11',
    assignedBy: 'Administrator',
    assignmentRule: undefined,
})
await frappe.desk.assignMultiple({
    doctype: 'ToDo',
    names: ['abc', 'def'],
    assignTo: ['a@x.com'],
})
await frappe.desk.closeAssignment('ToDo', 'abc', 'Administrator')
await frappe.desk.unassign('ToDo', 'abc', 'Administrator')

await frappe.desk.addTag('urgent', 'ToDo', 'abc', '#ff0000') // color is optional
await frappe.desk.getTags('ToDo', 'urg')
await frappe.desk.getTaggedDocs('ToDo', 'urgent')
await frappe.desk.removeTag('urgent', 'ToDo', 'abc')

await frappe.desk.share.add({
    doctype: 'ToDo',
    name: 'abc',
    user: 'a@x.com',
    read: true,
    write: true,
    submit: false,
    share: false,
    everyone: false,
    notify: true,
})
await frappe.desk.share.setPermission({
    doctype: 'ToDo',
    name: 'abc',
    user: 'a@x.com',
    permissionTo: 'write',
    value: 1,
    everyone: false,
})
await frappe.desk.share.getUsers('ToDo', 'abc')
```

## Comments

| Method                         | Returns        | Notes                                                                           |
| ------------------------------ | -------------- | ------------------------------------------------------------------------------- |
| `addComment(args)`             | `CommentDoc`   | `referenceDoctype` / `referenceName` / `content` / `commentEmail` / `commentBy` |
| `updateComment(name, content)` | `unknown`      |                                                                                 |
| `getComments(doctype, name)`   | `CommentDoc[]` | Newest first. Same list builder as `db`                                         |

## Assignments

| Method                                     | Returns           | Notes                                |
| ------------------------------------------ | ----------------- | ------------------------------------ |
| `assign(args)`                             | `AssignmentRow[]` | `assignTo` is `string` or `string[]` |
| `assignMultiple(args)`                     | `unknown`         | `names: string[]` instead of `name`  |
| `unassign(doctype, name, assignTo)`        | `AssignmentRow[]` |                                      |
| `closeAssignment(doctype, name, assignTo)` | `AssignmentRow[]` |                                      |

`AssignArgs`: `doctype`, `name`, `assignTo`, optional `description`, `priority`, `date`, `assignedBy`, `assignmentRule`. `AssignmentRow` is `{ owner, name }`.

## Tags

| Method                               | Returns    | Notes               |
| ------------------------------------ | ---------- | ------------------- |
| `addTag(tag, doctype, name, color?)` | `string`   | Color optional      |
| `removeTag(tag, doctype, name)`      | `unknown`  |                     |
| `getTags(doctype, txt?)`             | `string[]` | `txt` defaults `''` |
| `getTaggedDocs(doctype, tag)`        | `unknown`  |                     |

## Share (`frappe.desk.share`)

Share flags accept `boolean | number`. `name` on share args is `string | number`.

| Method                          | Returns            | Defaults                                              |
| ------------------------------- | ------------------ | ----------------------------------------------------- |
| `share.add(args)`               | `DocShare`         | `read: 1`, `write/submit/share/everyone/notify: 0`    |
| `share.setPermission(args)`     | `DocShare \| null` | `value: 1`, `everyone: 0`. `permissionTo` is required |
| `share.getUsers(doctype, name)` | `DocShare[]`       |                                                       |
