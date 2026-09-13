/** Shared request policy for every transport. A transport performs one prepared HTTP attempt. */
import type { FrappeClientConfig } from './config'
import { FrappeError, type FrappeRequestContext, isHttpOk, mapNetworkError, mapServerError } from './errors'
import { raceOperation } from './lifecycle'
import { emitLog, requestLogPath } from './logger'
import { composeMiddleware, type FrappeResponse, type NextFn } from './middleware'
import type { ResponseType,Transport, TransportResponse, UploadProgressEvent } from './transport'
import { buildUrl, toSearchParams } from './url'

export interface PipelineRequest {
    method: string
    url: string
    params?: Record<string, unknown>
    data?: unknown
    headers?: Record<string, string>
    responseType?: ResponseType
    onUploadProgress?: (event: UploadProgressEvent) => void
    signal?: AbortSignal
    timeout?: number
    deadline?: number
    requestId?: string
}

function requestId(): string {
    return typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

function isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof document !== 'undefined'
}

function mergeHeaders(...sources: Array<Readonly<Record<string, string>> | undefined>): Record<string, string> {
    const result: Record<string, string> = {}
    for (const source of sources) {
        for (const [name, value] of Object.entries(source ?? {})) {
            const old = Object.keys(result).find((key) => key.toLowerCase() === name.toLowerCase())
            if (old) delete result[old]
            result[name] = value
        }
    }
    return result
}

function abortSignals(signals: AbortSignal[]): { signal: AbortSignal; cleanup: () => void } {
    const controller = new AbortController()
    const removers: Array<() => void> = []
    for (const signal of signals) {
        if (signal.aborted) {
            controller.abort(signal.reason)
            break
        }
        const abort = () => controller.abort(signal.reason)
        signal.addEventListener('abort', abort, { once: true })
        removers.push(() => signal.removeEventListener('abort', abort))
    }
    return { signal: controller.signal, cleanup: () => removers.forEach((remove) => remove()) }
}

function responseText(response: TransportResponse<unknown>): string | undefined {
    if (response.responseText !== undefined) return response.responseText
    if (typeof response.data === 'string') return response.data
    try {
        return JSON.stringify(response.data)
    } catch {
        return undefined
    }
}

type DeferredResponse = TransportResponse<unknown> & {
    readBody?: () => Promise<{ data: unknown; responseText?: string }>
    release?: () => void
}

export class RequestPipeline {
    constructor(
        private readonly config: FrappeClientConfig,
        private readonly transport: Transport,
    ) {}

    async request<T>(req: PipelineRequest): Promise<TransportResponse<T>> {
        const started = performance.now()
        const id = req.requestId ?? requestId()
        const url = this.buildRequestUrl(req)
        const context: FrappeRequestContext = { method: req.method, url, requestId: id }
        const timeoutMs = req.timeout ?? this.config.timeout
        const deadlineController = new AbortController()
        const deadlineTimer =
            req.deadline === undefined
                ? undefined
                : setTimeout(() => deadlineController.abort(), Math.max(0, req.deadline - Date.now()))
        const deadlineSignal = req.deadline === undefined ? undefined : deadlineController.signal
        const controls = { signal: req.signal, deadlineSignal, request: context }
        let status: number | undefined
        let failure: unknown
        try {
            // Keep asynchronous authentication, middleware and retries inside the operation budget.
            return await raceOperation(async () => {
                const headers = mergeHeaders({ Accept: 'application/json' }, this.config.headers, req.headers)
                const form = typeof FormData !== 'undefined' && req.data instanceof FormData
                if (
                    req.data !== undefined &&
                    !form &&
                    !Object.keys(headers).some((name) => name.toLowerCase() === 'content-type')
                ) {
                    headers['Content-Type'] = 'application/json; charset=utf-8'
                }
                if (this.config.siteName) {
                    if (!isBrowser()) headers.Host = this.config.siteName
                    headers['X-Frappe-Site-Name'] = this.config.siteName
                } else if (isBrowser()) {
                    headers['X-Frappe-Site-Name'] ??= window.location.hostname
                }
                const body = form
                    ? (req.data as FormData)
                    : req.data === undefined
                      ? undefined
                      : JSON.stringify(req.data)
                if (form) {
                    const contentType = Object.keys(headers).find((name) => name.toLowerCase() === 'content-type')
                    if (contentType) delete headers[contentType]
                }
                const credentials =
                    this.config.credentials ??
                    (this.config.auth.name === 'cookie' && isBrowser() ? 'include' : 'same-origin')

                const authTimeout = new AbortController()
                const authTimer = setTimeout(() => authTimeout.abort(), timeoutMs)
                try {
                    await raceOperation(() => this.config.auth.apply(headers, { method: req.method, url }), {
                        ...controls,
                        timeoutSignal: authTimeout.signal,
                    })
                } finally {
                    clearTimeout(authTimer)
                }

                let authReplayUsed = false
                const attempt: NextFn = async (mwReq) => {
                    const attemptTimeout = new AbortController()
                    const timeoutTimer = setTimeout(() => attemptTimeout.abort(), timeoutMs)
                    const combined = abortSignals(
                        [mwReq.signal, req.signal, attemptTimeout.signal, deadlineSignal].filter(
                            Boolean,
                        ) as AbortSignal[],
                    )
                    const attemptControls = {
                        ...controls,
                        signal: mwReq.signal ?? req.signal,
                        timeoutSignal: attemptTimeout.signal,
                    }
                    const send = async (): Promise<TransportResponse<unknown>> => {
                        const sent = await raceOperation(
                            () =>
                                this.transport.request<unknown>({
                                    method: mwReq.method,
                                    url: mwReq.url,
                                    headers: mwReq.headers,
                                    body: mwReq.body as BodyInit | undefined,
                                    credentials,
                                    responseType: req.responseType,
                                    onUploadProgress: req.onUploadProgress,
                                    signal: combined.signal,
                                }),
                            attemptControls,
                        ).catch((error) => {
                            if (error instanceof FrappeError) throw error
                            throw mapNetworkError(error, context, timeoutMs, attemptTimeout.signal)
                        })
                        await raceOperation(
                            () => this.config.auth.onResponse?.(sent.headers, { method: req.method, url }),
                            attemptControls,
                        )
                        return sent
                    }
                    try {
                        let response: DeferredResponse = await send()
                        if (response.status === 401 && !authReplayUsed) {
                            authReplayUsed = true
                            const refresh = await raceOperation(
                                () => this.config.auth.onUnauthorized?.(),
                                attemptControls,
                            )
                            if (refresh) {
                                response.release?.()
                                await raceOperation(
                                    () => this.config.auth.apply(mwReq.headers, { method: req.method, url }),
                                    attemptControls,
                                )
                                response = await send()
                            }
                        }
                        if (response.readBody) {
                            const parsed = await raceOperation(() => response.readBody!(), attemptControls)
                            response = { ...response, ...parsed }
                        }
                        if (!isHttpOk(response.status)) {
                            throw mapServerError(response, response.data, responseText(response), context)
                        }
                        return {
                            status: response.status,
                            statusText: response.statusText,
                            headers: response.headers,
                            body: response.data,
                            responseText: response.responseText,
                        }
                    } finally {
                        clearTimeout(timeoutTimer)
                        combined.cleanup()
                    }
                }
                const middleware = composeMiddleware(this.config.middleware, attempt)
                const result: FrappeResponse = await raceOperation(
                    () =>
                        middleware({
                            method: req.method,
                            url,
                            headers,
                            body,
                            signal: req.signal,
                            deadline: req.deadline,
                            requestId: id,
                        }),
                    controls,
                )
                if (!isHttpOk(result.status)) throw mapServerError(result, result.body, result.responseText, context)
                status = result.status
                return {
                    data: result.body as T,
                    status: result.status,
                    statusText: result.statusText,
                    headers: result.headers,
                }
            }, controls)
        } catch (error) {
            failure = error
            throw error
        } finally {
            clearTimeout(deadlineTimer)
            emitLog(this.config.logger, {
                method: req.method,
                path: requestLogPath(url),
                durationMs: performance.now() - started,
                requestId: id,
                status: failure instanceof FrappeError ? failure.status : status,
                ...(failure === undefined ? {} : { error: failure instanceof Error ? failure.name : 'UnknownError' }),
            })
        }
    }

    private buildRequestUrl(req: PipelineRequest): string {
        const resolved = buildUrl(this.config.baseUrl, req.url)
        const search = req.params ? toSearchParams(req.params).toString() : ''
        return search ? `${resolved}${resolved.includes('?') ? '&' : '?'}${search}` : resolved
    }
}
