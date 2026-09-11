/**
 * @module api/adapter
 * @description Isolates every v1/v2 behavioral difference behind one interface. `ApiAdapter`
 * owns paths, verbs, query-parameter naming, and envelope unwrapping for one REST generation —
 * domain modules never branch on version themselves, they only call `adapter.*` and get back an
 * {@link AdapterRequest} to hand to the `Executor`.
 *
 * `Capabilities` is a second, orthogonal axis: some behavior differs by **Frappe release**
 * (14/15/16), not by REST generation. `frappeVersion` is an optional hint on
 * `createFrappeClient` — when omitted, every capability resolves to the value that is correct
 * on every supported release (never a guess that could be wrong).
 */

import type { ApiVersion } from '../core/types'

export type Unwrap = 'envelope' | 'message' | 'data' | 'none'

/** A version-specific request shape, plus the envelope strategy the caller should apply. */
export interface AdapterRequest {
    method: string
    url: string
    params?: Record<string, unknown>
    data?: unknown
    unwrap: Unwrap
}

export interface ListParams {
    fields?: unknown
    filters?: unknown
    orFilters?: unknown
    orderBy?: { field: string; order?: 'asc' | 'desc' }
    groupBy?: string
    limit?: number
    limitStart?: number
    parent?: string
    debug?: boolean
    asDict?: boolean
    expand?: string[]
}

export interface ListResult<T> {
    data: T[]
    hasNextPage?: boolean
}

export type FrappeVersion = 14 | 15 | 16

/**
 * Behavior that depends on the Frappe *release* rather than the REST *generation*
 * (`apiVersion`). Every field is conservative when `frappeVersion` is unset: it resolves to the
 * value that produces correct behavior on every release this client supports.
 *
 * @stable
 */
export interface Capabilities {
    /**
     * `frappe.client.validate_link_and_fetch` exists. Confirmed present on Frappe 16
     * (`develop`), absent on Frappe 15 (`version-15`). Unknown -> `false` (use `validate_link`,
     * which exists on every release).
     */
    readonly validateLinkAndFetch: boolean
    /**
     * The REST list endpoint (`/api/resource/{doctype}` on `apiVersion: 1`,
     * `/api/v2/document/{doctype}` on `apiVersion: 2`) forwards to `frappe.client.get_list`
     * verbatim, so `orFilters` / `parent` / `expand` reach the query. Confirmed true for
     * `apiVersion: 1` on every release, and for `apiVersion: 2` on Frappe 15 (its `document_list`
     * is `frappe.call(frappe.client.get_list, ...)`, identical to v1). Confirmed **false** for
     * `apiVersion: 2` on Frappe 16 (`develop`'s `document_list` is a rewritten handler that reads
     * only `fields, filters, order_by, start, limit, group_by, debug, as_dict`). Unknown ->
     * `false` for `apiVersion: 2` (routes through the `frappe.client.get_list` RPC instead, which
     * works identically on every release).
     */
    readonly restListHonorsExtendedFilters: boolean
}

export function createCapabilities(apiVersion: ApiVersion, frappeVersion?: FrappeVersion): Capabilities {
    return {
        validateLinkAndFetch: frappeVersion === 16,
        restListHonorsExtendedFilters: apiVersion === 1 || frappeVersion === 15,
    }
}

/**
 * One adapter per Frappe REST generation. Owns path construction, verb selection, query-param
 * naming, and envelope unwrapping for that generation. Every method returns an
 * {@link AdapterRequest} — nothing here performs I/O.
 */
export interface ApiAdapter {
    readonly version: ApiVersion
    readonly capabilities: Capabilities

    /** `/api/method/{path}` on v1, `/api/v2/method/{path}` on v2. For whitelisted custom RPCs. */
    method(path: string): string
    /** Always `/api/method/{path}`, regardless of `version`. Login/logout/ping/upload/download live here on every release. */
    classicMethod(path: string): string

    getDoc(doctype: string, name: string, args?: { expandLinks?: boolean }): AdapterRequest
    list(doctype: string, args?: ListParams): AdapterRequest
    create(doctype: string, value: unknown): AdapterRequest
    update(doctype: string, name: string, value: unknown): AdapterRequest
    delete(doctype: string, name: string): AdapterRequest
    count(doctype: string, args?: { filters?: unknown; debug?: boolean; cache?: boolean }): AdapterRequest
    rename(doctype: string, oldName: string, newName: string, merge: boolean): AdapterRequest
    submit(doctype: string, name: string, doc?: unknown): AdapterRequest
    cancel(doctype: string, name: string): AdapterRequest

    /** Requires `apiVersion: 2`. Throws `FeatureNotSupportedError` on a v1 adapter. */
    copy(doctype: string, name: string, args?: { ignoreNoCopy?: boolean }): AdapterRequest
    /** Requires `apiVersion: 2`. Throws `FeatureNotSupportedError` on a v1 adapter. */
    meta(doctype: string): AdapterRequest
    /** Requires `apiVersion: 2`. Throws `FeatureNotSupportedError` on a v1 adapter. */
    docMethod(doctype: string, name: string, method: string, args?: unknown): AdapterRequest
    /** `{Doctype}/{method}` controller shorthand. Requires `apiVersion: 2`. */
    controllerMethod(doctype: string, method: string, args?: unknown): AdapterRequest
    /** `run_doc_method`. Requires `apiVersion: 2`. */
    runDocMethod(method: string, document: unknown, args?: unknown): AdapterRequest

    /** Normalizes a raw list response body (REST `{data, has_next_page}` or RPC `{message}`) into `{data, hasNextPage}`. */
    unwrapList<T>(body: unknown): ListResult<T>
}
