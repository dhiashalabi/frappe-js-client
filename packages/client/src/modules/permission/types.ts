export type PermissionType =
    | 'select'
    | 'read'
    | 'write'
    | 'create'
    | 'delete'
    | 'submit'
    | 'cancel'
    | 'amend'
    | 'print'
    | 'email'
    | 'report'
    | 'import'
    | 'export'
    | 'share'

export interface Permissions {
    select: number
    read: number
    write: number
    create: number
    delete: number
    submit: number
    cancel: number
    amend: number
    print: number
    email: number
    report: number
    import: number
    export: number
    share: number
}

export interface HasPermissionResponse {
    has_permission: boolean
}
