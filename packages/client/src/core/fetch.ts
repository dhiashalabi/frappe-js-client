/** Fetch performs one prepared HTTP attempt. Upload progress uses XHR when available. */
import type { Transport, TransportRequest, TransportResponse } from './transport'
import { requestViaXhr } from './xhr-upload'

export type { ResponseType, Transport, TransportRequest, TransportResponse, UploadProgressEvent } from './transport'

function decodeText(text: string, responseType?: TransportRequest['responseType']): unknown {
    if (responseType === 'text' || !text) return text
    try {
        return JSON.parse(text)
    } catch {
        return text
    }
}

export class FetchTransport implements Transport {
    constructor(private readonly fetchImpl?: typeof globalThis.fetch) {}

    async request<T>(req: TransportRequest): Promise<TransportResponse<T>> {
        if (req.onUploadProgress && typeof XMLHttpRequest !== 'undefined') {
            return requestViaXhr<T>(req)
        }
        req.onUploadProgress?.({ loaded: 0 })
        const res = await (this.fetchImpl ?? globalThis.fetch)(req.url, {
            method: req.method,
            headers: req.headers,
            body: req.body,
            signal: req.signal,
            credentials: req.credentials,
        })
        if (res.status === 401) {
            return {
                data: undefined as T,
                status: res.status,
                statusText: res.statusText,
                headers: res.headers,
                readBody: async () => {
                    const responseText = await res.text()
                    return { data: decodeText(responseText, 'json') as T, responseText }
                },
                release: () => {
                    void res.body?.cancel().catch(() => undefined)
                },
            } as TransportResponse<T>
        }
        let data: unknown
        let responseText: string | undefined
        if (res.ok && req.responseType === 'blob') {
            data = await res.blob()
        } else if (res.ok && req.responseType === 'arraybuffer') {
            data = await res.arrayBuffer()
        } else {
            responseText = await res.text()
            // HTTP failures always decode as text/JSON, including binary download failures.
            data = decodeText(responseText, res.ok ? req.responseType : 'json')
        }
        req.onUploadProgress?.({ loaded: 1, total: 1 })
        return { data: data as T, status: res.status, statusText: res.statusText, headers: res.headers, responseText }
    }
}
