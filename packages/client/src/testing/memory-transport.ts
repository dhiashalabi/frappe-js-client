/**
 * @module testing/memory-transport
 * @description An in-memory `Transport` so consumers can test their own Frappe code without a
 * running server. Routes through the real `mapServerError`, so a mocked error is shaped
 * identically to a real HTTP failure, and through `auth.onResponse` (when an `AuthStrategy` is
 * supplied), so cookie-jar / auth-header tests exercise the real hook rather than a shortcut.
 */

import type { AuthStrategy } from '../core/auth'
import { CancelledError, mapServerError } from '../core/errors'
import type { Transport, TransportRequest, TransportResponse } from '../core/transport'

export interface MemoryRoute {
    method: string
    /** Exact path or a `RegExp` tested against the request path (query string stripped). */
    path: string | RegExp
    status?: number
    headers?: Record<string, string>
    body?: unknown
    once?: boolean
    /** Extra matcher, evaluated in addition to `method`/`path`, for routes that need to inspect params/body. */
    match?: (req: TransportRequest) => boolean
}

export interface MemoryTransportOptions {
    /** When supplied, `auth.onResponse` is invoked with each mocked response's headers, exactly as `FetchTransport` would. */
    auth?: AuthStrategy
}

/**
 * A `Transport` backed by an in-memory route table instead of the network. Register routes with
 * `mock()`, then use `createTestClient()` from `frappe-js-client/testing`, which wires this up.
 *
 * @stable
 */
export class MemoryTransport implements Transport {
    private routes: MemoryRoute[] = []
    readonly requests: TransportRequest[] = []

    constructor(private readonly options: MemoryTransportOptions = {}) {}

    mock(route: MemoryRoute): this {
        this.routes.push(route)
        return this
    }

    reset(): void {
        this.routes = []
        this.requests.length = 0
    }

    async request<T>(req: TransportRequest): Promise<TransportResponse<T>> {
        this.requests.push(req)
        if (req.signal?.aborted) {
            throw new CancelledError({
                status: 0,
                message: 'Request was cancelled',
                request: { method: req.method, url: req.url },
            })
        }
        const path = decodeURIComponent(req.url.split('?')[0])
        const index = this.routes.findIndex(
            (r) =>
                r.method.toUpperCase() === req.method.toUpperCase() &&
                (typeof r.path === 'string' ? r.path === path : r.path.test(path)) &&
                (!r.match || r.match(req)),
        )
        if (index === -1) {
            throw new Error(
                `MemoryTransport: no mocked route for ${req.method} ${path}. Call .mock({ method, path, body }) first.`,
            )
        }
        const route = this.routes[index]
        if (route.once) {
            this.routes.splice(index, 1)
        }
        const headers = new Headers(route.headers)
        await this.options.auth?.onResponse?.(headers, { method: req.method, url: req.url })

        const status = route.status ?? 200
        if (status >= 400) {
            const text = typeof route.body === 'string' ? route.body : JSON.stringify(route.body ?? {})
            throw mapServerError({ status, statusText: '' }, route.body, text, { method: req.method, url: req.url })
        }
        return { data: route.body as T, status, statusText: 'OK', headers }
    }
}
