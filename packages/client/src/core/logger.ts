/**
 * @module core/logger
 * @description Opt-in debug logging. Off by default. Redaction is structural, not a filter you
 * can forget to apply: the logger only ever receives pathname, method, status, duration,
 * requestId, and optionally an error class name — never headers, bodies, or query strings.
 */

export interface FrappeLogEvent {
    method: string
    path: string
    status?: number
    durationMs: number
    requestId: string
    /** `Error.name` only (never `message`). Set when the request threw. */
    error?: string
}

/**
 * @stable
 */
export interface FrappeLogger {
    debug(event: FrappeLogEvent): void
}

/** Pathname only — query strings must never reach a logger. */
export function requestLogPath(url: string): string {
    try {
        return new URL(url).pathname
    } catch {
        const q = url.indexOf('?')
        return q === -1 ? url : url.slice(0, q)
    }
}

/** Invokes `logger.debug` without letting a broken logger fail the request. */
export function emitLog(logger: FrappeLogger | undefined, event: FrappeLogEvent): void {
    if (!logger) return
    try {
        logger.debug(event)
    } catch {
        /* ignore */
    }
}

/** A logger that writes redacted, structured lines to `console.debug`. Convenience for local development. */
export function consoleLogger(): FrappeLogger {
    return {
        debug(event) {
            const outcome = event.error ?? event.status ?? 'ERR'
            console.debug(
                `[frappe-js-client] ${event.method} ${event.path} -> ${outcome} (${event.durationMs}ms) [${event.requestId}]`,
            )
        },
    }
}
