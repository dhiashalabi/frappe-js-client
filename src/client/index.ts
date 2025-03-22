import { AxiosInstance } from 'axios'
import {
    BulkUpdateResponse,
    GetCountArgs,
    GetCountResponse,
    GetDocArgs,
    GetListArgs,
    GetValueArgs,
    RenameDocResponse,
} from './types'
import { handleRequest } from '../utils/axios'
import { FrappeDocument } from '../frappe/types'
import { ApiData, ApiParams, TypedResponse } from '../call/types'

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
    getList<T extends FrappeDocument = FrappeDocument>(doctype: string, args?: GetListArgs): Promise<T[]> {
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

        return handleRequest<{ message: T[] }, T[]>({
            axios: this.axios,
            config: {
                url: '/api/method/frappe.client.get_list/',
                params: { doctype, ...params },
            },
            errorMessage: 'There was an error while fetching the documents.',
            transformResponse: (response: { message: T[] }) => response.message,
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
    getCount<T extends GetCountResponse = GetCountResponse>(doctype: string, args?: GetCountArgs): Promise<T> {
        return handleRequest<{ data: { message: T } }, T>({
            axios: this.axios,
            config: {
                url: '/api/method/frappe.client.get_count/',
                params: { doctype, ...args },
            },
            errorMessage: 'There was an error while fetching the count.',
            transformResponse: (response: { data: { message: T } }) => response.data.message,
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
    getDoc<T extends FrappeDocument = FrappeDocument>(doctype: string, name: string, args?: GetDocArgs): Promise<T> {
        return handleRequest<{ data: { message: T } }, T>({
            axios: this.axios,
            config: {
                url: '/api/method/frappe.client.get/',
                params: { doctype, name, ...args },
            },
            errorMessage: 'There was an error while fetching the document.',
            transformResponse: (response: { data: { message: T } }) => response.data.message,
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
    getValue<T extends FrappeDocument = FrappeDocument>(
        doctype: string,
        fieldname: string,
        args?: GetValueArgs,
    ): Promise<T> {
        return handleRequest<{ data: { message: T } }, T>({
            axios: this.axios,
            config: {
                url: '/api/method/frappe.client.get_value/',
                params: { doctype, fieldname, ...args },
            },
            errorMessage: 'There was an error while fetching the value.',
            transformResponse: (response: { data: { message: T } }) => response.data.message,
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
    getSingleValue<T extends FrappeDocument = FrappeDocument>(doctype: string, field: string): Promise<T> {
        return handleRequest<{ data: { message: T } }, T>({
            axios: this.axios,
            config: {
                url: '/api/method/frappe.client.get_single_value/',
                params: { doctype, field },
            },
            errorMessage: 'There was an error while fetching the value.',
            transformResponse: (response: { data: { message: T } }) => response.data.message,
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
    setValue<T extends FrappeDocument = FrappeDocument>(
        doctype: string,
        name: string,
        fieldname: string,
        value: string,
    ): Promise<T> {
        return handleRequest<{ data: { message: T } }, T>({
            axios: this.axios,
            config: {
                method: 'PUT',
                url: '/api/method/frappe.client.set_value/',
                params: { doctype, name, fieldname, value },
            },
            errorMessage: 'There was an error while setting the value.',
            transformResponse: (response: { data: { message: T } }) => response.data.message,
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
    insertDoc<T extends FrappeDocument = FrappeDocument>(doc: T): Promise<T> {
        return handleRequest<{ data: { message: T } }, T>({
            axios: this.axios,
            config: {
                method: 'POST',
                url: '/api/method/frappe.client.insert/',
                params: { doc },
            },
            errorMessage: 'There was an error while inserting the document.',
            transformResponse: (response: { data: { message: T } }) => response.data.message,
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
    insertMany<T extends FrappeDocument = FrappeDocument>(docs: T[]): Promise<string[]> {
        return handleRequest<{ data: { message: string[] } }, string[]>({
            axios: this.axios,
            config: {
                method: 'POST',
                url: '/api/method/frappe.client.insert_many/',
                params: { docs },
            },
            errorMessage: 'There was an error while inserting the documents.',
            transformResponse: (response: { data: { message: string[] } }) => response.data.message,
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
    saveDoc<T extends FrappeDocument = FrappeDocument>(doc: T): Promise<T> {
        return handleRequest<{ data: { message: T } }, T>({
            axios: this.axios,
            config: {
                method: 'POST',
                url: '/api/method/frappe.client.save/',
                params: { doc },
            },
            errorMessage: 'There was an error while saving the document.',
            transformResponse: (response: { data: { message: T } }) => response.data.message,
        })
    }

    /**
     * Renames a document in the Frappe database.
     *
     * @param doctype - The name of the document type to rename
     * @param old_name - The old name of the document
     * @param new_name - The new name of the document
     * @param merge - Whether to merge the document
     * @returns A promise that resolves to the new document name
     *
     * @example
     * ```typescript
     * const client = new FrappeClient('https://instance.example.com', axiosInstance)
     * const newName = await client.renameDoc('DocType', 'test', 'test2')
     * ```
     */
    renameDoc<T extends RenameDocResponse = RenameDocResponse>(
        doctype: string,
        old_name: string,
        new_name: string,
        merge = false,
    ): Promise<T> {
        return handleRequest<{ data: { message: T } }, T>({
            axios: this.axios,
            config: {
                method: 'POST',
                url: '/api/method/frappe.client.rename_doc/',
                params: { doctype, old_name, new_name, merge },
            },
            errorMessage: 'There was an error while renaming the document.',
            transformResponse: (response: { data: { message: T } }) => response.data.message,
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
    submitDoc<T extends FrappeDocument = FrappeDocument>(doc: T): Promise<T> {
        return handleRequest<{ data: { message: T } }, T>({
            axios: this.axios,
            config: {
                method: 'POST',
                url: '/api/method/frappe.client.submit/',
                params: { doc },
            },
            errorMessage: 'There was an error while submitting the document.',
            transformResponse: (response: { data: { message: T } }) => response.data.message,
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
    cancelDoc<T extends FrappeDocument = FrappeDocument>(doctype: string, name: string): Promise<T> {
        return handleRequest<{ data: { message: T } }, T>({
            axios: this.axios,
            config: {
                method: 'POST',
                url: '/api/method/frappe.client.cancel/',
                params: { doctype, name },
            },
            errorMessage: 'There was an error while canceling the document.',
            transformResponse: (response: { data: { message: T } }) => response.data.message,
        })
    }

    /**
     * Deletes a document in the Frappe database.
     *
     * @param doctype - The name of the document type to delete
     * @param name - The name of the document to delete
     * @returns A promise that resolves to void on successful deletion
     *
     * @example
     * ```typescript
     * const client = new FrappeClient('https://instance.example.com', axiosInstance)
     * await client.deleteDoc('DocType', 'test')
     * ```
     */
    deleteDoc(doctype: string, name: string): Promise<void> {
        return handleRequest<{ data: { message: never } }, void>({
            axios: this.axios,
            config: {
                method: 'DELETE',
                url: '/api/method/frappe.client.delete/',
                params: { doctype, name },
            },
            errorMessage: 'There was an error while deleting the document.',
            transformResponse: () => void 0,
        })
    }

    /**
     * Updates multiple documents in the Frappe database.
     *
     * @param docs - The documents to update
     * @returns A promise that resolves to the bulk update result containing any failed documents
     *
     * @example
     * ```typescript
     * const client = new FrappeClient('https://instance.example.com', axiosInstance)
     * const result = await client.bulkUpdate([
     *   {doctype:'DocType', name:'test', fieldname:'test', value:'test'}
     * ]);
     * if (result.failed_docs.length > 0) {
     *   console.log('Some documents failed to update:', result.failed_docs);
     * }
     * ```
     */
    bulkUpdate<T extends FrappeDocument = FrappeDocument>(docs: T[]): Promise<BulkUpdateResponse> {
        return handleRequest<{ data: { message: BulkUpdateResponse } }, BulkUpdateResponse>({
            axios: this.axios,
            config: {
                method: 'PUT',
                url: '/api/method/frappe.client.bulk_update/',
                params: { docs },
            },
            errorMessage: 'There was an error while updating the documents.',
            transformResponse: (response: { data: { message: BulkUpdateResponse } }) => response.data.message,
        })
    }

    /**
     * Validates a link in the Frappe database.
     *
     * @param doctype - The name of the document type to validate
     * @param docname - The name of the document to validate
     * @param fields - The fields to validate
     * @returns A promise that resolves to the validated document
     *
     * @example
     * ```typescript
     * const client = new FrappeClient('https://instance.example.com', axiosInstance)
     * await client.validateLink('DocType', 'test', ['field1', 'field2'])
     * ```
     */
    validateLink<T extends FrappeDocument = FrappeDocument>(
        doctype: string,
        docname: string,
        fields = ['name'],
    ): Promise<T> {
        return handleRequest<{ data: { message: T } }, T>({
            axios: this.axios,
            config: {
                method: 'GET',
                url: '/api/method/frappe.client.validate_link',
                params: { doctype, docname, fields: JSON.stringify(fields) },
            },
            errorMessage: 'There was an error while validating the link.',
            transformResponse: (response: { data: { message: T } }) => response.data.message,
        })
    }

    /**
     * Makes a GET request to the Frappe API.
     *
     * @param path - The path to the API endpoint
     * @param params - Optional query parameters
     * @returns A promise that resolves to the complete response data
     *
     * @example
     * ```typescript
     * const client = new FrappeClient('https://instance.example.com', axiosInstance)
     * // For endpoints returning {message: ...}
     * const messageResponse = await client.get('/api/method/some.path');
     * console.log(messageResponse.message);
     *
     * // For endpoints returning {data: ...}
     * const dataResponse = await client.get('/api/resource/some.path');
     * console.log(dataResponse.data);
     * ```
     */
    get<T extends TypedResponse<any> = TypedResponse<any>>(path: string, params?: ApiParams): Promise<T> {
        const encodedParams = new URLSearchParams()
        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                if (value !== null && value !== undefined) {
                    const val = typeof value === 'object' ? JSON.stringify(value) : String(value)
                    encodedParams.set(key, val)
                }
            })
        }

        return handleRequest<{ data: T }, T>({
            axios: this.axios,
            config: {
                method: 'GET',
                url: path,
                params: encodedParams,
            },
            errorMessage: 'There was an error while making the GET request.',
            transformResponse: (response: { data: T }) => response.data,
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
    post<T extends TypedResponse<any> = TypedResponse<any>>(
        path: string,
        data?: ApiData,
        params?: ApiParams,
    ): Promise<T> {
        return handleRequest<{ data: T }, T>({
            axios: this.axios,
            config: {
                method: 'POST',
                url: path,
                data,
                params,
            },
            errorMessage: 'There was an error while making the POST request.',
            transformResponse: (response: { data: T }) => response.data,
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
    put<T extends TypedResponse<any> = TypedResponse<any>>(
        path: string,
        data?: ApiData,
        params?: ApiParams,
    ): Promise<T> {
        return handleRequest<{ data: T }, T>({
            axios: this.axios,
            config: {
                method: 'PUT',
                url: path,
                data,
                params,
            },
            errorMessage: 'There was an error while making the PUT request.',
            transformResponse: (response: { data: T }) => response.data,
        })
    }

    /**
     * Makes a DELETE request to the Frappe API.
     *
     * @param path - The path to the API endpoint
     * @param params - Optional query parameters
     * @returns A promise that resolves to the response data
     */
    delete<T extends TypedResponse<any> = TypedResponse<any>>(path: string, params?: ApiParams): Promise<T> {
        return handleRequest<{ data: T }, T>({
            axios: this.axios,
            config: {
                method: 'DELETE',
                url: path,
                params,
            },
            errorMessage: 'There was an error while making the DELETE request.',
            transformResponse: (response: { data: T }) => response.data,
        })
    }
}
