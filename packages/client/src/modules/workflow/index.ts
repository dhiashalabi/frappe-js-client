import type { RequestOptions } from '../../core/types'
import type { ModuleDeps } from '../deps'
import type { WorkflowDoc, WorkflowTransition } from './types'

class FrappeWorkflowImpl {
    private readonly adapter: ModuleDeps['adapter']
    private readonly executor: ModuleDeps['executor']

    /** @internal */
    constructor(deps: ModuleDeps) {
        this.adapter = deps.adapter
        this.executor = deps.executor
    }

    getTransitions(doc: WorkflowDoc, options?: RequestOptions): Promise<WorkflowTransition[]> {
        return this.executor.call<WorkflowTransition[]>(
            { method: 'POST', url: this.adapter.method('frappe.model.workflow.get_transitions'), data: { doc } },
            'envelope',
            options,
        )
    }

    apply<T = unknown>(doc: WorkflowDoc, action: string, options?: RequestOptions): Promise<T> {
        return this.executor.call<T>(
            { method: 'POST', url: this.adapter.method('frappe.model.workflow.apply_workflow'), data: { doc, action } },
            'envelope',
            options,
        )
    }

    canCancelDocument(doctype: string, options?: RequestOptions): Promise<boolean> {
        return this.executor.call<boolean>(
            {
                method: 'GET',
                url: this.adapter.method('frappe.model.workflow.can_cancel_document'),
                params: { doctype },
            },
            'envelope',
            options,
        )
    }

    bulkApproval(names: string[], doctype: string, action: string, options?: RequestOptions): Promise<unknown> {
        return this.executor.call(
            {
                method: 'POST',
                url: this.adapter.method('frappe.model.workflow.bulk_workflow_approval'),
                data: { docnames: JSON.stringify(names), doctype, action },
            },
            'envelope',
            options,
        )
    }

    getCommonTransitionActions(docs: WorkflowDoc[], doctype: string, options?: RequestOptions): Promise<string[]> {
        return this.executor.call<string[]>(
            {
                method: 'POST',
                url: this.adapter.method('frappe.model.workflow.get_common_transition_actions'),
                data: { docs, doctype },
            },
            'envelope',
            options,
        )
    }
}

export type FrappeWorkflow = FrappeWorkflowImpl

/** @internal */
export function createFrappeWorkflow(deps: ModuleDeps): FrappeWorkflow {
    return new FrappeWorkflowImpl(deps)
}

export * from './types'
