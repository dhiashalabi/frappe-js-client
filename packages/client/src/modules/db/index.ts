import { ConfigurationError, FeatureNotSupportedError } from '../../core/errors'
import type { DocFromMap, FrappeDoc, FrappeInsert, RequestOptions } from '../../core/types'
import { jsonParam } from '../../core/url'
import type { ModuleDeps } from '../deps'
import {
    type BulkUpdateResponse,
    type FieldName,
    type FieldsArg,
    type GetCountArgs,
    type GetDocArgs,
    type GetDocListArgs,
    type GetDocListPage,
    type GetLastDocArgs,
    type GetValueArgs,
    type RowFor,
    type RunMethodArgs,
} from './types'

const DEFAULT_PAGE_SIZE = 20

function validatePagination(args?: { limit?: number; start?: number }): void {
    if (
        args?.limit !== undefined &&
        (!Number.isFinite(args.limit) || !Number.isInteger(args.limit) || args.limit <= 0)
    ) {
        throw new ConfigurationError('Pagination `limit` must be a finite, positive integer.')
    }
    if (
        args?.start !== undefined &&
        (!Number.isFinite(args.start) || !Number.isInteger(args.start) || args.start < 0)
    ) {
        throw new ConfigurationError('Pagination `start` must be a finite, non-negative integer.')
    }
}

/**
 * Document CRUD and query operations. v1/v2 REST differences are isolated in the `ApiAdapter`
 * this module is constructed with.
 *
 * Destroying a document uses `deleteDoc`. Reversible associations (tags, assignments) live
 * on `desk` and use `remove*`.
 */
class FrappeDBImpl<Docs extends object = object, Inserts extends object = object> {
    private readonly adapter: ModuleDeps['adapter']
    private readonly executor: ModuleDeps['executor']

    /** @internal */
    constructor(deps: ModuleDeps) {
        this.adapter = deps.adapter
        this.executor = deps.executor
    }

    getDoc<K extends string & keyof Docs>(
        doctype: K,
        name: string,
        args?: GetDocArgs,
        options?: RequestOptions,
    ): Promise<DocFromMap<Docs, K>>
    getDoc<T extends FrappeDoc<object>>(
        doctype: string,
        name: string,
        args?: GetDocArgs,
        options?: RequestOptions,
    ): Promise<T>
    getDoc(doctype: string, name: string, args?: GetDocArgs, options?: RequestOptions): Promise<FrappeDoc<object>> {
        if (!name) {
            return Promise.reject(new ConfigurationError('getDoc requires a document name'))
        }
        return this.executor.run<FrappeDoc<object>>(this.adapter.getDoc(doctype, name, args), options)
    }

    getDocList<
        K extends string & keyof Docs,
        T extends DocFromMap<Docs, K> = DocFromMap<Docs, K>,
        F extends FieldsArg<T> = '*',
    >(doctype: K, args?: GetDocListArgs<T, F>, options?: RequestOptions): Promise<RowFor<T, F>[]>
    getDocList<T extends FrappeDoc<object>, F extends FieldsArg<T> = '*'>(
        doctype: string,
        args?: GetDocListArgs<T, F>,
        options?: RequestOptions,
    ): Promise<RowFor<T, F>[]>
    async getDocList(
        doctype: string,
        args?: GetDocListArgs<FrappeDoc<object>>,
        options?: RequestOptions,
    ): Promise<FrappeDoc<object>[]> {
        const page = await this.getDocListPage(doctype, args, options)
        return page.data
    }

    /** Same as `getDocList` but includes `hasNextPage` when the server reports it (v2 REST). */
    getDocListPage<
        K extends string & keyof Docs,
        T extends DocFromMap<Docs, K> = DocFromMap<Docs, K>,
        F extends FieldsArg<T> = '*',
    >(doctype: K, args?: GetDocListArgs<T, F>, options?: RequestOptions): Promise<GetDocListPage<RowFor<T, F>>>
    getDocListPage<T extends FrappeDoc<object>, F extends FieldsArg<T> = '*'>(
        doctype: string,
        args?: GetDocListArgs<T, F>,
        options?: RequestOptions,
    ): Promise<GetDocListPage<RowFor<T, F>>>
    async getDocListPage(
        doctype: string,
        args?: GetDocListArgs<FrappeDoc<object>>,
        options?: RequestOptions,
    ): Promise<GetDocListPage<FrappeDoc<object>>> {
        validatePagination(args)
        if ((args as { asDict?: boolean } | undefined)?.asDict === false) {
            throw new ConfigurationError(
                'getDocList requires `asDict` to be true; tuple-shaped rows are not supported.',
            )
        }
        if (args?.expand && args.expand.length > 0 && !this.adapter.capabilities.listExpand) {
            throw new FeatureNotSupportedError(
                'getDocList expand',
                'requires Frappe 15+. Pass `frappeVersion: 15` or `16` to createFrappeClient, or omit `expand`.',
            )
        }
        const req = this.adapter.list(doctype, {
            fields: args?.fields === '*' || args?.fields === undefined ? ['*'] : args.fields,
            filters: args?.filters,
            orFilters: args?.orFilters,
            orderBy: args?.orderBy as { field: string; order?: 'asc' | 'desc' } | undefined,
            groupBy: args?.groupBy as string | undefined,
            limit: args?.limit ?? DEFAULT_PAGE_SIZE,
            limitStart: args?.start,
            parent: args?.parent,
            debug: args?.debug,
            asDict: args?.asDict,
            expand: args?.expand,
        })
        const body = await this.executor.run<unknown>(req, options)
        return this.adapter.unwrapList<FrappeDoc<object>>(body)
    }

    /**
     * Lazily paginate an entire DocType listing, `limit`-sized page at a time. Never fetches an
     * unbounded collection — each page is a normal, bounded `getDocListPage` call.
     */
    paginate<
        K extends string & keyof Docs,
        T extends DocFromMap<Docs, K> = DocFromMap<Docs, K>,
        F extends FieldsArg<T> = '*',
    >(doctype: K, args?: GetDocListArgs<T, F>, options?: RequestOptions): AsyncGenerator<RowFor<T, F>, void, void>
    paginate<T extends FrappeDoc<object>, F extends FieldsArg<T> = '*'>(
        doctype: string,
        args?: GetDocListArgs<T, F>,
        options?: RequestOptions,
    ): AsyncGenerator<RowFor<T, F>, void, void>
    async *paginate(
        doctype: string,
        args?: GetDocListArgs<FrappeDoc<object>>,
        options?: RequestOptions,
    ): AsyncGenerator<FrappeDoc<object>, void, void> {
        validatePagination(args)
        const limit = args?.limit ?? DEFAULT_PAGE_SIZE
        let start = args?.start ?? 0

        while (true) {
            const page = await this.getDocListPage(doctype, { ...args, limit, start }, options)
            for (const doc of page.data) {
                yield doc
            }
            if (page.hasNextPage === false) {
                return
            }
            if (page.hasNextPage !== true && page.data.length < limit) {
                return
            }
            start += limit
        }
    }

    /**
     * `value` need not be a complete {@link FrappeDoc} — server-assigned fields (`name`, `owner`,
     * `creation`, ...) are filled in by Frappe. The first argument is the DocType; `doctype` on
     * the body is optional.
     */
    createDoc<K extends string & keyof Docs>(
        doctype: K,
        value: K extends keyof Inserts ? Inserts[K] : FrappeInsert<DocFromMap<Docs, K>>,
        options?: RequestOptions,
    ): Promise<DocFromMap<Docs, K>>
    createDoc<S extends string>(
        doctype: S extends keyof Docs ? never : S,
        value: Record<string, unknown>,
        options?: RequestOptions,
    ): Promise<FrappeDoc<object>>
    createDoc<T extends FrappeDoc<object> = FrappeDoc<object>>(
        doctype: keyof Docs extends never ? string : never,
        value: Record<string, unknown>,
        options?: RequestOptions,
    ): Promise<T>
    createDoc(doctype: string, value: Record<string, unknown>, options?: RequestOptions): Promise<FrappeDoc<object>> {
        return this.executor.run<FrappeDoc<object>>(this.adapter.create(doctype, value), options)
    }

    /** Patch fields on an existing document. v1 uses PUT; v2 uses PATCH. */
    updateDoc<K extends string & keyof Docs>(
        doctype: K,
        name: string | null,
        value: Partial<DocFromMap<Docs, K>>,
        options?: RequestOptions,
    ): Promise<DocFromMap<Docs, K>>
    updateDoc<S extends string>(
        doctype: S extends keyof Docs ? never : S,
        name: string | null,
        value: Record<string, unknown>,
        options?: RequestOptions,
    ): Promise<FrappeDoc<object>>
    updateDoc<T extends FrappeDoc<object>>(
        doctype: keyof Docs extends never ? string : never,
        name: string | null,
        value: Partial<T> | Record<string, unknown>,
        options?: RequestOptions,
    ): Promise<T>
    updateDoc(
        doctype: string,
        name: string | null,
        value: Record<string, unknown>,
        options?: RequestOptions,
    ): Promise<FrappeDoc<object>> {
        if (!name) {
            return Promise.reject(new ConfigurationError('updateDoc requires a document name'))
        }
        return this.executor.run<FrappeDoc<object>>(this.adapter.update(doctype, name, value), options)
    }

    async deleteDoc(doctype: string, name?: string | null, options?: RequestOptions): Promise<void> {
        if (!name) {
            return Promise.reject(new ConfigurationError('deleteDoc requires a document name'))
        }
        await this.executor.run<unknown>(this.adapter.delete(doctype, name), options)
    }

    async getLastDoc<K extends string & keyof Docs, T extends DocFromMap<Docs, K> = DocFromMap<Docs, K>>(
        doctype: K,
        args?: GetLastDocArgs<T>,
        options?: RequestOptions,
    ): Promise<T | null>
    async getLastDoc<T extends FrappeDoc<object>>(
        doctype: string,
        args?: GetLastDocArgs<T>,
        options?: RequestOptions,
    ): Promise<T | null>
    async getLastDoc(
        doctype: string,
        args?: GetLastDocArgs<FrappeDoc<object>>,
        options?: RequestOptions,
    ): Promise<FrappeDoc<object> | null> {
        const list = await this.getDocList(
            doctype,
            { orderBy: { field: 'creation', order: 'desc' }, ...args, limit: 1, fields: ['name'] as const },
            options,
        )
        if (list.length > 0) {
            return this.getDoc(doctype, (list[0] as { name: string }).name, undefined, options)
        }
        return null
    }

    getCount<T = object>(doctype: string, args?: GetCountArgs<T>, options?: RequestOptions): Promise<number> {
        return this.executor.run<number>(
            this.adapter.count(doctype, { filters: args?.filters, debug: args?.debug, cache: args?.cache }),
            options,
        )
    }

    async exists(doctype: string, name: string, options?: RequestOptions): Promise<boolean> {
        const count = await this.getCount(doctype, { filters: [['name', '=', name]] }, options)
        return count > 0
    }

    getValue<T = unknown>(
        doctype: string,
        fieldName: FieldName,
        args?: GetValueArgs,
        options?: RequestOptions,
    ): Promise<T> {
        const fieldParam = Array.isArray(fieldName) ? JSON.stringify(fieldName) : fieldName
        return this.executor.call<T>(
            {
                method: 'GET',
                url: this.adapter.method('frappe.client.get_value'),
                params: {
                    doctype,
                    fieldname: fieldParam,
                    filters: args?.filters ? jsonParam(args.filters) : undefined,
                    as_dict: args?.asDict ?? true,
                    debug: args?.debug,
                    parent: args?.parent,
                },
            },
            'envelope',
            options,
        )
    }

    /**
     * Set a field, or several fields when `fieldName` is a map of values.
     * Pass `value` only for the single-field form.
     */
    setValue<T extends FrappeDoc<object>>(
        doctype: string,
        name: string,
        fieldName: string | Record<string, unknown>,
        value?: unknown,
        options?: RequestOptions,
    ): Promise<T> {
        const payload: Record<string, unknown> = { doctype, name, fieldname: fieldName }
        if (typeof fieldName !== 'object') {
            payload.value = value
        }
        return this.executor.call<T>(
            { method: 'POST', url: this.adapter.method('frappe.client.set_value'), data: payload },
            'envelope',
            options,
        )
    }

    getSingleValue<T = unknown>(doctype: string, fieldName: string, options?: RequestOptions): Promise<T> {
        return this.executor.call<T>(
            {
                method: 'GET',
                url: this.adapter.method('frappe.client.get_single_value'),
                params: { doctype, field: fieldName },
            },
            'envelope',
            options,
        )
    }

    getSingle<K extends string & keyof Docs, T extends DocFromMap<Docs, K> = DocFromMap<Docs, K>>(
        doctype: K,
        options?: RequestOptions,
    ): Promise<T>
    getSingle<T extends FrappeDoc<object>>(doctype: string, options?: RequestOptions): Promise<T>
    getSingle(doctype: string, options?: RequestOptions): Promise<FrappeDoc<object>> {
        return this.executor.call<FrappeDoc<object>>(
            { method: 'GET', url: this.adapter.method('frappe.client.get'), params: { doctype } },
            'envelope',
            options,
        )
    }

    setSingle<T extends FrappeDoc<object>>(
        doctype: string,
        values: Record<string, unknown>,
        options?: RequestOptions,
    ): Promise<T> {
        return this.setValue<T>(doctype, doctype, values, undefined, options)
    }

    /** When `merge` is true, Frappe merges into an existing `newName`. */
    renameDoc(
        doctype: string,
        oldName: string,
        newName: string,
        merge = false,
        options?: RequestOptions,
    ): Promise<string> {
        return this.executor.run<string>(this.adapter.rename(doctype, oldName, newName, merge), options)
    }

    submit<T extends FrappeDoc<object>>(doc: T, options?: RequestOptions): Promise<T> {
        return this.executor.run<T>(this.adapter.submit(doc.doctype, doc.name, doc), options)
    }

    cancel<T extends FrappeDoc<object>>(doctype: string, name: string, options?: RequestOptions): Promise<T> {
        return this.executor.run<T>(this.adapter.cancel(doctype, name), options)
    }

    /**
     * Copy is not inserted. Requires `apiVersion: 2`.
     * @throws FeatureNotSupportedError on classic REST.
     */
    async copyDoc<K extends string & keyof Docs, T extends DocFromMap<Docs, K> = DocFromMap<Docs, K>>(
        doctype: K,
        name: string,
        ignoreNoCopy?: boolean,
        options?: RequestOptions,
    ): Promise<T>
    async copyDoc<T extends FrappeDoc<object>>(
        doctype: string,
        name: string,
        ignoreNoCopy?: boolean,
        options?: RequestOptions,
    ): Promise<T>
    async copyDoc(
        doctype: string,
        name: string,
        ignoreNoCopy = true,
        options?: RequestOptions,
    ): Promise<FrappeDoc<object>> {
        return this.executor.run<FrappeDoc<object>>(this.adapter.copy(doctype, name, { ignoreNoCopy }), options)
    }

    /**
     * Requires `apiVersion: 2`.
     * @throws FeatureNotSupportedError on classic REST.
     */
    async getMeta<T = unknown>(doctype: string, options?: RequestOptions): Promise<T> {
        return this.executor.run<T>(this.adapter.meta(doctype), options)
    }

    /**
     * Document controller method. Requires `apiVersion: 2`.
     * @throws FeatureNotSupportedError on classic REST.
     */
    async runMethod<T = unknown>(
        doctype: string,
        name: string,
        method: string,
        args?: RunMethodArgs,
        options?: RequestOptions,
    ): Promise<T> {
        return this.executor.run<T>(this.adapter.docMethod(doctype, name, method, args), options)
    }

    insertMany<K extends string & keyof Docs>(
        docs: Array<
            {
                [P in K]: (P extends keyof Inserts ? Inserts[P] : FrappeInsert<DocFromMap<Docs, P>>) & { doctype: P }
            }[K]
        >,
        options?: RequestOptions,
    ): Promise<string[]>
    insertMany<S extends string>(
        docs: Array<Record<string, unknown> & { doctype: S extends keyof Docs ? never : S }>,
        options?: RequestOptions,
    ): Promise<string[]>
    insertMany<T extends FrappeDoc<object>>(
        docs: keyof Docs extends never ? Array<FrappeInsert<T> & { doctype: string }> : never,
        options?: RequestOptions,
    ): Promise<string[]>
    insertMany(docs: Array<{ doctype: string }>, options?: RequestOptions): Promise<string[]> {
        return this.executor.call<string[]>(
            { method: 'POST', url: this.adapter.method('frappe.client.insert_many'), data: { docs } },
            'envelope',
            options,
        )
    }

    /**
     * `frappe.client.bulk_update` takes `docs` as a JSON string. `insertMany` takes a list.
     * Both encodings are the server contract, not a client inconsistency.
     */
    updateMany<T extends FrappeDoc<object>>(docs: T[], options?: RequestOptions): Promise<BulkUpdateResponse> {
        const payload = docs.map((doc) => ({ ...doc, docname: (doc as T & { docname?: string }).docname ?? doc.name }))
        return this.executor.call<BulkUpdateResponse>(
            {
                method: 'POST',
                url: this.adapter.method('frappe.client.bulk_update'),
                data: { docs: jsonParam(payload) },
            },
            'envelope',
            options,
        )
    }

    /**
     * POST is deliberate: the arguments identify a secret, and GET query params leak into
     * access logs, proxies, and browser history.
     */
    getPassword(doctype: string, name: string | number, fieldName: string, options?: RequestOptions): Promise<string> {
        return this.executor.call<string>(
            {
                method: 'POST',
                url: this.adapter.method('frappe.client.get_password'),
                data: { doctype, name, fieldname: fieldName },
            },
            'envelope',
            options,
        )
    }

    isDocumentAmended(doctype: string, name: string | number, options?: RequestOptions): Promise<boolean> {
        return this.executor.call<boolean>(
            {
                method: 'GET',
                url: this.adapter.method('frappe.client.is_document_amended'),
                params: { doctype, docname: name },
            },
            'envelope',
            options,
        )
    }

    /**
     * Validates a Link value and optionally fetches fields.
     *
     * On Frappe 14/15 (and when `frappeVersion` is omitted) this calls `frappe.client.validate_link`.
     * On Frappe 16 it calls `frappe.client.validate_link_and_fetch` (`fields` → `fields_to_fetch`).
     * Pass `frappeVersion: 16` on v16 sites — `validate_link` was removed there.
     *
     * Invalid links return `{ name: null }` on 14/15 and `{}` on 16. Treat a missing/null `name` as invalid.
     */
    validateLink<T = Record<string, string>>(
        doctype: string,
        name: string,
        fields: string[] = ['name'],
        options?: RequestOptions,
    ): Promise<T> {
        if (this.adapter.capabilities.validateLinkAndFetch) {
            return this.executor.call<T>(
                {
                    method: 'GET',
                    url: this.adapter.method('frappe.client.validate_link_and_fetch'),
                    params: { doctype, docname: name, fields_to_fetch: jsonParam(fields) },
                },
                'envelope',
                options,
            )
        }
        return this.executor.call<T>(
            {
                method: 'GET',
                url: this.adapter.method('frappe.client.validate_link'),
                params: { doctype, docname: name, fields: jsonParam(fields) },
            },
            'envelope',
            options,
        )
    }

    /**
     * `frappe.client.validate_link_and_fetch` with optional link filters. Frappe 16+ only.
     * For existence + field fetch without filters, `validateLink()` is enough once `frappeVersion: 16` is set.
     * @throws FeatureNotSupportedError when `frappeVersion` is not `16`.
     */
    async validateLinkAndFetch<T = Record<string, string>>(
        doctype: string,
        name: string,
        fieldsToFetch: string[],
        args?: { filters?: unknown },
        options?: RequestOptions,
    ): Promise<T> {
        if (!this.adapter.capabilities.validateLinkAndFetch) {
            throw new FeatureNotSupportedError(
                'validateLinkAndFetch',
                'requires Frappe 16+. Pass `frappeVersion: 16` to createFrappeClient once your site is upgraded.',
            )
        }
        return this.executor.call<T>(
            {
                method: 'GET',
                url: this.adapter.method('frappe.client.validate_link_and_fetch'),
                params: {
                    doctype,
                    docname: name,
                    fields_to_fetch: jsonParam(fieldsToFetch),
                    filters: jsonParam(args?.filters),
                },
            },
            'envelope',
            options,
        )
    }
}

/** Document CRUD and query operations. */
export type FrappeDB<Docs extends object = object, Inserts extends object = object> = FrappeDBImpl<Docs, Inserts>

/** @internal */
export function createFrappeDB<Docs extends object = object, Inserts extends object = object>(
    deps: ModuleDeps,
): FrappeDB<Docs, Inserts> {
    return new FrappeDBImpl<Docs, Inserts>(deps)
}

export * from './types'
