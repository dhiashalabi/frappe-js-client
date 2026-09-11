export interface WorkflowDoc {
    doctype: string
    name: string
    [key: string]: unknown
}

export interface WorkflowTransition {
    action: string
    state: string
    next_state: string
    allowed?: string
    allow_self_approval?: number | boolean
    condition?: string
    [key: string]: unknown
}
