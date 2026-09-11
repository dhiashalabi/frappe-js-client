# Workflow

Extended module. Use `withExtended`.

```typescript
import { createFrappeClient } from 'frappe-js-client'
import { withExtended } from 'frappe-js-client/extended'

const frappe = withExtended(createFrappeClient({ url }))
const doc = { doctype: 'ToDo', name: 'abc' } // WorkflowDoc: doctype + name + extra keys

const transitions = await frappe.workflow.getTransitions(doc)
// { action, state, next_state, allowed?, allow_self_approval?, condition?, … }

await frappe.workflow.apply(doc, 'Approve')
await frappe.workflow.canCancelDocument('ToDo')
await frappe.workflow.getCommonTransitionActions([doc], 'ToDo') // string[] of action names
await frappe.workflow.bulkApproval(['abc', 'def'], 'ToDo', 'Approve')
```
