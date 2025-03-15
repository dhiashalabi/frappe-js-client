import { FrappeDoc, Filter } from '../db/types'

export interface GetListArgs<T = FrappeDoc<object>> {
    /** Fields to be fetched */
    fields?: (keyof T | '*')[]
    /** Filters to be applied - SQL AND operation */
    filters?: Filter<T>[]
    /** Group the results by particular field */
    groupBy?: keyof T | (string & Record<never, never>)
    /** Sort configuration for the query */
    orderBy?: {
        /** Field to sort by */
        field: keyof T | (string & Record<never, never>)
        /** Sort order */
        order?: 'asc' | 'desc'
    }
    /** Fetch from nth document in filtered and sorted list. Used for pagination */
    limit_start?: number
    /** Number of documents to be fetched per page. Default is 20 */
    limit_page_length?: number
    /** Parent document name for child tables */
    parent?: string
    /** Debug mode */
    debug?: boolean
    /** Fetch documents as a dictionary */
    asDict?: boolean
    /** Filters to be applied - SQL OR operation */
    orFilters?: Filter<T>[]
}

export interface GetCountArgs<T = FrappeDoc<object>> {
    /** Filters to be applied - SQL AND operation */
    filters?: Filter<T>[] | string
    /** Debug mode */
    debug?: boolean
    /** Cache the result */
    cache?: boolean
}

export interface GetDocArgs<T = FrappeDoc<object>> {
    /** Document name to fetch */
    name: string
    /** Fields to be fetched */
    fields?: (keyof T | '*')[]
    /** Debug mode */
    parent?: string
}

export interface GetValueArgs<T = FrappeDoc<object>> {
    /** Filters to be applied - SQL AND operation */
    filters: Filter<T>[]
    /** Fetch documents as a dictionary */
    as_dict?: boolean
    /** Debug mode */
    debug?: boolean
    /** Parent document name for child tables */
    parent?: string
}
