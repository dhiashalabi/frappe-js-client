/**
 * @module core/fetch
 * @description The default transport implementation: `globalThis.fetch` (or an injected
 * `config.fetch`). Owns URL construction (via `core/url`), auth header application, the
 * middleware pipeline, request cancellation, timeouts, and error mapping. Nothing else in the
 * package is allowed to call `fetch` directly.
 */

import type { FrappeClientConfig } from './config'
import {
    ConfigurationError,
    FrappeError,
    type FrappeRequestContext,
    isHttpOk,
    mapNetworkError,
    mapServerError,
    TimeoutError,
} from './errors'
import { emitLog, type FrappeLogEvent, requestLogPath } from './logger'
import { composeMiddleware, type FrappeRequest as MwRequest, type FrappeResponse as MwResponse } from './middleware'
import type { Transport, TransportRequest, TransportResponse } from './transport'
import { buildUrl, toSearchParams } from './url'
import { requestViaXhr } from './xhr-upload'

export type { ResponseType, Transport, TransportRequest, TransportResponse, UploadProgressEvent } from './transport'

function generateRequestId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID()
    }
    return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

function isBrowserEnvironment(): boolean {
    return typeof window !== 'undefined' && typeof document !== 'undefined'
}

function composeSignals(signals: AbortSignal[]): AbortSignal {
    const live = signals.filter(Boolean)
    if (live.length === 1) return live[0]
    if (typeof (AbortSignal as any).any === 'function') {
        return (AbortSignal as any).any(live)
    }
    const controller = new AbortController()
    const listeners: Array<() => void> = []
    const cleanup = () => {
        for (const off of listeners) off()
    }
    for (const s of live) {
        if (s.aborted) {
            controller.abort(s.reason)
            cleanup()
            break
        }
        const onAbort = () => {
            controller.abort(s.reason)
            cleanup()
        }
        s.addEventListener('abort', onAbort, { once: true })
        listeners.push(() => s.removeEventListener('abort', onAbort))
    }
    return controller.signal
}

function headerName(headers: Record<string, string>, name: string): string | undefined {
    const lower = name.toLowerCase()
    return Object.keys(headers).find((key) => key.toLowerCase() === lower)
}

function hasHeader(headers: Record<string, string>, name: string): boolean {
    return headerName(headers, name) !== undefined
}

function deleteHeader(headers: Record<string, string>, name: string): void {
    const key = headerName(headers, name)
    if (key) delete headers[key]
}

/** Reads a response body as text, then attempts JSON parsing. Always decodes bytes to text — never leaves an error body as an opaque Blob/ArrayBuffer (a binary error body is still Frappe's JSON error envelope). */
async function readErrorBodyAsText(res: Response): Promise<{ body: unknown; text?: string }> {
    const text = await res.text()
    if (!text) return { body: text, text }
    try {
        return { body: JSON.parse(text), text }
    } catch {
        return { body: text, text }
    }
}

async function readResponseBody(
    res: Response,
    responseType: TransportRequest['responseType'],
): Promise<{ body: unknown; text?: string }> {
    if (!res.ok) {
        // Even when the caller asked for `blob`/`arraybuffer` (file download), a non-2xx response
        // is Frappe's JSON/text error envelope, not binary payload — decode it as text so error
        // mapping sees the real message instead of an opaque Blob.
        return readErrorBodyAsText(res)
    }
    if (responseType === 'blob') {
        return { body: await res.blob() }
    }
    if (responseType === 'arraybuffer') {
        return { body: await res.arrayBuffer() }
    }
    const text = await res.text()
    if (responseType === 'text' || !text) {
        return { body: text, text }
    }
    try {
        return { body: JSON.parse(text), text }
    } catch {
        return { body: text, text }
    }
}

export interface FetchTransportOptions {
    config: FrappeClientConfig
}

/**
 * Default `Transport`. Uses `config.fetch ?? globalThis.fetch`, `AbortController`, and
 * `FormData`/`Blob`.
 */
export class FetchTransport implements Transport {
    constructor(private readonly options: FetchTransportOptions) {}

    async request<T>(req: TransportRequest): Promise<TransportResponse<T>> {
        const { config } = this.options
        const fetchImpl = config.fetch ?? globalThis.fetch
        const requestId = req.requestId ?? generateRequestId()
        const url = this.buildRequestUrl(req)
        const request: FrappeRequestContext = { method: req.method, url, requestId }
        const timeoutMs = req.timeout ?? config.timeout
        const isBrowser = isBrowserEnvironment()

        const headers: Record<string, string> = {
            Accept: 'application/json',
            ...config.headers,
            ...req.headers,
        }
        const isFormLike = typeof FormData !== 'undefined' && req.data instanceof FormData
        if (!isFormLike && req.data !== undefined && !hasHeader(headers, 'Content-Type')) {
            headers['Content-Type'] = 'application/json; charset=utf-8'
        }
        if (config.siteName) {
            // `Host` is a forbidden header name in browsers — fetch/XHR silently drop or reject
            // it there. Only set it in non-browser runtimes (Node, workers with raw socket access).
            if (!isBrowser) {
                headers.Host = config.siteName
            }
            headers['X-Frappe-Site-Name'] = config.siteName
        } else if (isBrowser) {
            headers['X-Frappe-Site-Name'] ??= window.location.hostname
        }

        await config.auth.apply(headers, { method: req.method, url })

        const credentials: RequestCredentials =
            config.credentials ?? (config.auth.name === 'cookie' && isBrowser ? 'include' : 'same-origin')

        const deadlineController = new AbortController()
        let deadlineHandle: ReturnType<typeof setTimeout> | undefined
        if (req.deadline !== undefined) {
            const remaining = req.deadline - Date.now()
            if (remaining <= 0) {
                deadlineController.abort(new DOMException('Deadline exceeded', 'TimeoutError'))
            } else {
                deadlineHandle = setTimeout(
                    () => deadlineController.abort(new DOMException('Deadline exceeded', 'TimeoutError')),
                    remaining,
                )
            }
        }

        const body = isFormLike ? (req.data as FormData) : req.data !== undefined ? JSON.stringify(req.data) : undefined
        if (isFormLike) {
            deleteHeader(headers, 'Content-Type') // let fetch set the multipart boundary
        }

        if (req.onUploadProgress && config.middleware.length > 0) {
            clearTimeout(deadlineHandle)
            throw new ConfigurationError(
                'onUploadProgress cannot be used together with middleware. Upload progress uses XHR, which cannot run the middleware pipeline. Remove middleware from this client, or omit onUploadProgress.',
            )
        }

        // Each attempt (including retries driven by middleware) gets its own timeout window, so
        // a `retry` middleware's later attempts are not starved by the first attempt's timeout.
        // `req.deadline`, in contrast, is shared across every attempt.
        const terminal = async (mwReq: MwRequest): Promise<MwResponse> => {
            const timeoutController = new AbortController()
            const timeoutHandle = setTimeout(
                () => timeoutController.abort(new DOMException('Timeout', 'TimeoutError')),
                timeoutMs,
            )
            const signal = composeSignals(
                [
                    req.signal,
                    req.deadline !== undefined ? deadlineController.signal : undefined,
                    timeoutController.signal,
                ].filter(Boolean) as AbortSignal[],
            )

            let res: Response
            req.onUploadProgress?.({ loaded: 0 })
            try {
                try {
                    res = await fetchImpl(mwReq.url, {
                        method: mwReq.method,
                        headers: mwReq.headers,
                        body: mwReq.body as BodyInit | undefined,
                        signal,
                        credentials,
                    })
                    if (res.status === 401 && (await this.refreshAuth(mwReq.headers, req, url))) {
                        res = await fetchImpl(mwReq.url, {
                            method: mwReq.method,
                            headers: mwReq.headers,
                            body: mwReq.body as BodyInit | undefined,
                            signal,
                            credentials,
                        })
                    }
                } catch (error) {
                    // Pass the timeout-specific signal (not the merged one) so a caller-provided
                    // `AbortSignal` abort is still reported as `CancelledError`, not `TimeoutError`.
                    throw mapNetworkError(error, request, timeoutMs, timeoutController.signal)
                }
                req.onUploadProgress?.({ loaded: 1, total: 1 })

                await config.auth.onResponse?.(res.headers, { method: req.method, url })

                let parsed: unknown
                let text: string | undefined
                try {
                    ;({ body: parsed, text } = await readResponseBody(res, req.responseType ?? 'json'))
                } catch (error) {
                    throw mapNetworkError(error, request, timeoutMs, timeoutController.signal)
                }

                if (timeoutController.signal.aborted) {
                    throw new TimeoutError({ status: 0, message: `Request timed out after ${timeoutMs}ms`, request })
                }

                if (!res.ok) {
                    throw mapServerError(res, parsed, text, request)
                }

                return {
                    status: res.status,
                    statusText: res.statusText,
                    headers: res.headers,
                    body: parsed,
                    responseText: text,
                }
            } finally {
                clearTimeout(timeoutHandle)
            }
        }

        const pipeline = composeMiddleware(config.middleware, terminal)

        // `fetch` has no cross-runtime upload-progress event. When a caller asks for progress
        // and XHR is available (browsers), use XHR for this one request; otherwise progress is
        // reported best-effort (0% then 100%) around a normal fetch. This never affects
        // non-upload requests.
        if (req.onUploadProgress && typeof XMLHttpRequest !== 'undefined') {
            clearTimeout(deadlineHandle)
            const xhrStart = performance.now()
            return requestViaXhr<T>({
                req,
                url,
                headers,
                body,
                requestId,
                timeoutMs,
                isBrowser,
                credentials,
                onResponse: (h) => config.auth.onResponse?.(h, { method: req.method, url }),
                refreshAuth: (nextHeaders) => this.refreshAuth(nextHeaders, req, url),
                log: (outcome) => this.logRequest(req.method, url, requestId, xhrStart, outcome),
            })
        }

        const start = performance.now()
        try {
            const res = await pipeline({ method: req.method, url, headers, body, signal: req.signal, requestId })
            if (!isHttpOk(res.status)) {
                throw mapServerError(
                    { status: res.status, statusText: res.statusText },
                    res.body,
                    res.responseText,
                    request,
                )
            }
            this.logRequest(req.method, url, requestId, start, { status: res.status })
            return { data: res.body as T, status: res.status, statusText: res.statusText, headers: res.headers }
        } catch (error) {
            this.logRequest(req.method, url, requestId, start, { error })
            throw error
        } finally {
            clearTimeout(deadlineHandle)
        }
    }

    private logRequest(
        method: string,
        url: string,
        requestId: string,
        startedAt: number,
        outcome: { status?: number; error?: unknown },
    ): void {
        const event: FrappeLogEvent = {
            method,
            path: requestLogPath(url),
            durationMs: performance.now() - startedAt,
            requestId,
        }
        if (outcome.error !== undefined) {
            event.error = outcome.error instanceof Error ? outcome.error.name : 'UnknownError'
            if (outcome.error instanceof FrappeError) {
                event.status = outcome.error.status
            }
        } else {
            event.status = outcome.status
        }
        emitLog(this.options.config.logger, event)
    }

    private async refreshAuth(headers: Record<string, string>, req: TransportRequest, url: string): Promise<boolean> {
        const shouldRetry = await this.options.config.auth.onUnauthorized?.()
        if (!shouldRetry) return false
        await this.options.config.auth.apply(headers, { method: req.method, url })
        return true
    }

    private buildRequestUrl(req: TransportRequest): string {
        const resolved = buildUrl(this.options.config.baseUrl, req.url)
        if (!req.params) {
            return resolved
        }
        const search = toSearchParams(req.params as Record<string, unknown>).toString()
        if (!search) {
            return resolved
        }
        return `${resolved}${resolved.includes('?') ? '&' : '?'}${search}`
    }
}
