import { ResponseError } from '../../core/errors'
import type { RequestOptions } from '../../core/types'
import type { ModuleDeps } from '../deps'
import type { LinkSearchResult, SearchLinkArgs, SearchWidgetArgs } from './types'

/** Normalizes `search_link`'s two verified response shapes: `{ results: [...] }` on Frappe 14, a bare array on 15+. */
function normalizeSearchLinkResult(body: unknown): LinkSearchResult[] {
    if (Array.isArray(body)) return body
    if (body && typeof body === 'object' && Array.isArray((body as { results?: unknown }).results)) {
        return (body as { results: LinkSearchResult[] }).results
    }
    throw new ResponseError('searchLink received an unexpected response shape.')
}

function firstArray(...candidates: unknown[]): unknown[] | undefined {
    for (const candidate of candidates) {
        if (Array.isArray(candidate)) return candidate
    }
    return undefined
}

/**
 * Frappe 14 `search_widget` writes `frappe.response["values"]` and returns nothing. Frappe 15+
 * returns the array (v2 `{ data }`, classic `{ message }`).
 */
function normalizeSearchWidgetResult(body: unknown): unknown {
    if (Array.isArray(body)) return body
    if (!body || typeof body !== 'object') return body
    const obj = body as Record<string, unknown>
    const nested =
        obj.data && typeof obj.data === 'object' && !Array.isArray(obj.data)
            ? (obj.data as Record<string, unknown>)
            : undefined
    const found = firstArray(obj.data, obj.message, obj.values, nested?.values, nested?.message, nested?.results)
    if (found) return found
    if ('data' in obj) return obj.data
    if ('message' in obj) return obj.message
    return body
}

class FrappeSearchImpl {
    private readonly adapter: ModuleDeps['adapter']
    private readonly executor: ModuleDeps['executor']

    /** @internal */
    constructor(deps: ModuleDeps) {
        this.adapter = deps.adapter
        this.executor = deps.executor
    }

    /** `frappe.desk.search.search_link`. Response shape is normalized across Frappe 14 (`{results}`) and 15+ (bare array). */
    async searchLink(
        doctype: string,
        txt: string,
        args?: SearchLinkArgs,
        options?: RequestOptions,
    ): Promise<LinkSearchResult[]> {
        const body = await this.executor.call<unknown>(
            {
                method: 'GET',
                url: this.adapter.method('frappe.desk.search.search_link'),
                params: {
                    doctype,
                    txt,
                    query: args?.query,
                    filters: args?.filters,
                    page_length: args?.pageLength,
                    searchfield: args?.searchField,
                    reference_doctype: args?.referenceDoctype,
                    ignore_user_permissions: args?.ignoreUserPermissions,
                    link_fieldname: args?.linkFieldname,
                },
            },
            'envelope',
            options,
        )
        return normalizeSearchLinkResult(body)
    }

    async searchWidget<T = unknown>(
        doctype: string,
        txt: string,
        args?: SearchWidgetArgs,
        options?: RequestOptions,
    ): Promise<T> {
        const body = await this.executor.call<unknown>(
            {
                method: 'GET',
                url: this.adapter.method('frappe.desk.search.search_widget'),
                params: {
                    doctype,
                    txt,
                    query: args?.query,
                    filters: args?.filters,
                    page_length: args?.pageLength,
                    searchfield: args?.searchField,
                    reference_doctype: args?.referenceDoctype,
                    ignore_user_permissions: args?.ignoreUserPermissions,
                    link_fieldname: args?.linkFieldname,
                    start: args?.start,
                    filter_fields: args?.filterFields,
                    as_dict: args?.asDict,
                },
            },
            'none',
            options,
        )
        return normalizeSearchWidgetResult(body) as T
    }

    getLinkTitle(doctype: string, name: string | number, options?: RequestOptions): Promise<string> {
        return this.executor.call<string>(
            {
                method: 'GET',
                url: this.adapter.method('frappe.desk.search.get_link_title'),
                params: { doctype, docname: name },
            },
            'envelope',
            options,
        )
    }
}

export type FrappeSearch = FrappeSearchImpl

/** @internal */
export function createFrappeSearch(deps: ModuleDeps): FrappeSearch {
    return new FrappeSearchImpl(deps)
}

export * from './types'
