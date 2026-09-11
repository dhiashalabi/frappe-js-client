/**
 * @module core/executor
 * @description The one place domain modules talk to the transport. Wraps `Transport`, owns
 * every unwrap strategy, and turns an {@link AdapterRequest} (produced by `api/adapter`) into a
 * plain HTTP call. Domain modules never touch `Transport` or envelope shapes directly — they
 * call `adapter.*()` to get a request, then `executor.run(request)`.
 */

import type { AdapterRequest, Unwrap } from '../api/adapter'
import type { ResponseType, Transport, UploadProgressEvent } from './transport'
import type { ApiVersion, RequestOptions } from './types'

export interface RequestConfig {
    method: string
    url: string
    params?: Record<string, unknown>
    data?: unknown
    responseType?: ResponseType
    onUploadProgress?: (event: UploadProgressEvent) => void
}

/** Unwraps a body that may be wrapped as `{ data: ... }` (v2) or returned bare (v1). Returns `null` when the envelope carries no payload and no other keys (e.g. a `delete` that returns `{}`). */
export function unwrapData<T>(body: unknown): T {
    if (body == null || typeof body !== 'object') return body as T
    const obj = body as Record<string, unknown>
    if ('data' in obj) return obj.data as T
    return Object.keys(obj).length === 0 ? (null as T) : (body as T)
}

/** Unwraps a classic `{ message }` envelope, otherwise returns the body as-is. Returns `null` for an empty `{}` envelope. */
export function unwrapMessage<T>(body: unknown): T {
    if (body != null && typeof body === 'object') {
        const obj = body as Record<string, unknown>
        if ('message' in obj) return obj.message as T
        if (Object.keys(obj).length === 0) return null as T
    }
    return body as T
}

/** Chooses `unwrapData` (v2 `{data}`) or `unwrapMessage` (v1 `{message}`) for the client's REST generation. */
export function unwrapEnvelope<T>(apiVersion: ApiVersion, body: unknown): T {
    return apiVersion === 2 ? unwrapData<T>(body) : unwrapMessage<T>(body)
}

/**
 * Executes {@link AdapterRequest}s built by an `ApiAdapter`. This is the only class domain
 * modules depend on besides the adapter itself — it owns the transport call and the unwrap
 * strategy, so modules contain nothing but Frappe domain semantics.
 */
export class Executor {
    constructor(
        private readonly transport: Transport,
        private readonly apiVersion: ApiVersion,
    ) {}

    /** Runs a request built by `ApiAdapter`, applying the `unwrap` strategy it specified. */
    run<T>(req: AdapterRequest, options?: RequestOptions): Promise<T> {
        return this.call<T>(
            { method: req.method, url: req.url, params: req.params, data: req.data },
            req.unwrap,
            options,
        )
    }

    /**
     * Issues a raw request through this executor with an explicit unwrap strategy. Used by
     * `call.get/post/put/delete` (arbitrary method paths that don't go through the adapter) and
     * by `file` (which needs `responseType`/`onUploadProgress`, not exposed on `AdapterRequest`).
     */
    async call<T>(config: RequestConfig, unwrap: Unwrap, options?: RequestOptions): Promise<T> {
        const res = await this.transport.request<unknown>({
            method: config.method,
            url: config.url,
            params: config.params,
            data: config.data,
            responseType: config.responseType,
            onUploadProgress: config.onUploadProgress,
            headers: options?.headers,
            signal: options?.signal,
            timeout: options?.timeout,
            deadline: options?.deadline,
            requestId: options?.requestId,
        })
        return this.applyUnwrap<T>(unwrap, res.data)
    }

    private applyUnwrap<T>(unwrap: Unwrap, body: unknown): T {
        switch (unwrap) {
            case 'envelope':
                return unwrapEnvelope<T>(this.apiVersion, body)
            case 'message':
                return unwrapMessage<T>(body)
            case 'data':
                return unwrapData<T>(body)
            case 'none':
                return body as T
        }
    }
}
