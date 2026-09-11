/**
 * @module core/auth
 * @description Authentication is a strategy injected into the transport — the transport owns
 * header construction; `AuthStrategy` only decides what to put in them. `apply` is async so a
 * strategy can load or refresh a token before the request is sent.
 */

export interface FrappeRequestInfo {
    method: string
    url: string
}

/**
 * @stable
 */
export interface AuthStrategy {
    readonly name: string
    /** Mutate `headers` in place before the request is sent. */
    apply(headers: Record<string, string>, req: FrappeRequestInfo): Promise<void> | void
    /**
     * Called after every response (success or failure) with the raw response headers. This is
     * how a strategy observes `Set-Cookie` without the transport knowing anything about cookies.
     */
    onResponse?(headers: Headers, req: FrappeRequestInfo): void | Promise<void>
    /** Called on logout / explicit reset. No-op by default. */
    reset?(): void | Promise<void>
    /** Called when a request comes back 401, before the taxonomy error is thrown. Return `true` to retry once. */
    onUnauthorized?(): Promise<boolean> | boolean
}

/** No authentication headers are added. Used for public/whitelisted-guest endpoints. */
export function anonymousAuth(): AuthStrategy {
    return {
        name: 'anonymous',
        apply() {
            /* no-op */
        },
    }
}

export interface TokenAuthOptions {
    apiKey: string
    apiSecret: string
}

/** Frappe `api_key:api_secret` token authentication. Safe for server-side use only. */
export function tokenAuth(options: TokenAuthOptions): AuthStrategy {
    return {
        name: 'token',
        apply(headers) {
            headers.Authorization = `token ${options.apiKey}:${options.apiSecret}`
        },
    }
}

export interface BearerAuthOptions {
    /** Returns the current token. May be async so it can be sourced from storage or a refresh call. */
    token: () => string | Promise<string> | undefined
    /** `Bearer` (OAuth) or `token` (Frappe API key style). Defaults to `Bearer`. */
    scheme?: 'Bearer' | 'token'
}

/** Bearer/OAuth token authentication with a caller-supplied token accessor. */
export function bearerAuth(options: BearerAuthOptions): AuthStrategy {
    const scheme = options.scheme ?? 'Bearer'
    return {
        name: 'bearer',
        async apply(headers) {
            const token = await options.token()
            if (token) {
                headers.Authorization = `${scheme} ${token}`
            } else {
                delete headers.Authorization
            }
        },
    }
}

export interface OAuthAuthOptions {
    getToken: () => string | Promise<string> | undefined
    /**
     * Invoked once when a request comes back 401. Should fetch a fresh token. Omit to disable
     * refresh-on-401. The transport retries the failed request **once** after a successful
     * refresh — this is not an unlimited retry loop.
     */
    refresh?: () => Promise<string>
}

/**
 * OAuth bearer auth with an optional one-shot refresh-on-401 hook. A 401 triggers `refresh`
 * at most once per request; a second 401 is surfaced as `AuthenticationError`.
 */
export function oauthAuth(options: OAuthAuthOptions): AuthStrategy {
    let cachedToken: string | undefined
    return {
        name: 'oauth',
        async apply(headers) {
            const token = (cachedToken ??= await options.getToken())
            if (token) {
                headers.Authorization = `Bearer ${token}`
            } else {
                delete headers.Authorization
            }
        },
        async onUnauthorized() {
            if (!options.refresh) {
                return false
            }
            cachedToken = await options.refresh()
            return Boolean(cachedToken)
        },
        reset() {
            cachedToken = undefined
        },
    }
}

/**
 * Session cookies stored by `cookieAuth()` in Node.
 */
export interface CookieRecord {
    value: string
    path: string
    expiresAt?: number
    secure?: boolean
    domain?: string
    host: string
}

/** Parse one `Set-Cookie` line. Returns `null` if the line has no `name=value` pair. */
export function parseSetCookieLine(
    raw: string,
    now = Date.now(),
): {
    name: string
    value: string
    path: string
    expiresAt?: number
    delete: boolean
    secure: boolean
    domain?: string
} | null {
    const parts = raw.split(';')
    const pair = parts[0]
    const eq = pair.indexOf('=')
    if (eq <= 0) {
        return null
    }

    const name = pair.slice(0, eq).trim()
    const value = pair.slice(eq + 1).trim()
    let path = '/'
    let expiresAt: number | undefined
    let maxAge: number | undefined
    let secure = false
    let domain: string | undefined

    for (let i = 1; i < parts.length; i++) {
        const attr = parts[i].trim()
        const attrEq = attr.indexOf('=')
        const attrName = (attrEq >= 0 ? attr.slice(0, attrEq) : attr).trim().toLowerCase()
        const attrValue = attrEq >= 0 ? attr.slice(attrEq + 1).trim() : ''

        if (attrName === 'path' && attrValue) {
            path = attrValue
        } else if (attrName === 'secure') {
            secure = true
        } else if (attrName === 'domain' && attrValue) {
            domain = attrValue.replace(/^\./, '').toLowerCase()
        } else if (attrName === 'max-age') {
            const seconds = Number(attrValue)
            if (!Number.isNaN(seconds)) {
                maxAge = seconds
            }
        } else if (attrName === 'expires' && attrValue) {
            const parsed = Date.parse(attrValue)
            if (!Number.isNaN(parsed)) {
                expiresAt = parsed
            }
        }
    }

    if (maxAge !== undefined) {
        expiresAt = now + maxAge * 1000
    }

    const expired = maxAge === 0 || (expiresAt !== undefined && expiresAt <= now)
    return { name, value, path, expiresAt, delete: !value || expired, secure, domain }
}

/** Whether `host` is in-scope for a cookie `Domain` attribute (RFC 6265 suffix match). */
export function cookieDomainMatchesHost(cookieDomain: string, host: string): boolean {
    const domain = cookieDomain.replace(/^\./, '').toLowerCase()
    const hostname = host.toLowerCase()
    if (!domain || !hostname) return false
    if (hostname === domain) return true
    if (isIpAddress(hostname) || isIpAddress(domain)) return false
    if (!domain.includes('.')) return false
    return hostname.endsWith(`.${domain}`)
}

function isIpAddress(value: string): boolean {
    if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(value)) return true
    return value.includes(':')
}

export function cookieMatchesPath(cookiePath: string, requestPath: string): boolean {
    const path = cookiePath || '/'
    if (path === '/') return true
    if (!requestPath.startsWith(path)) return false
    if (requestPath.length === path.length) return true
    if (path.endsWith('/')) return true
    return requestPath.charAt(path.length) === '/'
}

/** Merge `Set-Cookie` header value(s) into `jar`. Expired or empty cookies are deleted. */
export function mergeSetCookie(
    header: string | string[] | undefined,
    jar: Map<string, CookieRecord>,
    now = Date.now(),
    host = '',
): void {
    if (!header) return
    const lines = Array.isArray(header) ? header : [header]
    for (const raw of lines) {
        const parsed = parseSetCookieLine(raw, now)
        if (!parsed) continue
        if (parsed.domain && host && !cookieDomainMatchesHost(parsed.domain, host)) continue
        if (parsed.delete) {
            jar.delete(parsed.name)
            continue
        }
        jar.set(parsed.name, {
            value: parsed.value,
            path: parsed.path,
            expiresAt: parsed.expiresAt,
            secure: parsed.secure,
            domain: parsed.domain,
            host,
        })
    }
}

export function serializeCookieJar(jar: Map<string, CookieRecord>, requestUrl?: string, now = Date.now()): string {
    let path = '/'
    let protocol: string | undefined
    let hostname: string | undefined
    if (requestUrl) {
        try {
            const parsed = new URL(requestUrl)
            protocol = parsed.protocol
            hostname = parsed.hostname
            path = parsed.pathname
        } catch {
            return ''
        }
    }

    const pairs: string[] = []
    for (const [name, record] of jar) {
        if (record.expiresAt !== undefined && record.expiresAt <= now) {
            jar.delete(name)
            continue
        }
        if (record.secure && protocol !== 'https:') continue
        if (hostname) {
            if (record.domain) {
                if (!cookieDomainMatchesHost(record.domain, hostname)) continue
            } else if (record.host && record.host !== hostname) {
                continue
            }
        }
        if (!cookieMatchesPath(record.path, path)) continue
        pairs.push(`${name}=${record.value}`)
    }
    return pairs.join('; ')
}

function isBrowserEnvironment(): boolean {
    return typeof window !== 'undefined' && typeof document !== 'undefined'
}

/** Reads every `Set-Cookie` value from a fetch `Headers` (handles the multi-value case via `getSetCookie()` where available). */
export function getSetCookieHeader(headers: Headers): string[] | undefined {
    const withGetSetCookie = headers as Headers & { getSetCookie?: () => string[] }
    if (typeof withGetSetCookie.getSetCookie === 'function') {
        const values = withGetSetCookie.getSetCookie()
        return values.length ? values : undefined
    }
    const single = headers.get('set-cookie')
    return single ? [single] : undefined
}

function resolveCSRFTokenBrowser(): string | undefined {
    const fromWindow = (window as any).csrf_token
    if (fromWindow && fromWindow !== '{{ csrf_token }}') {
        return fromWindow
    }
    const meta = document.querySelector('meta[name="csrf_token"]')
    const content = meta?.getAttribute('content')
    if (content) return content
    const match = document.cookie?.match(/(?:^|;\s*)csrf_token=([^;]*)/)
    if (match) {
        try {
            return decodeURIComponent(match[1])
        } catch {
            return match[1]
        }
    }
    return undefined
}

/**
 * Session-cookie authentication. In a browser, relies on the browser's own cookie jar and reads
 * the CSRF token from `window`/`document`. In Node, owns an in-memory cookie jar (populated by
 * the transport from `set-cookie` response headers) and forwards `Cookie` + CSRF headers itself.
 *
 * One `cookieAuth()` instance holds one session. Do not share it across users; call `cookieAuth()`
 * again (or `client.withAuth(...)`) to get an isolated session.
 */
export function cookieAuth(): AuthStrategy & {
    readonly jar: Map<string, CookieRecord>
} {
    const jar = new Map<string, CookieRecord>()
    return {
        name: 'cookie',
        jar,
        onResponse(headers, req) {
            if (isBrowserEnvironment()) return // the browser owns its own cookie jar
            const setCookie = getSetCookieHeader(headers)
            if (setCookie) {
                mergeSetCookie(setCookie, jar, Date.now(), new URL(req.url).hostname)
            }
        },
        apply(headers, req) {
            if (isBrowserEnvironment()) {
                const csrf = resolveCSRFTokenBrowser()
                if (csrf) headers['X-Frappe-CSRF-Token'] = csrf
                return
            }
            const cookieHeader = serializeCookieJar(jar, req.url)
            if (cookieHeader) headers.Cookie = cookieHeader
            const csrf = jar.get('csrf_token')?.value
            if (csrf) headers['X-Frappe-CSRF-Token'] = csrf
        },
        reset() {
            jar.clear()
        },
    }
}
