import { AxiosInstance } from 'axios'
import { handleRequest } from '../utils/axios'
import { HasPermissionResponse, PermissionType, Permissions } from './types'
export class Permission {
    /** URL of the Frappe App instance */
    // @ts-expect-error - This is a private property that is not used in the class
    private readonly appURL: string

    /** Axios instance for making HTTP requests */
    readonly axios: AxiosInstance

    /** Whether to use token based authentication */
    readonly useToken: boolean

    /** Function that returns the authentication token */
    readonly token?: () => string

    /** Type of token to be used for authentication */
    readonly tokenType?: 'Bearer' | 'token'

    /**
     * Creates a new FrappeClient instance.
     *
     * @param appURL - The URL of the Frappe App instance
     * @param axios - The Axios instance for making HTTP requests
     * @param useToken - Whether to use token based authentication
     * @param token - Function that returns the authentication token
     * @param tokenType - Type of token to use ('Bearer' or 'token')
     */
    constructor(
        appURL: string,
        axios: AxiosInstance,
        useToken?: boolean,
        token?: () => string,
        tokenType?: 'Bearer' | 'token',
    ) {
        this.appURL = appURL
        this.axios = axios
        this.useToken = useToken ?? false
        this.token = token
        this.tokenType = tokenType ?? 'Bearer'
    }

    /**
     * Checks if the user has permission to perform an action on a document.
     *
     * @param doctype - The name of the document type
     * @param docname - The name of the document
     * @param perm_type - The type of permission to check
     * @returns A promise that resolves to a boolean indicating whether the user has permission
     *
     * @example
     * ```typescript
     * const permission = await permission.hasPermission('DocType', 'docname', 'read')
     * ```
     */

    hasPermission(
        doctype: string,
        docname: string,
        perm_type: PermissionType = 'read', // Defaulting to 'read' permission
    ): Promise<HasPermissionResponse> {
        return handleRequest<{ data: { message: HasPermissionResponse } }, HasPermissionResponse>({
            axios: this.axios,
            config: {
                url: '/api/method/frappe.client.has_permission',
                params: { doctype, docname, perm_type },
            },
            errorMessage: 'There was an error while checking the permission.',
            transformResponse: (response: { data: { message: HasPermissionResponse } }) => response.data.message,
        })
    }

    /**
     * Fetches the permissions for a document.
     *
     * @param doctype - The name of the document type
     * @param docname - The name of the document
     * @returns A promise that resolves to an array of permissions
     *
     * @example
     * ```typescript
     * const permissions = await permission.getDocPermissions('DocType', 'docname')
     * ```
     */
    getDocPermissions(doctype: string, docname: string): Promise<Permissions> {
        return handleRequest<{ data: { message: Permissions } }, Permissions>({
            axios: this.axios,
            config: {
                url: '/api/method/frappe.client.get_doc_permissions',
                params: { doctype, docname },
            },
            errorMessage: 'There was an error while fetching the document permissions.',
            transformResponse: (response: { data: { message: Permissions } }) => response.data.message,
        })
    }
}
