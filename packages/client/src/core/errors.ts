/**
 * @module core/errors
 * @description The frappe-js-client error taxonomy. `FrappeError` is the stable base class —
 * `instanceof FrappeError` always catches every failure this client throws. Subclasses narrow
 * the failure so callers can branch without inspecting `status` codes by hand.
 *
 * Maps both REST envelopes: v1 (`exc_type` / `exception` / `exc` / `_server_messages`) and v2
 * (`{ errors: [{ type, exception?, message?, title?, indicator? }] }`, no top-level `exc_type`).
 */

/** A single Frappe server message (from `_server_messages`). */
export interface ServerMessage {
    message: string
    title?: string
    indicator?: string
    raise_exception?: number
    __frappe_exc_id?: string
}

/** One entry of a v2 `{ errors: [...] }` envelope. */
export interface FrappeV2ErrorEntry {
    type?: string
    exception?: string
    message?: string
    title?: string
    indicator?: string
}

/**
 * Safe, non-secret context about the request that failed. Never headers or body.
 *
 * Distinct from {@link FrappeRequest} (middleware) and {@link FrappeRequestInfo} (auth).
 */
export interface FrappeRequestContext {
    method: string
    url: string
    requestId?: string
}

export interface FrappeErrorInit {
    message: string
    /** HTTP status. `0` when there is no HTTP response (DNS/socket/timeout/cancel). */
    status: number
    statusText?: string
    /** Frappe's `exc_type` / exception class name, when available (v1 `exc_type`, v2 `errors[0].type`). */
    frappeExceptionType?: string
    /** Raw `exc` traceback string from the server, when available. */
    exc?: string
    serverMessages?: ServerMessage[]
    /** v2 `errors[]` envelope entries, when the server used the v2 error shape. */
    errors?: FrappeV2ErrorEntry[]
    /** Raw response body text. ALWAYS preserved, even when JSON parsing fails. */
    responseText?: string
    request?: FrappeRequestContext
    /** Parsed `Retry-After` delay. Response headers themselves are never exposed. */
    retryAfterMs?: number
    /** The original underlying failure (a `TypeError` from fetch, a `DOMException` abort, etc). */
    cause?: unknown
    /** Extra server-provided fields that don't map onto a named field above. Never overwrites a named field. */
    extra?: Record<string, unknown>
}

function stripUrlQuery(url: string): string {
    try {
        const parsed = new URL(url)
        parsed.search = ''
        parsed.hash = ''
        return parsed.href
    } catch {
        return url.replace(/[?#].*$/, '')
    }
}

function safeRequestContext(request: FrappeRequestContext | undefined): FrappeRequestContext | undefined {
    return request ? { ...request, url: stripUrlQuery(request.url) } : undefined
}

/**
 * Base class for every error this client throws.
 *
 * Deliberately has no index signature: `error.stauts` (a typo) is a compile error, not silent
 * `undefined`. Unrecognized server fields live under `extra`, which can never overwrite a named
 * field on this class.
 *
 * @stable
 */
export class FrappeError extends Error {
    readonly status: number
    readonly statusText: string
    readonly frappeExceptionType?: string
    readonly exc?: string
    readonly serverMessages: ServerMessage[]
    readonly errors?: FrappeV2ErrorEntry[]
    readonly responseText?: string
    readonly request?: FrappeRequestContext
    readonly retryAfterMs?: number
    /** Extra server-provided fields, never shadowing a named field on this class. */
    readonly extra: Readonly<Record<string, unknown>>

    constructor(init: FrappeErrorInit) {
        super(init.message, init.cause !== undefined ? { cause: init.cause } : undefined)
        this.name = new.target.name
        this.status = init.status
        this.statusText = init.statusText ?? ''
        this.frappeExceptionType = init.frappeExceptionType
        this.exc = init.exc
        this.serverMessages = init.serverMessages ?? []
        this.errors = init.errors
        this.responseText = init.responseText
        this.request = safeRequestContext(init.request)
        this.retryAfterMs = init.retryAfterMs
        this.extra = Object.freeze({ ...init.extra })

        Object.setPrototypeOf(this, new.target.prototype)
    }
}

/** Invalid client configuration (bad URL, missing required option, unsupported combination). */
export class ConfigurationError extends FrappeError {
    constructor(message: string, extra?: Partial<FrappeErrorInit>) {
        super({ status: 0, ...extra, message })
    }
}

/** A v2-only operation was called on a client configured with `apiVersion: 1`, or a feature requires a newer Frappe release than `frappeVersion` (or the conservative default) allows. */
export class FeatureNotSupportedError extends ConfigurationError {
    constructor(feature: string, reason: string) {
        super(`${feature} ${reason}`)
    }
}

/** No HTTP response was received: DNS failure, connection refused, TLS error, network down. */
export class TransportError extends FrappeError {}

/** A successful HTTP response did not match the endpoint's documented wire shape. */
export class ResponseError extends FrappeError {
    constructor(message: string, extra?: Partial<FrappeErrorInit>) {
        super({ status: 0, ...extra, message })
    }
}

/** The request exceeded its timeout before a response was received. */
export class TimeoutError extends TransportError {}

/** The request was aborted via `AbortSignal` before it completed. */
export class CancelledError extends TransportError {}

/** An HTTP response was received, but it indicated failure. */
export class ServerError extends FrappeError {}

/** HTTP 401, or `exc_type` of `AuthenticationError` — the session or token was not accepted. */
export class AuthenticationError extends ServerError {}

/** HTTP 403, or `exc_type` of `PermissionError` — Frappe denied the operation server-side. */
export class PermissionError extends ServerError {}

/** HTTP 404, or `exc_type` of `DoesNotExistError` — the resource does not exist. */
export class NotFoundError extends ServerError {}

/** HTTP 417, or `exc_type` of `ValidationError` / `MandatoryError` / `LinkValidationError` / `UniqueValidationError` / `InvalidNameError`. */
export class ValidationError extends ServerError {}

/** HTTP 409, or `exc_type` of `DuplicateEntryError`. */
export class DuplicateEntryError extends ServerError {}

/** HTTP 429, or `exc_type` of `TooManyRequestsError` — the site's rate limiter rejected the request. */
export class RateLimitError extends ServerError {}

/** `exc_type` of `CSRFTokenError` (HTTP 400) — the CSRF token was missing, stale, or invalid. */
export class CsrfError extends ServerError {}

const EXC_TYPE_TO_ERROR: Record<string, typeof ServerError> = {
    ValidationError,
    MandatoryError: ValidationError,
    LinkValidationError: ValidationError,
    UniqueValidationError: ValidationError,
    InvalidNameError: ValidationError,
    PermissionError,
    DoesNotExistError: NotFoundError,
    AuthenticationError,
    DuplicateEntryError,
    TooManyRequestsError: RateLimitError,
    CSRFTokenError: CsrfError,
}

/** Maps an HTTP status + Frappe exception type to the most specific `ServerError` subclass. `exc_type` (when recognized) wins over status. */
export function serverErrorFor(status: number, frappeExceptionType?: string): typeof ServerError {
    if (frappeExceptionType && Object.hasOwn(EXC_TYPE_TO_ERROR, frappeExceptionType)) {
        return EXC_TYPE_TO_ERROR[frappeExceptionType]
    }
    switch (status) {
        case 401:
            return AuthenticationError
        case 403:
            return PermissionError
        case 404:
            return NotFoundError
        case 409:
            return DuplicateEntryError
        case 417:
            return ValidationError
        case 429:
            return RateLimitError
        default:
            return ServerError
    }
}

export function isHttpOk(status: number): boolean {
    return status >= 200 && status < 300
}

/** Parses Frappe `_server_messages` (JSON string, JSON-string array, or already-parsed array). */
export function parseServerMessages(raw: unknown): ServerMessage[] {
    if (!raw) return []
    let items: unknown[]
    if (Array.isArray(raw)) {
        items = raw
    } else if (typeof raw === 'string') {
        try {
            const parsed = JSON.parse(raw)
            items = Array.isArray(parsed) ? parsed : []
        } catch {
            return []
        }
    } else {
        return []
    }
    return items
        .map((item) => {
            if (typeof item === 'string') {
                try {
                    return JSON.parse(item) as ServerMessage
                } catch {
                    return null
                }
            }
            return item && typeof item === 'object' ? (item as ServerMessage) : null
        })
        .filter((item): item is ServerMessage => item != null)
}

/** Last non-empty line of a traceback-shaped string (Python tracebacks end with the exception message). */
function lastLine(value?: string): string | undefined {
    if (!value) return undefined
    const lines = value
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
    return lines.length ? lines[lines.length - 1] : undefined
}

export interface HttpErrorSource {
    status: number
    statusText: string
    headers?: Pick<Headers, 'get'>
}

function parseRetryAfter(value: string | null | undefined): number | undefined {
    if (!value) return undefined
    const seconds = Number(value)
    if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000
    const timestamp = Date.parse(value)
    if (Number.isNaN(timestamp)) return undefined
    return Math.max(0, timestamp - Date.now())
}

/** Maps a parsed HTTP error body (v1 or v2 envelope) to the matching `ServerError` subclass. */
export function mapServerError(
    res: HttpErrorSource,
    parsed: unknown,
    text: string | undefined,
    request: FrappeRequestContext,
): FrappeError {
    const data = parsed && typeof parsed === 'object' ? (parsed as Record<string, any>) : {}
    const v2Errors: FrappeV2ErrorEntry[] | undefined = Array.isArray(data.errors) ? data.errors : undefined
    const primaryV2 = v2Errors?.[0]

    const frappeExceptionType: string | undefined = data.exc_type ?? primaryV2?.type
    const exc: string | undefined = data.exc ?? primaryV2?.exception
    const serverMessages = parseServerMessages(data._server_messages)

    const ErrorClass = serverErrorFor(res.status, frappeExceptionType)

    let defaultMessage = `Request failed with status ${res.status}`
    if (text && text.trim().toLowerCase().startsWith('<html')) {
        const titleMatch = text.match(/<title[^>]*>([^<]+)<\/title>/i)
        if (titleMatch && titleMatch[1]) {
            defaultMessage = titleMatch[1].trim()
        }
    }

    const message =
        data.message ??
        primaryV2?.message ??
        serverMessages[0]?.message ??
        lastLine(data.exception) ??
        lastLine(primaryV2?.exception) ??
        defaultMessage

    const extra = { ...data }
    delete extra.message
    delete extra.exception
    delete extra.exc
    delete extra.exc_type
    delete extra.errors
    delete extra._server_messages

    return new ErrorClass({
        status: res.status,
        statusText: res.statusText,
        message,
        frappeExceptionType,
        exc,
        serverMessages,
        errors: v2Errors,
        responseText: text,
        request,
        retryAfterMs: parseRetryAfter(res.headers?.get('retry-after')),
        extra,
    })
}

/** Maps a thrown network/abort failure (no useful HTTP body) onto the transport error taxonomy. */
export function mapNetworkError(
    error: unknown,
    request: FrappeRequestContext,
    timeoutMs: number,
    timeoutSignal?: AbortSignal,
): FrappeError {
    if (error instanceof DOMException) {
        const timedOut =
            error.name === 'TimeoutError' || (error.name === 'AbortError' && Boolean(timeoutSignal?.aborted))
        if (timedOut) {
            return new TimeoutError({
                status: 0,
                message: `Request timed out after ${timeoutMs}ms`,
                request,
                cause: error,
            })
        }
        if (error.name === 'AbortError') {
            return new CancelledError({ status: 0, message: 'Request was cancelled', request, cause: error })
        }
    }
    const message = error instanceof Error ? error.message : 'Network request failed'
    return new TransportError({ status: 0, message, request, cause: error })
}
