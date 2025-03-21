/**
 * The type of permission.
 *
 * @enum {string}
 * @readonly
 * @enum {string}
 */
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

/**
 * The permissions for a document.
 *
 * @interface Permissions
 * @readonly
 */
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

/**
 * The response for has permission.
 *
 * @interface HasPermissionResponse
 * @readonly
 */
export interface HasPermissionResponse {
    has_permission: boolean
}
