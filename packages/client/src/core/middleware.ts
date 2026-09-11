/**
 * @module core/middleware
 * @description Opt-in middleware: retry, timing, and redaction helpers. Nothing runs unless the
 * caller passes it to `createFrappeClient({ middleware })` or `withMiddleware`.
 */

import { CancelledError, FrappeError, TimeoutError, TransportError } from './errors'
import { requestLogPath } from './logger'

export interface FrappeRequest {
    method: string
    url: string
    headers: Record<string, string>
    body?: unknown
    signal?: AbortSignal
    requestId: string
}

export interface FrappeResponse {
    status: number
    statusText: string
    headers: Headers
    body: unknown
    responseText?: string
}

export type NextFn = (req: FrappeRequest) => Promise<FrappeResponse>

/**
 * @stable
 */
export type Middleware = (req: FrappeRequest, next: NextFn) => Promise<FrappeResponse>

/** Composes middleware so the first entry is the outermost wrapper (runs first, sees the response last). */
export function composeMiddleware(middleware: readonly Middleware[], terminal: NextFn): NextFn {
    return middleware.reduceRight<NextFn>((next, mw) => (req) => mw(req, next), terminal)
}

const IDEMPOTENT_METHODS = new Set(['GET', 'HEAD', 'PUT', 'DELETE'])

export interface RetryOptions {
    /** Default 2. */
    attempts?: number
    /** Default 250ms, doubling each attempt. */
    baseDelayMs?: number
    /**
     * Which methods may be retried. Defaults to idempotent verbs only (GET/HEAD/PUT/DELETE).
     * POST/PATCH are never retried by default because a lost response does not mean the
     * mutation didn't apply on the server.
     */
    methods?: readonly string[]
    /** Return `true` to retry this particular failure. Defaults to network / 429 / 5xx only. */
    shouldRetry?: (res: FrappeResponse | undefined, error: unknown) => boolean
}

function isRetryableStatus(status: number): boolean {
    return status === 0 || status === 429 || status >= 500
}

function defaultShouldRetry(res: FrappeResponse | undefined, error: unknown): boolean {
    if (error instanceof CancelledError || error instanceof TimeoutError) {
        return false
    }
    if (error instanceof TransportError) {
        return isRetryableStatus(error.status)
    }
    if (error instanceof FrappeError) {
        return isRetryableStatus(error.status)
    }
    if (error) {
        return false
    }
    return Boolean(res && isRetryableStatus(res.status))
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
    if (!ms) return Promise.resolve()
    return new Promise((resolve, reject) => {
        if (signal?.aborted) {
            reject(new CancelledError({ status: 0, message: 'Request was cancelled' }))
            return
        }
        const timer = setTimeout(resolve, ms)
        const onAbort = () => {
            clearTimeout(timer)
            reject(new CancelledError({ status: 0, message: 'Request was cancelled' }))
        }
        signal?.addEventListener('abort', onAbort, { once: true })
    })
}

/**
 * Opt-in retry middleware. Off by default. Does not retry 4xx, cancel, or timeout unless
 * `shouldRetry` says otherwise.
 *
 * @stable
 */
export function retry(options: RetryOptions = {}): Middleware {
    const attempts = options.attempts ?? 2
    const baseDelayMs = options.baseDelayMs ?? 250
    const methods = new Set(options.methods ?? IDEMPOTENT_METHODS)
    const shouldRetry = options.shouldRetry ?? defaultShouldRetry

    return async (req, next) => {
        if (!methods.has(req.method.toUpperCase())) {
            return next(req)
        }
        for (let attempt = 0; ; attempt++) {
            try {
                const res = await next(req)
                if (attempt === attempts || !shouldRetry(res, undefined)) {
                    return res
                }
            } catch (error) {
                if (attempt === attempts || !shouldRetry(undefined, error)) {
                    throw error
                }
            }
            await delay(baseDelayMs * 2 ** attempt, req.signal)
        }
    }
}

export interface TimingOptions {
    onTiming: (info: { method: string; path: string; durationMs: number; status?: number }) => void
}

/** Reports request duration. Pathname only — no query strings, bodies, or headers. */
export function timing(options: TimingOptions): Middleware {
    return async (req, next) => {
        const start = performance.now()
        const path = requestLogPath(req.url)
        try {
            const res = await next(req)
            options.onTiming({ method: req.method, path, durationMs: performance.now() - start, status: res.status })
            return res
        } catch (error) {
            options.onTiming({ method: req.method, path, durationMs: performance.now() - start })
            throw error
        }
    }
}

const REDACTED_HEADERS = new Set(['authorization', 'cookie', 'x-frappe-csrf-token', 'set-cookie'])
const REDACTED_BODY_KEYS = new Set(['api_secret', 'pwd', 'password', 'secret'])

/** Redacts a headers object for logging. Never mutates the original. */
export function redactHeaders(headers: Record<string, string>): Record<string, string> {
    const out: Record<string, string> = {}
    for (const [key, value] of Object.entries(headers)) {
        out[key] = REDACTED_HEADERS.has(key.toLowerCase()) ? '[redacted]' : value
    }
    return out
}

/** Redacts known-sensitive keys from a request/response body for logging. */
export function redactBody(body: unknown): unknown {
    if (body == null || typeof body !== 'object') {
        return body
    }
    const out: Record<string, unknown> = Array.isArray(body) ? ([...(body as unknown[])] as any) : { ...body }
    for (const key of Object.keys(out)) {
        if (REDACTED_BODY_KEYS.has(key.toLowerCase())) {
            out[key] = '[redacted]'
        }
    }
    return out
}
