/**
 * @module core/types
 * @description Shared core types. `RequestOptions` is the trailing parameter every public
 * method accepts — it is what makes cancellation, per-request timeouts, and header overrides
 * possible without ever changing a method's required-parameter list.
 */

/** REST API generation. `1` is classic `/api/method` + `/api/resource` (v14+). `2` is `/api/v2` (v15+, default). */
export type ApiVersion = 1 | 2

/**
 * Per-request options accepted as the trailing parameter of every public method.
 *
 * @stable
 */
export interface RequestOptions {
    /** Abort this specific request. Composed with the client's configured timeout. */
    signal?: AbortSignal
    /**
     * Overrides the client's configured timeout for this request only. Applied **per attempt**
     * — with the `retry` middleware, each retry gets the full budget again.
     */
    timeout?: number
    /**
     * A hard wall-clock deadline (milliseconds) for the whole operation, including every retry
     * attempt. Unlike `timeout`, this budget is not reset between attempts.
     */
    deadline?: number
    /** Extra headers merged over the client's configured headers for this request only. */
    headers?: Record<string, string>
    /** Correlation id. Generated automatically if omitted; surfaced on `FrappeError.request.requestId`. */
    requestId?: string
}

/** Server-assigned fields present on every stored document. */
export type FrappeDocMetaKeys =
    | 'name'
    | 'owner'
    | 'creation'
    | 'modified'
    | 'modified_by'
    | 'idx'
    | 'docstatus'
    | 'parent'
    | 'parentfield'
    | 'parenttype'

/** Link field targeting a DocType. A plain `string` at runtime; the parameter is documentation. */
export type Link<DocType extends string = string> = string & (DocType extends string ? unknown : never)

/** Base interface for all Frappe documents. Extra API keys exist at runtime but are not typed. */
export type FrappeDoc<T> = Omit<T, FrappeDocMetaKeys> & {
    doctype: string
    owner: string
    creation: string
    modified: string
    modified_by: string
    idx: number
    docstatus: 0 | 1 | 2
    parent?: string
    parentfield?: string
    parenttype?: string
    name: string
}

/**
 * Payload for `createDoc` / insert: user fields without server-assigned meta.
 * `doctype` is optional because the method already takes it as the first argument.
 */
export type FrappeInsert<T> = Omit<T, FrappeDocMetaKeys | 'doctype'> & {
    doctype?: T extends { doctype: infer D } ? D : string
}

/** Look up a generated DocType by its Frappe name, or fall back to an untyped document. */
export type DocFromMap<Docs extends object, K extends string> = K extends keyof Docs
    ? Docs[K] extends FrappeDoc<object>
        ? Docs[K]
        : FrappeDoc<object>
    : FrappeDoc<object>
