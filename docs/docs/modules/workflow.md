# Workflow

Extended module. Use `withExtended`. Every method accepts trailing [`RequestOptions`](../client.md#per-request-options).

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

## Methods

| Method                                      | Returns                 | Server                                                                                     |
| ------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------ |
| `getTransitions(doc)`                       | `WorkflowTransition[]`  | `frappe.model.workflow.get_transitions`                                                    |
| `apply(doc, action)`                        | `T` (default `unknown`) | `frappe.model.workflow.apply_workflow`                                                     |
| `canCancelDocument(doctype)`                | `boolean`               | `frappe.model.workflow.can_cancel_document`                                                |
| `getCommonTransitionActions(docs, doctype)` | `string[]`              | `frappe.model.workflow.get_common_transition_actions`                                      |
| `bulkApproval(names, doctype, action)`      | `unknown`               | `frappe.model.workflow.bulk_workflow_approval`. Wire `docnames` is `JSON.stringify(names)` |

`WorkflowDoc` is `{ doctype, name, ... }`. `WorkflowTransition` includes `action`, `state`, `next_state`, plus optional `allowed`, `allow_self_approval`, `condition`, and extra server keys.
