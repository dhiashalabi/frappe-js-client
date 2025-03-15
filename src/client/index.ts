import { AxiosInstance } from 'axios'
import { GetCountArgs, GetDocArgs, GetListArgs, GetValueArgs } from './types'
import { FrappeDoc } from '../db/types'

/**
 * FrappeClient is a class that provides a client for the Frappe API.
 * It is used to fetch documents from the Frappe database.
 *
 * @example
 * ```typescript
 * const client = new FrappeClient('https://erp.example.com', axiosInstance)
 */
export class FrappeClient {
    /** URL of the Frappe App instance */
    // @ts-expect-error - This is a private property that is not used in the class
    private readonly appURL: string

    /** Axios instance for making HTTP requests */
    readonly axios: AxiosInstance

    /**
     * Creates a new FrappeClient instance.
     *
     * @param appURL - The URL of the Frappe App instance
     * @param axios - The Axios instance for making HTTP requests
     */
    constructor(appURL: string, axios: AxiosInstance) {
        this.appURL = appURL
        this.axios = axios
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
     * const client = new FrappeClient('https://erp.example.com', axiosInstance)
     * const docs = await client.getList('DocType', {
     *   fields: ['name', 'title'],
     * })
     * ```
     */
    async getList<T = object, K = FrappeDoc<T>>(doctype: string, args?: GetListArgs<K>) {
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

        return this.axios
            .get<{ data: T[] }>(`/frappe.client.get_list/`, {
                params: {
                    doctype,
                    ...params,
                },
            })
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
     * Fetches the count of documents from the Frappe database.
     *
     * @param doctype - The name of the document type to fetch
     * @param args - The arguments for the fetch operation
     * @returns A promise that resolves to the count of documents
     *
     * @example
     * ```typescript
     * const client = new FrappeClient('https://erp.example.com', axiosInstance)
     * const count = await client.getCount('DocType', {
     *   filters: ['name', '=', 'test'],
     * })
     * ```
     */
    async getCount(doctype: string, args?: GetCountArgs) {
        return this.axios
            .get<{ data: number }>(`/frappe.client.get_count/`, { params: { doctype, ...args } })
            .then((res) => res.data.data)
            .catch((error) => {
                throw {
                    ...error.response.data,
                    httpStatus: error.response.status,
                    httpStatusText: error.response.statusText,
                    message: 'There was an error while fetching the count.',
                } as Error
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
     * const client = new FrappeClient('https://erp.example.com', axiosInstance)
     * const doc = await client.getDoc('DocType', 'test')
     * ```
     */
    async getDoc<T = object>(doctype: string, name: string, args?: GetDocArgs<T>) {
        return this.axios
            .get<{ data: T }>(`/frappe.client.get/`, { params: { doctype, name, ...args } })
            .then((res) => res.data.data)
            .catch((error) => {
                throw {
                    ...error.response.data,
                    httpStatus: error.response.status,
                    httpStatusText: error.response.statusText,
                    message: 'There was an error while fetching the document.',
                } as Error
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
     * const client = new FrappeClient('https://erp.example.com', axiosInstance)
     * const value = await client.getValue('DocType', 'test')
     * ```
     */
    async getValue<T = object>(doctype: string, fieldname: string, args?: GetValueArgs<T>) {
        return this.axios
            .get<{ data: T }>(`/frappe.client.get_value/`, { params: { doctype, fieldname, ...args } })
            .then((res) => res.data.data)
            .catch((error) => {
                throw {
                    ...error.response.data,
                    httpStatus: error.response.status,
                    httpStatusText: error.response.statusText,
                    message: 'There was an error while fetching the value.',
                } as Error
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
     * const client = new FrappeClient('https://erp.example.com', axiosInstance)
     * const value = await client.getSingleValue('DocType', 'test')
     * ```
     */
    async getSingleValue<T = object>(doctype: string, field: string) {
        return this.axios
            .get<{ data: T }>(`/frappe.client.get_single_value/`, { params: { doctype, field } })
            .then((res) => res.data.data)
            .catch((error) => {
                throw {
                    ...error.response.data,
                    httpStatus: error.response.status,
                    httpStatusText: error.response.statusText,
                    message: 'There was an error while fetching the value.',
                } as Error
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
     * const client = new FrappeClient('https://erp.example.com', axiosInstance)
     * await client.setValue('DocType', 'test', 'test', 'test')
     * ```
     */
    async setValue<T = object>(doctype: string, name: string, fieldname: string, value: string) {
        return this.axios
            .post<{ data: T }>(`/frappe.client.set_value/`, { params: { doctype, name, fieldname, value } })
            .then((res) => res.data.data)
            .catch((error) => {
                throw {
                    ...error.response.data,
                    httpStatus: error.response.status,
                    httpStatusText: error.response.statusText,
                    message: 'There was an error while setting the value.',
                } as Error
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
     * const client = new FrappeClient('https://erp.example.com', axiosInstance)
     * await client.insert({doctype:'DocType', name:'test', fieldname:'test', value:'test'})
     * ```
     */
    async insert<T = object>(doc: object) {
        return this.axios
            .post<{ data: T }>(`/frappe.client.insert/`, { params: { doc } })
            .then((res) => res.data.data)
            .catch((error) => {
                throw {
                    ...error.response.data,
                    httpStatus: error.response.status,
                    httpStatusText: error.response.statusText,
                    message: 'There was an error while inserting the document.',
                } as Error
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
     * const client = new FrappeClient('https://erp.example.com', axiosInstance)
     * await client.insertMany([{doctype:'DocType', name:'test', fieldname:'test', value:'test'}])
     * ```
     */
    async insertMany<T = object>(docs: object[]) {
        return this.axios
            .post<{ data: T[] }>(`/frappe.client.insert_many/`, { params: { docs } })
            .then((res) => res.data.data)
            .catch((error) => {
                throw {
                    ...error.response.data,
                    httpStatus: error.response.status,
                    httpStatusText: error.response.statusText,
                    message: 'There was an error while inserting the documents.',
                } as Error
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
     * const client = new FrappeClient('https://erp.example.com', axiosInstance)
     * await client.save({doctype:'DocType', name:'test', fieldname:'test', value:'test'})
     * ```
     */
    async save<T = object>(doc: object) {
        return this.axios
            .post<{ data: T }>(`/frappe.client.save/`, { params: { doc } })
            .then((res) => res.data.data)
            .catch((error) => {
                throw {
                    ...error.response.data,
                    httpStatus: error.response.status,
                    httpStatusText: error.response.statusText,
                    message: 'There was an error while saving the document.',
                } as Error
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
     * const client = new FrappeClient('https://erp.example.com', axiosInstance)
     * await client.renameDoc('DocType', 'test', 'test2')
     * ```
     */
    async renameDoc<T = object>(doctype: string, old_name: string, new_name: string, merge = false) {
        return this.axios
            .post<{ data: T }>(`/frappe.client.rename_doc/`, { params: { doctype, old_name, new_name, merge } })
            .then((res) => res.data.data)
            .catch((error) => {
                throw {
                    ...error.response.data,
                    httpStatus: error.response.status,
                    httpStatusText: error.response.statusText,
                    message: 'There was an error while renaming the document.',
                } as Error
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
     * const client = new FrappeClient('https://erp.example.com', axiosInstance)
     * await client.submit({doctype:'DocType', name:'test', fieldname:'test', value:'test'})
     * ```
     */
    async submit<T = object>(doc: object) {
        return this.axios
            .post<{ data: T }>(`/frappe.client.submit/`, { params: { doc } })
            .then((res) => res.data.data)
            .catch((error) => {
                throw {
                    ...error.response.data,
                    httpStatus: error.response.status,
                    httpStatusText: error.response.statusText,
                    message: 'There was an error while submitting the document.',
                } as Error
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
     * const client = new FrappeClient('https://erp.example.com', axiosInstance)
     * await client.cancel('DocType', 'test')
     * ```
     */
    async cancel<T = object>(doctype: string, name: string) {
        return this.axios
            .post<{ data: T }>(`/frappe.client.cancel/`, { params: { doctype, name } })
            .then((res) => res.data.data)
            .catch((error) => {
                throw {
                    ...error.response.data,
                    httpStatus: error.response.status,
                    httpStatusText: error.response.statusText,
                    message: 'There was an error while canceling the document.',
                } as Error
            })
    }

    async delete<T = object>(doctype: string, name: string) {
        return this.axios
            .delete<{ data: T }>(`/frappe.client.delete/`, { params: { doctype, name } })
            .then((res) => res.data.data)
            .catch((error) => {
                throw {
                    ...error.response.data,
                    httpStatus: error.response.status,
                    httpStatusText: error.response.statusText,
                    message: 'There was an error while deleting the document.',
                } as Error
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
     * const client = new FrappeClient('https://erp.example.com', axiosInstance)
     * await client.bulk_update([{doctype:'DocType', name:'test', fieldname:'test', value:'test'}])
     * ```
     */
    async bulk_update<T = object>(docs: object[]) {
        return this.axios
            .put<{ data: T[] }>(`/frappe.client.bulk_update/`, { params: { docs } })
            .then((res) => res.data.data)
            .catch((error) => {
                throw {
                    ...error.response.data,
                    httpStatus: error.response.status,
                    httpStatusText: error.response.statusText,
                    message: 'There was an error while updating the documents.',
                } as Error
            })
    }
}
