/**
 * @module core/config
 * @description One normalized, frozen configuration object. Every public constructor path
 * produces this same shape; nothing downstream re-derives configuration.
 */

import type { FrappeVersion } from '../api/adapter'
import { anonymousAuth, type AuthStrategy } from './auth'
import { ConfigurationError } from './errors'
import type { FrappeLogger } from './logger'
import type { Middleware } from './middleware'
import type { Transport } from './transport'
import type { ApiVersion } from './types'

export interface FrappeClientOptions {
    /** Base URL of the Frappe site, e.g. `https://frappe.example.com`. */
    url: string
    /** `1` for classic `/api/method` + `/api/resource` (v14-safe). `2` for `/api/v2` (v15+). Default `2`. */
    apiVersion?: ApiVersion
    /**
     * Hint for release-specific behavior (`validate_link_and_fetch` availability, whether the
     * v2 REST list endpoint honors `orFilters`/`parent`). Optional — every behavior this hint
     * gates has a conservative, correct-everywhere default when omitted.
     */
    frappeVersion?: FrappeVersion
    /** Default `30_000`. Overridable per-request via `RequestOptions.timeout`, applied per attempt. */
    timeout?: number
    /** Authentication strategy. Default `anonymousAuth()`. */
    auth?: AuthStrategy
    /** Headers merged into every request, lowest precedence (per-request headers win). */
    headers?: Record<string, string>
    /**
     * Frappe site hostname when the URL host does not match the site
     * (e.g. `http://127.0.0.1:8001` with site `frappe16.localhost`). Sets `Host` (outside a
     * browser, where `Host` cannot be set) and `X-Frappe-Site-Name`.
     */
    siteName?: string
    /** Logger that never receives headers, bodies, or query strings. Off by default. */
    logger?: FrappeLogger
    /** Middleware applied to every request, in array order (first wraps outermost). */
    middleware?: Middleware[]
    /** Fetch implementation to use instead of `globalThis.fetch`. For polyfills, instrumentation, or SSR runtimes without a global `fetch`. Ignored if `transport` is set. */
    fetch?: typeof globalThis.fetch
    /** Replaces the default `FetchTransport` entirely. `testing.ts`'s `MemoryTransport` is the built-in example. */
    transport?: Transport
    /**
     * `RequestInit.credentials` for the default transport. Default: `'include'` when
     * `auth.name === 'cookie'` in a browser, otherwise `'same-origin'`.
     */
    credentials?: RequestCredentials
}

export interface FrappeClientConfig {
    readonly baseUrl: string
    readonly apiVersion: ApiVersion
    readonly frappeVersion?: FrappeVersion
    readonly timeout: number
    readonly siteName?: string
    readonly headers: Readonly<Record<string, string>>
    readonly auth: AuthStrategy
    readonly logger?: FrappeLogger
    readonly middleware: readonly Middleware[]
    readonly fetch?: typeof globalThis.fetch
    readonly transport?: Transport
    readonly credentials?: RequestCredentials
}

function assertValidUrl(url: string): string {
    if (typeof url !== 'string' || !url.trim()) {
        throw new ConfigurationError('FrappeClient requires a non-empty `url`.')
    }
    let parsed: URL
    try {
        parsed = new URL(url)
    } catch {
        throw new ConfigurationError(`FrappeClient received an invalid \`url\`: ${JSON.stringify(url)}`)
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new ConfigurationError(`FrappeClient \`url\` must be http(s), got: ${parsed.protocol}`)
    }
    // Normalize: drop trailing slash so downstream URL joins are consistent.
    return parsed.href.endsWith('/') ? parsed.href.slice(0, -1) : parsed.href
}

/** Builds the one normalized, frozen config every internal module reads from. */
export function normalizeConfig(options: FrappeClientOptions): FrappeClientConfig {
    const baseUrl = assertValidUrl(options.url)
    const apiVersion = options.apiVersion ?? 2
    if (apiVersion !== 1 && apiVersion !== 2) {
        throw new ConfigurationError(`FrappeClient \`apiVersion\` must be 1 or 2, got: ${String(apiVersion)}`)
    }
    if (options.frappeVersion !== undefined && ![14, 15, 16].includes(options.frappeVersion)) {
        throw new ConfigurationError(
            `FrappeClient \`frappeVersion\` must be 14, 15, or 16, got: ${String(options.frappeVersion)}`,
        )
    }
    const timeout = options.timeout ?? 30_000
    if (typeof timeout !== 'number' || !Number.isFinite(timeout) || timeout <= 0) {
        throw new ConfigurationError('FrappeClient `timeout` must be a finite, positive number of milliseconds.')
    }

    const config: FrappeClientConfig = {
        baseUrl,
        apiVersion,
        frappeVersion: options.frappeVersion,
        timeout,
        siteName: options.siteName,
        headers: Object.freeze({ ...options.headers }),
        auth: options.auth ?? anonymousAuth(),
        logger: options.logger,
        middleware: Object.freeze([...(options.middleware ?? [])]),
        fetch: options.fetch,
        transport: options.transport,
        credentials: options.credentials,
    }

    return Object.freeze(config)
}

/** Produces a derived, still-frozen config — used by `client.withAuth()` / `withMiddleware()` / `withHeaders()`. */
export function deriveConfig(base: FrappeClientConfig, patch: Partial<FrappeClientOptions>): FrappeClientConfig {
    return normalizeConfig({
        url: base.baseUrl,
        apiVersion: base.apiVersion,
        frappeVersion: base.frappeVersion,
        timeout: base.timeout,
        siteName: base.siteName,
        headers: { ...base.headers, ...patch.headers },
        auth: patch.auth ?? base.auth,
        logger: patch.logger ?? base.logger,
        middleware: patch.middleware ?? [...base.middleware],
        fetch: patch.fetch ?? base.fetch,
        transport: patch.transport ?? base.transport,
        credentials: patch.credentials ?? base.credentials,
    })
}
