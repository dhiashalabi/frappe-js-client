/**
 * @module api/v2
 * @description Frappe v15+ REST v2: `/api/v2/method`, `/api/v2/document`, `/api/v2/doctype`.
 */

import {
    doctypeMethodPath,
    doctypePath,
    documentCopyPath,
    documentMethodPath,
    jsonParam,
    methodPath,
    resourcePath,
} from '../core/url'
import type { FrappeVersion } from './adapter'
import { type AdapterRequest, type ApiAdapter, createCapabilities, type ListParams, type ListResult } from './adapter'

/**
 * Params for the REST list route (`/api/v2/document/{doctype}`). Sent with both the pre-16
 * naming (`limit_start`/`limit_page_length`, which is what `frappe.client.get_list`'s real
 * signature uses, and what Frappe 15's `document_list` forwards to unchanged) and the v16 naming
 * (`start`/`limit`, which Frappe 16's rewritten `document_list` reads directly). Whichever the
 * server doesn't recognize is simply an unused extra query param — Frappe route handlers do not
 * reject unrecognized kwargs. This keeps one REST param builder correct on 15 and 16 without
 * requiring `frappeVersion` to be set.
 */
function buildRestListParams(args: ListParams | undefined, includeExtendedFilters: boolean): Record<string, unknown> {
    const orderByString = args?.orderBy ? `${args.orderBy.field} ${args.orderBy.order ?? 'asc'}` : undefined
    const limitStart = args?.limitStart ?? 0
    const limit = args?.limit ?? 20
    const base: Record<string, unknown> = {
        fields: jsonParam(args?.fields),
        filters: jsonParam(args?.filters),
        order_by: orderByString,
        group_by: args?.groupBy,
        as_dict: args?.asDict ?? true,
        debug: args?.debug,
        // v15 (`get_list` forwarded directly):
        limit_start: limitStart,
        limit_page_length: limit,
        limit: limit,
        // v16 (`document_list`'s own reader):
        start: limitStart,
    }
    if (includeExtendedFilters) {
        base.or_filters = jsonParam(args?.orFilters)
        base.parent = args?.parent
        base.expand = jsonParam(args?.expand)
    }
    return base
}

/** Params for the `frappe.client.get_list` RPC route, matching that function's real parameter names exactly. */
function buildRpcListParams(doctype: string, args?: ListParams): Record<string, unknown> {
    const orderByString = args?.orderBy ? `${args.orderBy.field} ${args.orderBy.order ?? 'asc'}` : undefined
    return {
        doctype,
        fields: jsonParam(args?.fields),
        filters: jsonParam(args?.filters),
        or_filters: jsonParam(args?.orFilters),
        group_by: args?.groupBy,
        order_by: orderByString,
        limit_start: args?.limitStart ?? 0,
        limit_page_length: args?.limit ?? 20,
        as_dict: args?.asDict ?? true,
        debug: args?.debug,
        parent: args?.parent,
        expand: jsonParam(args?.expand),
    }
}

function needsExtendedFilters(args: ListParams = {}): boolean {
    return Boolean(
        (Array.isArray(args.orFilters) && args.orFilters.length > 0) ||
        args.parent ||
        (args.expand && args.expand.length > 0),
    )
}

export class V2Adapter implements ApiAdapter {
    readonly version = 2 as const
    readonly capabilities

    constructor(frappeVersion?: FrappeVersion) {
        this.capabilities = createCapabilities(2, frappeVersion)
    }

    method(path: string): string {
        return methodPath(2, path)
    }

    classicMethod(path: string): string {
        return methodPath(1, path)
    }

    getDoc(doctype: string, name: string, _args?: { expandLinks?: boolean }): AdapterRequest {
        return { method: 'GET', url: resourcePath(2, doctype, name), unwrap: 'data' }
    }

    list(doctype: string, args?: ListParams): AdapterRequest {
        if (needsExtendedFilters(args) && !this.capabilities.restListHonorsExtendedFilters) {
            return {
                method: 'GET',
                url: methodPath(2, 'frappe.client.get_list'),
                params: buildRpcListParams(doctype, args),
                unwrap: 'none',
            }
        }
        return {
            method: 'GET',
            url: resourcePath(2, doctype),
            params: buildRestListParams(args, this.capabilities.restListHonorsExtendedFilters),
            unwrap: 'none',
        }
    }

    create(doctype: string, value: unknown): AdapterRequest {
        return { method: 'POST', url: resourcePath(2, doctype), data: value, unwrap: 'data' }
    }

    update(doctype: string, name: string, value: unknown): AdapterRequest {
        return { method: 'PATCH', url: resourcePath(2, doctype, name), data: value, unwrap: 'data' }
    }

    delete(doctype: string, name: string): AdapterRequest {
        return { method: 'DELETE', url: resourcePath(2, doctype, name), unwrap: 'none' }
    }

    count(doctype: string, args?: { filters?: unknown; debug?: boolean; cache?: boolean }): AdapterRequest {
        return {
            method: 'GET',
            url: doctypePath(doctype, 'count'),
            params: { filters: jsonParam(args?.filters), debug: args?.debug },
            unwrap: 'data',
        }
    }

    rename(doctype: string, oldName: string, newName: string, merge: boolean): AdapterRequest {
        return {
            method: 'POST',
            url: documentMethodPath(doctype, oldName, 'rename'),
            data: { name: newName, merge },
            unwrap: 'envelope',
        }
    }

    submit(doctype: string, name: string): AdapterRequest {
        return { method: 'POST', url: documentMethodPath(doctype, name, 'submit'), unwrap: 'envelope' }
    }

    cancel(doctype: string, name: string): AdapterRequest {
        return { method: 'POST', url: documentMethodPath(doctype, name, 'cancel'), unwrap: 'envelope' }
    }

    copy(doctype: string, name: string, args?: { ignoreNoCopy?: boolean }): AdapterRequest {
        return {
            method: 'GET',
            url: documentCopyPath(doctype, name),
            params: { ignore_no_copy: args?.ignoreNoCopy },
            unwrap: 'data',
        }
    }

    meta(doctype: string): AdapterRequest {
        return { method: 'GET', url: doctypePath(doctype, 'meta'), unwrap: 'data' }
    }

    docMethod(doctype: string, name: string, method: string, args?: unknown): AdapterRequest {
        return { method: 'POST', url: documentMethodPath(doctype, name, method), data: args, unwrap: 'envelope' }
    }

    controllerMethod(doctype: string, method: string, args?: unknown): AdapterRequest {
        return { method: 'POST', url: this.method(doctypeMethodPath(doctype, method)), data: args, unwrap: 'envelope' }
    }

    runDocMethod(method: string, document: unknown, args?: unknown): AdapterRequest {
        return {
            method: 'POST',
            url: this.method('run_doc_method'),
            data: { method, document, kwargs: args },
            unwrap: 'envelope',
        }
    }

    unwrapList<T>(body: unknown): ListResult<T> {
        const b = body as any
        if (b && typeof b === 'object' && 'data' in b) {
            return { data: Array.isArray(b.data) ? b.data : [], hasNextPage: b.has_next_page }
        }
        if (b && typeof b === 'object' && 'message' in b) {
            return { data: Array.isArray(b.message) ? b.message : [] }
        }
        return { data: Array.isArray(b) ? b : [] }
    }
}
