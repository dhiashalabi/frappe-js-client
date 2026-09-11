/**
 * @module core/transport
 * @description Shared transport types. Kept separate from `fetch.ts` so the XHR upload path
 * can import them without a circular dependency on `FetchTransport`.
 */

export type ResponseType = 'json' | 'text' | 'blob' | 'arraybuffer'

export interface UploadProgressEvent {
    loaded: number
    total?: number
}

export interface TransportRequest {
    method: string
    /** Absolute URL or a path beginning with `/`. */
    url: string
    params?: Record<string, unknown>
    data?: unknown
    headers?: Record<string, string>
    responseType?: ResponseType
    signal?: AbortSignal
    /** Per-attempt timeout, in milliseconds. */
    timeout?: number
    /** Absolute wall-clock deadline (`Date.now() + ms`), shared across every retry attempt. */
    deadline?: number
    requestId?: string
    onUploadProgress?: (event: UploadProgressEvent) => void
}

export interface TransportResponse<T> {
    data: T
    status: number
    statusText: string
    headers: Headers
}

/**
 * The transport contract. `FetchTransport` is the default; tests and callers may supply another
 * `Transport` (for example `MemoryTransport`).
 */
export interface Transport {
    request<T>(req: TransportRequest): Promise<TransportResponse<T>>
}
