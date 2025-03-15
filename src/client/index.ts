import { AxiosInstance } from 'axios'
import { GetCountArgs, GetDocArgs, GetListArgs, GetValueArgs } from './types'
import { FrappeDoc } from '../db/types'
import { handleRequest } from '../utils/axios'

/**
 * FrappeClient is a class that provides a client for the Frappe API.
 * It is used to fetch documents from the Frappe database.
 *
 * @example
 * ```typescript
 * const client = new FrappeClient('https://instance.example.com', axiosInstance)
 */
export class FrappeClient {
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
     * Fetches a list of documents from the Frappe database.
     *
     * @param doctype - The name of the document type to fetch
     * @param args - The arguments for the fetch operation
     * @returns A promise that resolves to the list of documents
     *
     * @example
     * ```typescript
     * const client = new FrappeClient('https://instance.example.com', axiosInstance)
     * const docs = await client.getList('DocType', {
     *   fields: ['name', 'title'],
     * })
     * ```
     */
    getList<T = object, K = FrappeDoc<T>>(doctype: string, args?: GetListArgs<K>) {
        let params = {}

        if (args) {
            const {
                fields,
                filters,
                groupBy,
                orderBy,
                limit_start,
                limit_page_length,
                asDict = true,
                parent,
                debug,
                orFilters,
            } = args
            const orderByString = orderBy ? `${String(orderBy?.field)} ${orderBy?.order ?? 'asc'}` : ''
            params = {
                fields: fields ? JSON.stringify(fields) : undefined,
                filters: filters ? JSON.stringify(filters) : undefined,
                group_by: groupBy,
                order_by: orderByString,
                limit_start,
                limit_page_length,
                parent,
                debug,
                as_dict: asDict,
                or_filters: orFilters ? JSON.stringify(orFilters) : undefined,
            }
        }
        return handleRequest({
            axios: this.axios,
            config: {
                url: '/api/method/frappe.client.get_list/',
                params: { doctype, ...params },
            },
            errorMessage: 'There was an error while fetching the documents.',
            transformResponse: (response: Record<string, T[]>) => response.message,
        })
    }

    /**
     * Fetches the count of documents from the Frappe database.
     *
     * @param doctype - The name of the document type to fetch
     * @param args - The arguments for the fetch operation
     * @returns A promise that resolves to the count of documents
     *
     * @example
     * ```typescript
     * const client = new FrappeClient('https://instance.example.com', axiosInstance)
     * const count = await client.getCount('DocType', {
     *   filters: ['name', '=', 'test'],
     * })
     * ```
     */
    getCount(doctype: string, args?: GetCountArgs) {
        return handleRequest({
            axios: this.axios,
            config: {
                url: '/api/method/frappe.client.get_count/',
                params: { doctype, ...args },
            },
            errorMessage: 'There was an error while fetching the count.',
            transformResponse: (response: Record<string, number>) => ({
                count: response.message,
            }),
        })
    }

    /**
     * Fetches a document from the Frappe database.
     *
     * @param doctype - The name of the document type to fetch
     * @param name - The name of the document to fetch
     * @param args - The arguments for the fetch operation
     * @returns A promise that resolves to the document
     *
     * @example
     * ```typescript
     * const client = new FrappeClient('https://instance.example.com', axiosInstance)
     * const doc = await client.getDoc('DocType', 'test')
     * ```
     */
    getDoc<T = object>(doctype: string, name: string, args?: GetDocArgs<T>) {
        return handleRequest({
            axios: this.axios,
            config: {
                url: '/api/method/frappe.client.get/',
                params: { doctype, name, ...args },
            },
            errorMessage: 'There was an error while fetching the document.',
            transformResponse: (response: Record<string, T>) => response.message,
        })
    }

    /**
     * Fetches a value from the Frappe database.
     *
     * @param doctype - The name of the document type to fetch
     * @param fieldname - The name of the field to fetch
     * @param args - The arguments for the fetch operation
     * @returns A promise that resolves to the value
     *
     * @example
     * ```typescript
     * const client = new FrappeClient('https://instance.example.com', axiosInstance)
     * const value = await client.getValue('DocType', 'test')
     * ```
     */
    getValue<T = object>(doctype: string, fieldname: string, args?: GetValueArgs<T>) {
        return handleRequest({
            axios: this.axios,
            config: {
                url: '/api/method/frappe.client.get_value/',
                params: { doctype, fieldname, ...args },
            },
            errorMessage: 'There was an error while fetching the value.',
            transformResponse: (response: Record<string, T>) => response.message,
        })
    }

    /**
     * Fetches a single value from the Frappe database.
     *
     * @param doctype - The name of the document type to fetch
     * @param field - The name of the field to fetch
     * @returns A promise that resolves to the value
     *
     * @example
     * ```typescript
     * const client = new FrappeClient('https://instance.example.com', axiosInstance)
     * const value = await client.getSingleValue('DocType', 'test')
     * ```
     */
    getSingleValue<T = object>(doctype: string, field: string) {
        return handleRequest({
            axios: this.axios,
            config: {
                url: '/api/method/frappe.client.get_single_value/',
                params: { doctype, field },
            },
            errorMessage: 'There was an error while fetching the value.',
            transformResponse: (response: Record<string, T>) => response.message,
        })
    }

    /**
     * Sets a value in the Frappe database.
     *
     * @param doctype - The name of the document type to fetch
     * @param name - The name of the document to fetch
     * @param fieldname - The name of the field to fetch
     * @param value - The value to set
     *
     * @example
     * ```typescript
     * const client = new FrappeClient('https://instance.example.com', axiosInstance)
     * await client.setValue('DocType', 'test', 'test', 'test')
     * ```
     */
    setValue<T = object>(doctype: string, name: string, fieldname: string, value: string) {
        return handleRequest({
            axios: this.axios,
            config: {
                method: 'PUT',
                url: '/api/method/frappe.client.set_value/',
                params: { doctype, name, fieldname, value },
            },
            errorMessage: 'There was an error while setting the value.',
            transformResponse: (response: Record<string, T>) => response.message,
        })
    }

    /**
     * Inserts a document in the Frappe database.
     *
     * @param doc - The document to insert
     * @returns A promise that resolves to the inserted document
     *
     * @example
     * ```typescript
     * const client = new FrappeClient('https://instance.example.com', axiosInstance)
     * await client.insertDoc({doctype:'DocType', name:'test', fieldname:'test', value:'test'})
     * ```
     */
    insertDoc<T = object>(doc: object) {
        return handleRequest({
            axios: this.axios,
            config: {
                method: 'POST',
                url: '/api/method/frappe.client.insert/',
                params: { doc },
            },
            errorMessage: 'There was an error while inserting the document.',
            transformResponse: (response: Record<string, T>) => response.message,
        })
    }

    /**
     * Inserts multiple documents in the Frappe database.
     *
     * @param docs - The documents to insert
     * @returns A promise that resolves to the inserted documents
     *
     * @example
     * ```typescript
     * const client = new FrappeClient('https://instance.example.com', axiosInstance)
     * await client.insertMany([{doctype:'DocType', name:'test', fieldname:'test', value:'test'}])
     * ```
     */
    insertMany<T = object>(docs: object[]) {
        return handleRequest({
            axios: this.axios,
            config: {
                method: 'POST',
                url: '/api/method/frappe.client.insert_many/',
                params: { docs },
            },
            errorMessage: 'There was an error while inserting the documents.',
            transformResponse: (response: Record<string, T[]>) => response.message,
        })
    }

    /**
     * Saves a document in the Frappe database.
     *
     * @param doc - The document to save
     * @returns A promise that resolves to the saved document
     *
     * @example
     * ```typescript
     * const client = new FrappeClient('https://instance.example.com', axiosInstance)
     * await client.saveDoc({doctype:'DocType', name:'test', fieldname:'test', value:'test'})
     * ```
     */
    saveDoc<T = object>(doc: object) {
        return handleRequest({
            axios: this.axios,
            config: {
                method: 'POST',
                url: '/api/method/frappe.client.save/',
                params: { doc },
            },
            errorMessage: 'There was an error while saving the document.',
            transformResponse: (response: Record<string, T>) => response.message,
        })
    }

    /**
     * Renames a document in the Frappe database.
     *
     * @param doctype - The name of the document type to rename
     * @param old_name - The old name of the document
     * @param new_name - The new name of the document
     * @param merge - Whether to merge the document
     * @returns A promise that resolves to the renamed document
     *
     * @example
     * ```typescript
     * const client = new FrappeClient('https://instance.example.com', axiosInstance)
     * await client.renameDoc('DocType', 'test', 'test2')
     * ```
     */
    renameDoc<T = object>(doctype: string, old_name: string, new_name: string, merge = false) {
        return handleRequest({
            axios: this.axios,
            config: {
                method: 'POST',
                url: '/api/method/frappe.client.rename_doc/',
                params: { doctype, old_name, new_name, merge },
            },
            errorMessage: 'There was an error while renaming the document.',
            transformResponse: (response: Record<string, T>) => response.message,
        })
    }

    /**
     * Submits a document in the Frappe database.
     *
     * @param doc - The document to submit
     * @returns A promise that resolves to the submitted document
     *
     * @example
     * ```typescript
     * const client = new FrappeClient('https://instance.example.com', axiosInstance)
     * await client.submitDoc({doctype:'DocType', name:'test', fieldname:'test', value:'test'})
     * ```
     */
    submitDoc<T = object>(doc: object) {
        return handleRequest({
            axios: this.axios,
            config: {
                method: 'POST',
                url: '/api/method/frappe.client.submit/',
                params: { doc },
            },
            errorMessage: 'There was an error while submitting the document.',
            transformResponse: (response: Record<string, T>) => response.message,
        })
    }

    /**
     * Cancels a document in the Frappe database.
     *
     * @param doctype - The name of the document type to cancel
     * @param name - The name of the document to cancel
     * @returns A promise that resolves to the canceled document
     *
     * @example
     * ```typescript
     * const client = new FrappeClient('https://instance.example.com', axiosInstance)
     * await client.cancelDoc('DocType', 'test')
     * ```
     */
    cancelDoc<T = object>(doctype: string, name: string) {
        return handleRequest({
            axios: this.axios,
            config: {
                method: 'POST',
                url: '/api/method/frappe.client.cancel/',
                params: { doctype, name },
            },
            errorMessage: 'There was an error while canceling the document.',
            transformResponse: (response: Record<string, T>) => response.message,
        })
    }

    /**
     * Deletes a document in the Frappe database.
     *
     * @param doctype - The name of the document type to delete
     * @param name - The name of the document to delete
     * @returns A promise that resolves to the deleted document
     *
     * @example
     * ```typescript
     * const client = new FrappeClient('https://instance.example.com', axiosInstance)
     * await client.deleteDoc('DocType', 'test')
     * ```
     */
    deleteDoc<T = object>(doctype: string, name: string) {
        return handleRequest({
            axios: this.axios,
            config: {
                method: 'DELETE',
                url: '/api/method/frappe.client.delete/',
                params: { doctype, name },
            },
            errorMessage: 'There was an error while deleting the document.',
            transformResponse: (response: Record<string, T>) => response.message,
        })
    }

    /**
     * Updates multiple documents in the Frappe database.
     *
     * @param docs - The documents to update
     * @returns A promise that resolves to the updated documents
     *
     * @example
     * ```typescript
     * const client = new FrappeClient('https://instance.example.com', axiosInstance)
     * await client.bulkUpdate([{doctype:'DocType', name:'test', fieldname:'test', value:'test'}])
     * ```
     */
    bulkUpdate<T = object>(docs: object[]) {
        return handleRequest({
            axios: this.axios,
            config: {
                method: 'PUT',
                url: '/api/method/frappe.client.bulk_update/',
                params: { docs },
            },
            errorMessage: 'There was an error while updating the documents.',
            transformResponse: (response: Record<string, T>) => response.message,
        })
    }

    /**
     * Makes a GET request to the Frappe API.
     *
     * @param path - The path to the API endpoint
     * @param params - Optional query parameters
     * @returns A promise that resolves to the response data
     */
    get<T = any>(path: string, params?: object) {
        return handleRequest({
            axios: this.axios,
            config: {
                method: 'GET',
                url: path,
                params,
            },
            errorMessage: 'There was an error while making the GET request.',
            transformResponse: (response: Record<string, T>) => response.message,
        })
    }

    /**
     * Makes a POST request to the Frappe API.
     *
     * @param path - The path to the API endpoint
     * @param data - Optional request body
     * @param params - Optional query parameters
     * @returns A promise that resolves to the response data
     */
    post<T = any>(path: string, data?: object, params?: object) {
        return handleRequest({
            axios: this.axios,
            config: {
                method: 'POST',
                url: path,
                data,
                params,
            },
            errorMessage: 'There was an error while making the POST request.',
            transformResponse: (response: Record<string, T>) => response,
        })
    }

    /**
     * Makes a PUT request to the Frappe API.
     *
     * @param path - The path to the API endpoint
     * @param data - Optional request body
     * @param params - Optional query parameters
     * @returns A promise that resolves to the response data
     */
    put<T = any>(path: string, data?: object, params?: object) {
        return handleRequest({
            axios: this.axios,
            config: {
                method: 'PUT',
                url: path,
                data,
                params,
            },
            errorMessage: 'There was an error while making the PUT request.',
            transformResponse: (response: Record<string, T>) => response,
        })
    }

    /**
     * Makes a DELETE request to the Frappe API.
     *
     * @param path - The path to the API endpoint
     * @param params - Optional query parameters
     * @returns A promise that resolves to the response data
     */
    delete<T = any>(path: string, params?: object) {
        return handleRequest({
            axios: this.axios,
            config: {
                method: 'DELETE',
                url: path,
                params,
            },
            errorMessage: 'There was an error while making the DELETE request.',
            transformResponse: (response: Record<string, T>) => response,
        })
    }
}
