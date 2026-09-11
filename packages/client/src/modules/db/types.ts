import type { FrappeDoc } from '../../core/types'

/** No `Date` — Frappe's wire format for dates/datetimes is a fixed local-time string, not a `Date` object. Format with `formatFrappeDate`/`formatFrappeDatetime` before filtering. */
export type Value = string | number | boolean | null

export type SingleValueFilterOperator =
    '=' | '>' | '<' | '>=' | '<=' | '<>' | 'like' | 'not like' | '!=' | 'Timespan' | 'is' | 'is not'
export type MultiValueFilterOperator = 'in' | 'not in' | 'between'
export type FilterVar<T> = keyof T | (string & Record<never, never>)
export type SingleValueFilter<T> = [FilterVar<T>, SingleValueFilterOperator, Value]
export type MultiValueFilter<T> = [FilterVar<T>, MultiValueFilterOperator, Value[]]

export type Filter<T = FrappeDoc<object>> = SingleValueFilter<T> | MultiValueFilter<T>

export interface GetLastDocArgs<T = FrappeDoc<object>> {
    filters?: Filter<T>[]
    orFilters?: Filter<T>[]
    orderBy?: { field: keyof T | (string & Record<never, never>); order?: 'asc' | 'desc' }
}

/** `'*'` (default) returns the full document shape. A literal field-name array narrows the resolved type to `Pick<T, F[number]>`. */
export type FieldsArg<T> = ReadonlyArray<keyof T & string> | '*'

/**
 * @remarks Pagination is always explicit. `limit` defaults to `20` if omitted — no method in
 * this module ever fetches an unbounded collection silently.
 */
export interface GetDocListArgs<T = FrappeDoc<object>, F extends FieldsArg<T> = '*'> {
    fields?: F
    filters?: Filter<T>[]
    groupBy?: keyof T | (string & Record<never, never>)
    orderBy?: { field: keyof T | (string & Record<never, never>); order?: 'asc' | 'desc' }
    /** Fetch from nth document in the filtered/sorted list. */
    start?: number
    /** Number of documents to fetch. Defaults to `20`. There is no "fetch all" option — use `db.paginate()`. */
    limit?: number
    parent?: string
    debug?: boolean
    asDict?: boolean
    orFilters?: Filter<T>[]
    expand?: string[]
}

/** Resolves the row shape for a given `fields` argument: `'*'` (or omitted) is the full document; a literal field array narrows to `Pick<T, F[number]>`. */
export type RowFor<T, F extends FieldsArg<T>> = F extends '*'
    ? T
    : F extends readonly (keyof T)[]
      ? Pick<T, F[number]>
      : T

export interface GetDocArgs {
    expandLinks?: boolean
}

export interface GetCountArgs<T = object> {
    filters?: Filter<T>[] | Record<string, Value>
    debug?: boolean
    cache?: boolean
}

export interface GetValueArgs<T = object> {
    filters?: Filter<T>[] | Record<string, Value> | string
    asDict?: boolean
    debug?: boolean
    parent?: string
}

export type FieldName = string | string[]

export interface GetDocListPage<T> {
    data: T[]
    hasNextPage?: boolean
}

export interface RunMethodArgs {
    [key: string]: unknown
}

export interface BulkUpdateResponse {
    failed_docs: Array<{
        doc: FrappeDoc<object>
        exc: string
    }>
}
