/** In-memory transport for deterministic client tests. All policy runs in RequestPipeline. */
import type { Transport, TransportRequest, TransportResponse } from '../core/transport'

export interface MemoryRoute {
    method: string
    /** Exact pathname or regular expression tested against the decoded pathname. */
    path: string | RegExp
    status?: number
    statusText?: string
    headers?: Record<string, string>
    body?: unknown
    once?: boolean
    match?: (req: TransportRequest) => boolean
}

/** @stable */
export class MemoryTransport implements Transport {
    private routes: MemoryRoute[] = []
    readonly requests: TransportRequest[] = []

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
        if (req.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
        const path = decodeURIComponent(new URL(req.url).pathname)
        const index = this.routes.findIndex(
            (route) =>
                route.method.toUpperCase() === req.method.toUpperCase() &&
                (typeof route.path === 'string' ? route.path === path : route.path.test(path)) &&
                (!route.match || route.match(req)),
        )
        if (index === -1) {
            throw new Error(
                `MemoryTransport: no mocked route for ${req.method} ${path}. Call .mock({ method, path, body }) first.`,
            )
        }
        const route = this.routes[index]
        if (route.once) this.routes.splice(index, 1)
        const status = route.status ?? 200
        const headers = new Headers(route.headers)
        return {
            data: route.body as T,
            status,
            statusText:
                route.statusText ??
                (
                    {
                        200: 'OK',
                        201: 'Created',
                        400: 'Bad Request',
                        401: 'Unauthorized',
                        403: 'Forbidden',
                        404: 'Not Found',
                        409: 'Conflict',
                        417: 'Expectation Failed',
                        429: 'Too Many Requests',
                        500: 'Internal Server Error',
                    } as Record<number, string>
                )[status] ??
                '',
            headers,
            responseText: typeof route.body === 'string' ? route.body : JSON.stringify(route.body ?? {}),
        }
    }
}
