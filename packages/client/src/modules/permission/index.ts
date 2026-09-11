import type { RequestOptions } from '../../core/types'
import type { ModuleDeps } from '../deps'
import type { HasPermissionResponse, Permissions, PermissionType } from './types'

/**
 * Developer-experience helpers only. `has()` reflects what the server would allow at
 * the moment it was called — it is never a substitute for server-side enforcement, and Frappe
 * remains the sole authority on every write.
 */
class FrappePermissionImpl {
    private readonly adapter: ModuleDeps['adapter']
    private readonly executor: ModuleDeps['executor']

    /** @internal */
    constructor(deps: ModuleDeps) {
        this.adapter = deps.adapter
        this.executor = deps.executor
    }

    has(
        doctype: string,
        name: string,
        permissionType: PermissionType = 'read',
        options?: RequestOptions,
    ): Promise<HasPermissionResponse> {
        return this.executor.call<HasPermissionResponse>(
            {
                method: 'GET',
                url: this.adapter.method('frappe.client.has_permission'),
                params: { doctype, docname: name, perm_type: permissionType },
            },
            'envelope',
            options,
        )
    }

    async getForDoc(doctype: string, name: string, options?: RequestOptions): Promise<Permissions> {
        const result = await this.executor.call<{ permissions?: Permissions } | Permissions>(
            {
                method: 'GET',
                url: this.adapter.method('frappe.client.get_doc_permissions'),
                params: { doctype, docname: name },
            },
            'envelope',
            options,
        )
        if (result && typeof result === 'object' && 'permissions' in result && result.permissions) {
            return result.permissions
        }
        return result as Permissions
    }
}

export type FrappePermission = FrappePermissionImpl

/** @internal */
export function createFrappePermission(deps: ModuleDeps): FrappePermission {
    return new FrappePermissionImpl(deps)
}

export * from './types'
