/** Browser upload-progress transport. It performs one prepared HTTP attempt. */
import type { TransportRequest, TransportResponse } from './transport'

function headersFromXhr(xhr: XMLHttpRequest): Headers {
    const headers = new Headers()
    for (const line of (xhr.getAllResponseHeaders?.() ?? '').trim().split(/[\r\n]+/)) {
        const separator = line.indexOf(':')
        if (separator > 0) headers.append(line.slice(0, separator).trim(), line.slice(separator + 1).trim())
    }
    return headers
}

function decodeText(text: string, asText: boolean): unknown {
    if (asText || !text) return text
    try {
        return JSON.parse(text)
    } catch {
        return text
    }
}

export function requestViaXhr<T>(req: TransportRequest): Promise<TransportResponse<T>> {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        let settled = false
        const finish = (result: TransportResponse<T> | undefined, error?: unknown) => {
            if (settled) return
            settled = true
            req.signal?.removeEventListener('abort', onAbort)
            if (error !== undefined) reject(error)
            else resolve(result!)
        }
        const onAbort = () => xhr.abort()
        if (req.signal?.aborted) {
            finish(undefined, new DOMException('Aborted', 'AbortError'))
            return
        }
        req.signal?.addEventListener('abort', onAbort, { once: true })
        try {
            xhr.open(req.method, req.url, true)
            xhr.responseType =
                req.responseType === 'blob' || req.responseType === 'arraybuffer' ? req.responseType : 'text'
            xhr.withCredentials = req.credentials === 'include'
            for (const [key, value] of Object.entries(req.headers)) xhr.setRequestHeader(key, value)
            xhr.upload.onprogress = (event) =>
                req.onUploadProgress?.({
                    loaded: event.loaded,
                    total: event.lengthComputable ? event.total : undefined,
                })
            xhr.onabort = () => finish(undefined, new DOMException('Aborted', 'AbortError'))
            xhr.onerror = () => finish(undefined, new TypeError('Network request failed'))
            xhr.ontimeout = () => finish(undefined, new DOMException('Timeout', 'TimeoutError'))
            xhr.onload = () => {
                const headers = headersFromXhr(xhr)
                const binary = xhr.responseType === 'blob' || xhr.responseType === 'arraybuffer'
                const decode = async () => {
                    let responseText: string | undefined
                    let data: unknown
                    if (xhr.status >= 200 && xhr.status < 300 && binary) {
                        data = xhr.response
                    } else {
                        const raw = xhr.response
                        responseText =
                            raw instanceof Blob
                                ? await raw.text()
                                : raw instanceof ArrayBuffer
                                  ? new TextDecoder().decode(raw)
                                  : String(raw ?? '')
                        data = decodeText(
                            responseText,
                            xhr.status >= 200 && xhr.status < 300 && req.responseType === 'text',
                        )
                    }
                    finish({ data: data as T, status: xhr.status, statusText: xhr.statusText, headers, responseText })
                }
                void decode().catch((error) => finish(undefined, error))
            }
            xhr.send(req.body as XMLHttpRequestBodyInit | undefined)
        } catch (error) {
            finish(undefined, error)
        }
    })
}
