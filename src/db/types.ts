/**
 * @module db/types
 * @description Type definitions for Frappe database operations.
 * These types define the structure of database queries, filters, and documents.
 *
 * @packageDocumentation
 */

import { FrappeDoc } from '../frappe/types'

/** Represents valid values for filter operations */
type Value = string | number | boolean | Date | null

/** Operators for single-value filter conditions */
type SingleValueFilterOperator = '=' | '>' | '<' | '>=' | '<=' | '<>' | 'like' | '!=' | 'Timespan'

/** Operators for multi-value filter conditions */
type MultiValueFilterOperator = 'in' | 'not in' | 'between'

/** Field names that can be used in filters */
type FilterVar<T> = keyof T | (string & Record<never, never>)

/** Filter condition with a single value */
type SingleValueFilter<T> = [FilterVar<T>, SingleValueFilterOperator, Value]

/** Filter condition with multiple values */
type MultiValueFilter<T> = [FilterVar<T>, MultiValueFilterOperator, Value[]]

/**
 * Represents a filter condition for Frappe database queries.
 *
 * @template T - The document type being filtered
 *
 * @example
 * ```typescript
 * // Single value filter
 * const nameFilter: Filter<User> = ['name', '=', 'John'];
 *
 * // Multi value filter
 * const statusFilter: Filter<Task> = ['status', 'in', ['Open', 'In Progress']];
 * ```
 */
export type Filter<T = FrappeDoc<object>> = SingleValueFilter<T> | MultiValueFilter<T>

/**
 * Arguments for retrieving the last document from a DocType.
 *
 * @interface GetLastDocArgs
 * @template T - The document type
 *
 * @example
 * ```typescript
 * const args: GetLastDocArgs<Task> = {
 *   filters: [['status', '=', 'Open']],
 *   orderBy: {
 *     field: 'creation',
 *     order: 'desc'
 *   }
 * };
 * ```
 */
export interface GetLastDocArgs<T = FrappeDoc<object>> {
    /** Filters to be applied - SQL AND operation */
    filters?: Filter<T>[]
    /** Filters to be applied - SQL OR operation */
    orFilters?: Filter<T>[]
    /** Sort configuration for the query */
    orderBy?: {
        /** Field to sort by */
        field: keyof T | (string & Record<never, never>)
        /** Sort order */
        order?: 'asc' | 'desc'
    }
}

/**
 * Arguments for retrieving a list of documents from a DocType.
 *
 * @interface GetDocListArgs
 * @template T - The document type
 *
 * @example
 * ```typescript
 * const args: GetDocListArgs<User> = {
 *   fields: ['name', 'email', 'first_name'],
 *   filters: [['user_type', '=', 'System User']],
 *   limit: 10,
 *   orderBy: {
 *     field: 'creation',
 *     order: 'desc'
 *   }
 * };
 * ```
 */
export interface GetDocListArgs<T = FrappeDoc<object>> {
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
    /** Number of documents to be fetched. Default is 20 */
    limit?: number
    /** Parent document name for child tables */
    parent?: string
    /** Debug mode */
    debug?: boolean
    /** Fetch documents as a dictionary */
    asDict?: boolean
    /** Filters to be applied - SQL OR operation */
    orFilters?: Filter<T>[]
}
