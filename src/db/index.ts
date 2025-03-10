/**
 * @module db
 * @description Provides database operations for Frappe documents.
 * This module handles CRUD operations, document listing, counting, and querying
 * with support for filtering, pagination, and sorting.
 *
 * @packageDocumentation
 *
 * @example
 * ```typescript
 * import { FrappeApp } from '@frappe/sdk';
 *
 * const app = new FrappeApp('https://erp.example.com');
 * const db = app.db();
 *
 * // Get a document
 * const user = await db.getDoc('User', 'administrator');
 *
 * // Get a filtered list of documents
 * const tasks = await db.getDocList('Task', {
 *   filters: [['status', '=', 'Open']],
 *   orderBy: { field: 'creation', order: 'desc' }
 * });
 * ```
 */

import { AxiosInstance } from 'axios'

import { Error } from '@/frappe/types'
import { Filter, FrappeDoc, GetDocListArgs, GetLastDocArgs } from '@/db/types'

/**
 * Main class for database operations in Frappe.
 *
 * @class FrappeDB
 * @description Provides methods for interacting with Frappe's database,
 * including CRUD operations and document querying.
 *
 * @example
 * ```typescript
 * const db = new FrappeDB(
 *   'https://erp.example.com',
 *   axiosInstance,
 *   true,
 *   () => localStorage.getItem('token'),
 *   'Bearer'
 * );
 *
 * // Create a document
 * const newDoc = await db.createDoc('Task', {
 *   subject: 'New Task',
 *   status: 'Open'
 * });
 *
 * // Update a document
 * await db.updateDoc('Task', newDoc.name, {
 *   status: 'Completed'
 * });
 * ```
 */
export class FrappeDB {
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
     * Creates a new FrappeDB instance.
     *
     * @param appURL - Base URL of the Frappe instance
     * @param axios - Configured Axios instance for making requests
     * @param useToken - Whether to use token-based authentication
     * @param token - Function that returns the authentication token
     * @param tokenType - Type of token to use ('Bearer' or 'token')
     *
     * @example
     * ```typescript
     * const db = new FrappeDB(
     *   'https://erp.example.com',
     *   axiosInstance,
     *   true,
     *   () => localStorage.getItem('token'),
     *   'Bearer'
     * );
     * ```
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
        this.tokenType = tokenType
    }

    /**
     * Retrieves a document from the database.
     *
     * @template T - Type of the document
     * @param doctype - Name of the doctype
     * @param docname - Name/ID of the document
     * @returns Promise resolving to the document
     * @throws {Error} If document retrieval fails
     *
     * @example
     * ```typescript
     * // Get a user document
     * const user = await db.getDoc<User>('User', 'administrator');
     * console.log(user.email);
     *
     * // Get a task document
     * const task = await db.getDoc('Task', 'TASK-001');
     * ```
     */
    async getDoc<T = object>(doctype: string, docname: string = ''): Promise<FrappeDoc<T>> {
        return this.axios
            .get(`/api/resource/${doctype}/${encodeURIComponent(docname)}`)
            .then((res) => res.data.data)
            .catch((error) => {
                throw {
                    ...error.response.data,
                    httpStatus: error.response.status,
                    httpStatusText: error.response.statusText,
                    message: 'There was an error while fetching the document.',
                    exception: error.response.data.exception ?? error.response.data.exc_type ?? '',
                } as Error
            })
    }

    /**
     * Retrieves a list of documents with filtering, sorting, and pagination.
     *
     * @template T - Type of the document
     * @template K - Type for filter fields
     * @param doctype - Name of the doctype
     * @param args - Query arguments for filtering, sorting, and pagination
     * @returns Promise resolving to an array of documents
     * @throws {Error} If document retrieval fails
     *
     * @example
     * ```typescript
     * // Get all open tasks
     * const tasks = await db.getDocList('Task', {
     *   filters: [['status', '=', 'Open']],
     *   orderBy: { field: 'creation', order: 'desc' },
     *   limit: 10
     * });
     *
     * // Get specific user fields
     * const users = await db.getDocList<User>('User', {
     *   fields: ['name', 'email', 'first_name'],
     *   filters: [['user_type', '=', 'System User']]
     * });
     * ```
     */
    async getDocList<T = object, K = FrappeDoc<T>>(doctype: string, args?: GetDocListArgs<K>) {
        let params = {}

        if (args) {
            const { fields, filters, orFilters, orderBy, limit, limit_start, groupBy, asDict = true } = args
            const orderByString = orderBy ? `${String(orderBy?.field)} ${orderBy?.order ?? 'asc'}` : ''
            params = {
                fields: fields ? JSON.stringify(fields) : undefined,
                filters: filters ? JSON.stringify(filters) : undefined,
                or_filters: orFilters ? JSON.stringify(orFilters) : undefined,
                order_by: orderByString,
                group_by: groupBy,
                limit,
                limit_start,
                as_dict: asDict,
            }
        }

        return this.axios
            .get<{ data: T[] }>(`/api/resource/${doctype}`, { params })
            .then((res) => res.data.data)
            .catch((error) => {
                throw {
                    ...error.response.data,
                    httpStatus: error.response.status,
                    httpStatusText: error.response.statusText,
                    message: 'There was an error while fetching the documents.',
                    exception: error.response.data.exception ?? error.response.data.exc_type ?? '',
                } as Error
            })
    }

    /**
     * Creates a new document in the database.
     *
     * @template T - Type of the document
     * @param doctype - Name of the doctype
     * @param value - Document data to create
     * @returns Promise resolving to the created document
     * @throws {Error} If document creation fails
     *
     * @example
     * ```typescript
     * // Create a new task
     * const task = await db.createDoc('Task', {
     *   subject: 'New Task',
     *   description: 'Task description',
     *   status: 'Open'
     * });
     *
     * // Create a user
     * const user = await db.createDoc<User>('User', {
     *   email: 'john@example.com',
     *   first_name: 'John',
     *   user_type: 'System User'
     * });
     * ```
     */
    async createDoc<T = object>(doctype: string, value: T): Promise<FrappeDoc<T>> {
        return this.axios
            .post(`/api/resource/${doctype}`, { ...value })
            .then((res) => res.data.data)
            .catch((error) => {
                throw {
                    ...error.response.data,
                    httpStatus: error.response.status,
                    httpStatusText: error.response.statusText,
                    message: error.response.data.message ?? 'There was an error while creating the document.',
                    exception: error.response.data.exception ?? error.response.data.exc_type ?? '',
                }
            })
    }

    /**
     * Updates an existing document in the database.
     *
     * @template T - Type of the document
     * @param doctype - Name of the doctype
     * @param docname - Name/ID of the document to update
     * @param value - Partial document data to update
     * @returns Promise resolving to the updated document
     * @throws {Error} If document update fails
     *
     * @example
     * ```typescript
     * // Update task status
     * await db.updateDoc('Task', 'TASK-001', {
     *   status: 'Completed',
     *   completion_date: new Date()
     * });
     *
     * // Update user settings
     * await db.updateDoc<User>('User', 'john@example.com', {
     *   language: 'en',
     *   time_zone: 'UTC'
     * });
     * ```
     */
    async updateDoc<T = object>(doctype: string, docname: string | null, value: Partial<T>): Promise<FrappeDoc<T>> {
        return this.axios
            .put(`/api/resource/${doctype}/${docname ? encodeURIComponent(docname) : docname}`, { ...value })
            .then((res) => res.data.data)
            .catch((error) => {
                throw {
                    ...error.response.data,
                    httpStatus: error.response.status,
                    httpStatusText: error.response.statusText,
                    message: error.response.data.message ?? 'There was an error while updating the document.',
                    exception: error.response.data.exception ?? error.response.data.exc_type ?? '',
                }
            })
    }

    /**
     * Deletes a document from the database.
     *
     * @param doctype - Name of the doctype
     * @param docname - Name/ID of the document to delete
     * @returns Promise resolving to a success message
     * @throws {Error} If document deletion fails
     *
     * @example
     * ```typescript
     * // Delete a task
     * await db.deleteDoc('Task', 'TASK-001');
     *
     * // Delete a user
     * await db.deleteDoc('User', 'john@example.com');
     * ```
     */
    async deleteDoc(doctype: string, docname?: string | null): Promise<{ message: string }> {
        return this.axios
            .delete(`/api/resource/${doctype}/${docname ? encodeURIComponent(docname) : docname}`)
            .then((res) => res.data)
            .catch((error) => {
                throw {
                    ...error.response.data,
                    httpStatus: error.response.status,
                    httpStatusText: error.response.statusText,
                    message: 'There was an error while deleting the document.',
                    exception: error.response.data.exception ?? error.response.data.exc_type ?? '',
                } as Error
            })
    }

    /**
     * Gets the count of documents matching the specified filters.
     *
     * @template T - Type of the document for filter fields
     * @param doctype - Name of the doctype
     * @param filters - Optional filters to apply
     * @param cache - Whether to cache the result
     * @param debug - Whether to enable debug mode
     * @returns Promise resolving to the count
     * @throws {Error} If count retrieval fails
     *
     * @example
     * ```typescript
     * // Count all open tasks
     * const openTasks = await db.getCount('Task', [
     *   ['status', '=', 'Open']
     * ]);
     *
     * // Count with caching
     * const userCount = await db.getCount('User',
     *   [['user_type', '=', 'System User']],
     *   true
     * );
     * ```
     */
    async getCount<T = object>(
        doctype: string,
        filters?: Filter<T>[],
        cache: boolean = false,
        debug: boolean = false,
    ): Promise<number> {
        const params: Record<string, unknown> = {
            doctype,
            filters: [],
        }

        if (cache) {
            params.cache = cache
        }

        if (debug) {
            params.debug = debug
        }
        if (filters) {
            params.filters = filters ? JSON.stringify(filters) : undefined
        }

        return this.axios
            .get('/api/method/frappe.client.get_count', { params })
            .then((res) => res.data.message)
            .catch((error) => {
                throw {
                    ...error.response.data,
                    httpStatus: error.response.status,
                    httpStatusText: error.response.statusText,
                    message: 'There was an error while getting the count.',
                    exception: error.response.data.exception ?? error.response.data.exc_type ?? '',
                } as Error
            })
    }

    /**
     * Gets the most recent document of a doctype matching the specified criteria.
     *
     * @template T - Type of the document
     * @param doctype - Name of the doctype
     * @param args - Optional query arguments
     * @returns Promise resolving to the last document
     * @throws {Error} If document retrieval fails
     *
     * @example
     * ```typescript
     * // Get last created task
     * const lastTask = await db.getLastDoc('Task');
     *
     * // Get last completed task
     * const lastCompleted = await db.getLastDoc('Task', {
     *   filters: [['status', '=', 'Completed']],
     *   orderBy: { field: 'modified', order: 'desc' }
     * });
     * ```
     */
    async getLastDoc<T = object>(doctype: string, args?: GetLastDocArgs<FrappeDoc<T>>): Promise<FrappeDoc<T>> {
        let queryArgs: GetLastDocArgs<FrappeDoc<T>> = {
            orderBy: {
                field: 'creation',
                order: 'desc',
            },
        }
        if (args) {
            queryArgs = {
                ...queryArgs,
                ...args,
            }
        }

        const getDocLists = await this.getDocList<{ name: string }, FrappeDoc<T>>(doctype, {
            ...queryArgs,
            limit: 1,
            fields: ['name'],
        })
        if (getDocLists.length > 0) {
            return this.getDoc<T>(doctype, getDocLists[0].name)
        }

        return {} as FrappeDoc<T>
    }
}
