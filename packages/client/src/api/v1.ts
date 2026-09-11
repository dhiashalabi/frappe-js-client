/**
 * @module api/v1
 * @description Classic Frappe REST: `/api/method` + `/api/resource`. Works on v14, v15, v16.
 */

import { FeatureNotSupportedError } from '../core/errors'
import { classicMethodPath, jsonParam, resourcePath } from '../core/url'
import { type AdapterRequest, type ApiAdapter, createCapabilities, type ListParams, type ListResult } from './adapter'

function v1Unsupported(feature: string): never {
    throw new FeatureNotSupportedError(feature, 'requires apiVersion: 2.')
}

function buildListParams(args?: ListParams): Record<string, unknown> {
    if (!args) return {}
    const orderByString = args.orderBy ? `${args.orderBy.field} ${args.orderBy.order ?? 'asc'}` : undefined
    return {
        fields: jsonParam(args.fields),
        filters: jsonParam(args.filters),
        or_filters: jsonParam(args.orFilters),
        group_by: args.groupBy,
        order_by: orderByString,
        limit_start: args.limitStart,
        limit: args.limit,
        as_dict: args.asDict ?? true,
        parent: args.parent,
        debug: args.debug,
        expand: jsonParam(args.expand),
    }
}

export class V1Adapter implements ApiAdapter {
    readonly version = 1 as const
    readonly capabilities = createCapabilities(1)

    method(path: string): string {
        return classicMethodPath(path)
    }

    classicMethod(path: string): string {
        return classicMethodPath(path)
    }

    getDoc(doctype: string, name: string, args?: { expandLinks?: boolean }): AdapterRequest {
        return {
            method: 'GET',
            url: resourcePath(1, doctype, name),
            params: args?.expandLinks ? { expand_links: 1 } : undefined,
            unwrap: 'data',
        }
    }

    list(doctype: string, args?: ListParams): AdapterRequest {
        return { method: 'GET', url: resourcePath(1, doctype), params: buildListParams(args), unwrap: 'none' }
    }

    create(doctype: string, value: unknown): AdapterRequest {
        return { method: 'POST', url: resourcePath(1, doctype), data: value, unwrap: 'data' }
    }

    update(doctype: string, name: string, value: unknown): AdapterRequest {
        return { method: 'PUT', url: resourcePath(1, doctype, name), data: value, unwrap: 'data' }
    }

    delete(doctype: string, name: string): AdapterRequest {
        return { method: 'DELETE', url: resourcePath(1, doctype, name), unwrap: 'none' }
    }

    count(doctype: string, args?: { filters?: unknown; debug?: boolean; cache?: boolean }): AdapterRequest {
        return {
            method: 'GET',
            url: classicMethodPath('frappe.client.get_count'),
            params: { doctype, filters: jsonParam(args?.filters), debug: args?.debug, cache: args?.cache },
            unwrap: 'envelope',
        }
    }

    rename(doctype: string, oldName: string, newName: string, merge: boolean): AdapterRequest {
        return {
            method: 'POST',
            url: classicMethodPath('frappe.client.rename_doc'),
            data: { doctype, old_name: oldName, new_name: newName, merge },
            unwrap: 'envelope',
        }
    }

    submit(_doctype: string, _name: string, doc?: unknown): AdapterRequest {
        return { method: 'POST', url: classicMethodPath('frappe.client.submit'), data: { doc }, unwrap: 'envelope' }
    }

    cancel(doctype: string, name: string): AdapterRequest {
        return {
            method: 'POST',
            url: classicMethodPath('frappe.client.cancel'),
            data: { doctype, name },
            unwrap: 'envelope',
        }
    }

    copy(_doctype: string, _name: string): never {
        return v1Unsupported('copyDoc')
    }

    meta(_doctype: string): never {
        return v1Unsupported('getMeta')
    }

    docMethod(_doctype: string, _name: string, _method: string): never {
        return v1Unsupported('runMethod')
    }

    controllerMethod(_doctype: string, _method: string): never {
        return v1Unsupported('doctypeMethod')
    }

    runDocMethod(_method: string, _document: unknown): never {
        return v1Unsupported('runDocMethod')
    }

    unwrapList<T>(body: unknown): ListResult<T> {
        const b = body as any
        const data = b && typeof b === 'object' && 'data' in b ? b.data : b
        return { data: Array.isArray(data) ? data : [] }
    }
}
