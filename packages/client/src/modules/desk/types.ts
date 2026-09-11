import type { FrappeDoc } from '../../core/types'

export interface AddCommentArgs {
    referenceDoctype: string
    referenceName: string
    content: string
    commentEmail: string
    commentBy: string
}

export type CommentDoc = FrappeDoc<{
    comment_type?: string
    comment_email?: string
    comment_by?: string
    content?: string
    reference_doctype?: string
    reference_name?: string
    published?: number
}>

export interface AssignArgs {
    doctype: string
    name: string
    assignTo: string | string[]
    description?: string
    priority?: string
    date?: string
    assignedBy?: string
    assignmentRule?: string
}

export interface AssignMultipleArgs extends Omit<AssignArgs, 'name'> {
    names: string[]
}

export interface AssignmentRow {
    owner: string
    name: string
}

export interface ShareArgs {
    doctype: string
    name: string | number
    user?: string
    read?: boolean | number
    write?: boolean | number
    submit?: boolean | number
    share?: boolean | number
    everyone?: boolean | number
    notify?: boolean | number
}

export interface SetSharePermissionArgs {
    doctype: string
    name: string | number
    user?: string
    permissionTo: string
    value?: boolean | number
    everyone?: boolean | number
}

export type DocShare = FrappeDoc<{
    user?: string
    share_doctype?: string
    share_name?: string
    read?: number
    write?: number
    submit?: number
    share?: number
    everyone?: number
}>
