import type { RequestOptions } from '../../core/types'
import type { ModuleDeps } from '../deps'
import type { LinkSearchResult, SearchLinkArgs, SearchWidgetArgs } from './types'

/** Normalizes `search_link`'s two verified response shapes: `{ results: [...] }` on Frappe 14, a bare array on 15+. */
function normalizeSearchLinkResult(body: unknown): LinkSearchResult[] {
    if (Array.isArray(body)) return body
    if (body && typeof body === 'object' && Array.isArray((body as { results?: unknown }).results)) {
        return (body as { results: LinkSearchResult[] }).results
    }
    return []
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

    searchWidget<T = unknown>(
        doctype: string,
        txt: string,
        args?: SearchWidgetArgs,
        options?: RequestOptions,
    ): Promise<T> {
        return this.executor.call<T>(
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
            'envelope',
            options,
        )
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
