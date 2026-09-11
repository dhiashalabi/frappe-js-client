/**
 * @module core/xhr-upload
 * @description Browser-only upload-progress path. `fetch` has no cross-runtime upload-progress
 * event, so when the caller asks for progress and no middleware is configured, this module
 * uses `XMLHttpRequest` for that one request.
 */

import {
    CancelledError,
    type FrappeRequestContext,
    isHttpOk,
    mapServerError,
    TimeoutError,
    TransportError,
} from './errors'
import type { ResponseType, TransportRequest, TransportResponse } from './transport'

export interface XhrUploadContext {
    req: TransportRequest
    url: string
    headers: Record<string, string>
    body: BodyInit | undefined
    requestId: string
    timeoutMs: number
    isBrowser: boolean
    credentials: RequestCredentials
    onResponse?: (headers: Headers) => void | Promise<void>
    refreshAuth: (headers: Record<string, string>) => Promise<boolean>
    log: (outcome: { status?: number; error?: unknown }) => void
}

/** Decodes a possibly-binary XHR response body to text, then attempts JSON parsing. Used unconditionally for error bodies — a non-2xx response is Frappe's JSON error envelope even when the caller asked for `blob`/`arraybuffer`. */
function decodeAsText(raw: unknown): { body: unknown; text?: string } {
    const text = typeof raw === 'string' ? raw : raw == null ? '' : String(raw)
    if (!text) return { body: text, text }
    try {
        return { body: JSON.parse(text), text }
    } catch {
        return { body: text, text }
    }
}

async function parseResponseBody(
    xhr: XMLHttpRequest,
    responseType: ResponseType,
    okStatus: boolean,
): Promise<{ body: unknown; text?: string }> {
    if (!okStatus) {
        // Always decode error bodies as text, even when `responseType` requested binary — a
        // non-2xx response is Frappe's JSON/text error envelope, not the requested file payload.
        const raw = xhr.response
        if (raw instanceof Blob) {
            return decodeAsText(await raw.text())
        }
        if (raw instanceof ArrayBuffer) {
            return decodeAsText(new TextDecoder().decode(raw))
        }
        return decodeAsText(raw)
    }
    if (responseType === 'blob' || responseType === 'arraybuffer') {
        return { body: xhr.response }
    }
    return decodeAsText(xhr.response)
}

function headersFromXhr(xhr: XMLHttpRequest): Headers {
    const headers = new Headers()
    const raw = xhr.getAllResponseHeaders?.() ?? ''
    for (const line of raw.trim().split(/[\r\n]+/)) {
        const idx = line.indexOf(':')
        if (idx > 0) {
            headers.append(line.slice(0, idx).trim(), line.slice(idx + 1).trim())
        }
    }
    return headers
}

function requestContext(ctx: XhrUploadContext): FrappeRequestContext {
    return { method: ctx.req.method, url: ctx.url, requestId: ctx.requestId }
}

export function requestViaXhr<T>(ctx: XhrUploadContext): Promise<TransportResponse<T>> {
    const { req, url, headers, body, requestId, timeoutMs } = ctx
    const responseType = req.responseType ?? 'json'
    return new Promise((resolve, reject) => {
        let settled = false
        const finish = (error?: unknown, value?: TransportResponse<T>) => {
            if (settled) return
            settled = true
            req.signal?.removeEventListener('abort', abortXhr)
            if (error) {
                ctx.log({ error })
                reject(error)
            } else {
                ctx.log({ status: value!.status })
                resolve(value!)
            }
        }
        const abortXhr = () => xhr.abort()
        let xhr = new XMLHttpRequest()
        let refreshed = false

        const attach = (instance: XMLHttpRequest) => {
            xhr = instance
            instance.open(req.method, url, true)
            instance.responseType = responseType === 'blob' || responseType === 'arraybuffer' ? responseType : 'text'
            instance.timeout = timeoutMs
            instance.withCredentials = ctx.credentials === 'include'
            for (const [key, value] of Object.entries(headers)) {
                instance.setRequestHeader(key, value)
            }
            instance.upload.onprogress = (event) => {
                req.onUploadProgress?.({
                    loaded: event.loaded,
                    total: event.lengthComputable ? event.total : undefined,
                })
            }
            instance.ontimeout = () =>
                finish(
                    new TimeoutError({
                        status: 0,
                        message: `Request timed out after ${timeoutMs}ms`,
                        request: requestContext(ctx),
                    }),
                )
            instance.onabort = () =>
                finish(
                    new CancelledError({ status: 0, message: 'Request was cancelled', request: requestContext(ctx) }),
                )
            instance.onerror = () =>
                finish(
                    new TransportError({ status: 0, message: 'Network request failed', request: requestContext(ctx) }),
                )
            instance.onload = () => {
                void handleXhrLoad(
                    instance,
                    ctx,
                    responseType,
                    refreshed,
                    () => {
                        refreshed = true
                        attach(new XMLHttpRequest())
                        xhr.send(body as XMLHttpRequestBodyInit | undefined)
                    },
                    finish,
                )
            }
        }

        req.signal?.addEventListener('abort', abortXhr, { once: true })
        if (req.signal?.aborted) {
            finish(
                new CancelledError({
                    status: 0,
                    message: 'Request was cancelled',
                    request: { method: req.method, url, requestId },
                }),
            )
            return
        }
        attach(xhr)
        xhr.send(body as XMLHttpRequestBodyInit | undefined)
    })
}

async function handleXhrLoad<T>(
    xhr: XMLHttpRequest,
    ctx: XhrUploadContext,
    responseType: ResponseType,
    alreadyRefreshed: boolean,
    retry: () => void,
    finish: (error?: unknown, value?: TransportResponse<T>) => void,
): Promise<void> {
    const { headers } = ctx
    const okStatus = isHttpOk(xhr.status)
    const responseHeaders = headersFromXhr(xhr)
    await ctx.onResponse?.(responseHeaders)
    const { body: parsed, text } = await parseResponseBody(xhr, responseType, okStatus)

    if (!okStatus && xhr.status === 401 && !alreadyRefreshed && (await ctx.refreshAuth(headers))) {
        retry()
        return
    }

    if (!okStatus) {
        finish(mapServerError({ status: xhr.status, statusText: xhr.statusText }, parsed, text, requestContext(ctx)))
        return
    }
    finish(undefined, { data: parsed as T, status: xhr.status, statusText: xhr.statusText, headers: responseHeaders })
}
