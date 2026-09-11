# Desk

Extended module. Use `withExtended`. Comments, ToDo assignments, tags, and document share.

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

Share flags accept `boolean | number`. `name` on share args is `string | number`.
