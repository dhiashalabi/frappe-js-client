import type { RequestOptions } from '../../core/types'
import type { ModuleDeps } from '../deps'
import type {
    AddCommentArgs,
    AssignArgs,
    AssignmentRow,
    AssignMultipleArgs,
    CommentDoc,
    DocShare,
    SetSharePermissionArgs,
    ShareArgs,
} from './types'

class FrappeShareImpl {
    private readonly adapter: ModuleDeps['adapter']
    private readonly executor: ModuleDeps['executor']

    /** @internal */
    constructor(deps: ModuleDeps) {
        this.adapter = deps.adapter
        this.executor = deps.executor
    }

    add(args: ShareArgs, options?: RequestOptions): Promise<DocShare> {
        return this.executor.call<DocShare>(
            {
                method: 'POST',
                url: this.adapter.method('frappe.share.add'),
                data: {
                    doctype: args.doctype,
                    name: args.name,
                    user: args.user,
                    read: asFlag(args.read, 1),
                    write: asFlag(args.write, 0),
                    submit: asFlag(args.submit, 0),
                    share: asFlag(args.share, 0),
                    everyone: asFlag(args.everyone, 0),
                    notify: asFlag(args.notify, 0),
                },
            },
            'envelope',
            options,
        )
    }

    setPermission(args: SetSharePermissionArgs, options?: RequestOptions): Promise<DocShare | null> {
        return this.executor.call<DocShare | null>(
            {
                method: 'POST',
                url: this.adapter.method('frappe.share.set_permission'),
                data: {
                    doctype: args.doctype,
                    name: args.name,
                    user: args.user,
                    permission_to: args.permissionTo,
                    value: asFlag(args.value, 1),
                    everyone: asFlag(args.everyone, 0),
                },
            },
            'envelope',
            options,
        )
    }

    getUsers(doctype: string, name: string, options?: RequestOptions): Promise<DocShare[]> {
        return this.executor.call<DocShare[]>(
            { method: 'GET', url: this.adapter.method('frappe.share.get_users'), params: { doctype, name } },
            'envelope',
            options,
        )
    }
}

export type FrappeShare = FrappeShareImpl

/**
 * Desk helpers: comments, assignments, tags, sharing.
 *
 * `removeTag` / `unassign` drop a reversible association. Destroying a document is `db.deleteDoc`.
 */
class FrappeDeskImpl {
    readonly share: FrappeShare
    private readonly adapter: ModuleDeps['adapter']
    private readonly executor: ModuleDeps['executor']

    /** @internal */
    constructor(deps: ModuleDeps) {
        this.adapter = deps.adapter
        this.executor = deps.executor
        this.share = new FrappeShareImpl(deps)
    }

    addComment(args: AddCommentArgs, options?: RequestOptions): Promise<CommentDoc> {
        return this.executor.call<CommentDoc>(
            {
                method: 'POST',
                url: this.adapter.method('frappe.desk.form.utils.add_comment'),
                data: {
                    reference_doctype: args.referenceDoctype,
                    reference_name: args.referenceName,
                    content: args.content,
                    comment_email: args.commentEmail,
                    comment_by: args.commentBy,
                },
            },
            'envelope',
            options,
        )
    }

    updateComment(name: string, content: string, options?: RequestOptions): Promise<unknown> {
        return this.executor.call(
            {
                method: 'POST',
                url: this.adapter.method('frappe.desk.form.utils.update_comment'),
                data: { name, content },
            },
            'envelope',
            options,
        )
    }

    /** Newest first. Built via the same list builder as `db` — not a hand-rolled REST call. */
    async getComments(doctype: string, name: string, options?: RequestOptions): Promise<CommentDoc[]> {
        const req = this.adapter.list('Comment', {
            fields: ['name', 'content', 'comment_email', 'comment_by', 'comment_type', 'creation', 'owner'],
            filters: [
                ['reference_doctype', '=', doctype],
                ['reference_name', '=', name],
            ],
            orderBy: { field: 'creation', order: 'desc' },
        })
        const body = await this.executor.run<unknown>(req, options)
        return this.adapter.unwrapList<CommentDoc>(body).data
    }

    assign(args: AssignArgs, options?: RequestOptions): Promise<AssignmentRow[]> {
        return this.executor.call<AssignmentRow[]>(
            {
                method: 'POST',
                url: this.adapter.method('frappe.desk.form.assign_to.add'),
                data: { args: assignmentPayload(args) },
            },
            'envelope',
            options,
        )
    }

    assignMultiple(args: AssignMultipleArgs, options?: RequestOptions): Promise<unknown> {
        return this.executor.call(
            {
                method: 'POST',
                url: this.adapter.method('frappe.desk.form.assign_to.add_multiple'),
                data: { args: { ...assignmentPayload({ ...args, name: '' }), name: JSON.stringify(args.names) } },
            },
            'envelope',
            options,
        )
    }

    unassign(doctype: string, name: string, assignTo: string, options?: RequestOptions): Promise<AssignmentRow[]> {
        return this.executor.call<AssignmentRow[]>(
            {
                method: 'POST',
                url: this.adapter.method('frappe.desk.form.assign_to.remove'),
                data: { doctype, name, assign_to: assignTo },
            },
            'envelope',
            options,
        )
    }

    closeAssignment(
        doctype: string,
        name: string,
        assignTo: string,
        options?: RequestOptions,
    ): Promise<AssignmentRow[]> {
        return this.executor.call<AssignmentRow[]>(
            {
                method: 'POST',
                url: this.adapter.method('frappe.desk.form.assign_to.close'),
                data: { doctype, name, assign_to: assignTo },
            },
            'envelope',
            options,
        )
    }

    addTag(tag: string, doctype: string, name: string, color?: string, options?: RequestOptions): Promise<string> {
        return this.executor.call<string>(
            {
                method: 'POST',
                url: this.adapter.method('frappe.desk.doctype.tag.tag.add_tag'),
                data: { tag, dt: doctype, dn: name, color },
            },
            'envelope',
            options,
        )
    }

    removeTag(tag: string, doctype: string, name: string, options?: RequestOptions): Promise<unknown> {
        return this.executor.call(
            {
                method: 'POST',
                url: this.adapter.method('frappe.desk.doctype.tag.tag.remove_tag'),
                data: { tag, dt: doctype, dn: name },
            },
            'envelope',
            options,
        )
    }

    getTags(doctype: string, txt = '', options?: RequestOptions): Promise<string[]> {
        return this.executor.call<string[]>(
            {
                method: 'GET',
                url: this.adapter.method('frappe.desk.doctype.tag.tag.get_tags'),
                params: { doctype, txt },
            },
            'envelope',
            options,
        )
    }

    getTaggedDocs(doctype: string, tag: string, options?: RequestOptions): Promise<unknown> {
        return this.executor.call(
            {
                method: 'GET',
                url: this.adapter.method('frappe.desk.doctype.tag.tag.get_tagged_docs'),
                params: { doctype, tag },
            },
            'envelope',
            options,
        )
    }
}

export type FrappeDesk = FrappeDeskImpl

/** @internal */
export function createFrappeDesk(deps: ModuleDeps): FrappeDesk {
    return new FrappeDeskImpl(deps)
}

function assignmentPayload(args: AssignArgs): Record<string, unknown> {
    const assignTo = Array.isArray(args.assignTo) ? args.assignTo : [args.assignTo]
    return {
        doctype: args.doctype,
        name: args.name,
        assign_to: assignTo,
        description: args.description,
        priority: args.priority,
        date: args.date,
        assigned_by: args.assignedBy,
        assignment_rule: args.assignmentRule,
    }
}

function asFlag(value: boolean | number | undefined, fallback: number): number {
    if (value === undefined) return fallback
    return value ? 1 : 0
}

export * from './types'
