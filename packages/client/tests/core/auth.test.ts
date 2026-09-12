import { describe, expect, it } from 'vitest'

import {
    anonymousAuth,
    bearerAuth,
    cookieAuth,
    cookieDomainMatchesHost,
    cookieMatchesPath,
    mergeSetCookie,
    oauthAuth,
    parseSetCookieLine,
    serializeCookieJar,
    tokenAuth,
} from '../../src/core/auth'

describe('core/auth — cookie jar', () => {
    it('parses a Set-Cookie line with attributes', () => {
        const parsed = parseSetCookieLine('sid=abc123; Path=/; Secure; Domain=example.com')
        expect(parsed).toMatchObject({
            name: 'sid',
            value: 'abc123',
            path: '/',
            secure: true,
            domain: 'example.com',
            delete: false,
        })
    })

    it('treats Max-Age=0 or an empty value as a deletion', () => {
        expect(parseSetCookieLine('sid=; Path=/')?.delete).toBe(true)
        expect(parseSetCookieLine('sid=abc; Max-Age=0')?.delete).toBe(true)
    })

    it('mergeSetCookie populates and serializeCookieJar reproduces the Cookie header', () => {
        const jar = new Map()
        mergeSetCookie('sid=abc123; Path=/', jar, Date.now(), 'example.com')
        mergeSetCookie('csrf_token=xyz; Path=/', jar, Date.now(), 'example.com')
        const header = serializeCookieJar(jar, 'https://example.com/api/method/foo')
        expect(header).toContain('sid=abc123')
        expect(header).toContain('csrf_token=xyz')
    })

    it('does not send a Secure cookie over plain http', () => {
        const jar = new Map()
        mergeSetCookie('sid=abc; Path=/; Secure', jar, Date.now(), 'example.com')
        expect(serializeCookieJar(jar, 'http://example.com/x')).toBe('')
        expect(serializeCookieJar(jar, 'https://example.com/x')).toContain('sid=abc')
    })

    it('cookieDomainMatchesHost matches subdomains but not unrelated hosts', () => {
        expect(cookieDomainMatchesHost('example.com', 'app.example.com')).toBe(true)
        expect(cookieDomainMatchesHost('example.com', 'example.com')).toBe(true)
        expect(cookieDomainMatchesHost('example.com', 'notexample.com')).toBe(false)
        expect(cookieDomainMatchesHost('example.com', 'evil.com')).toBe(false)
    })

    it('cookieMatchesPath respects path scoping', () => {
        expect(cookieMatchesPath('/', '/anything')).toBe(true)
        expect(cookieMatchesPath('/api', '/api/method/foo')).toBe(true)
        expect(cookieMatchesPath('/api', '/other')).toBe(false)
    })

    it('cookieAuth().apply forwards the jar as a Cookie header in a non-browser environment', async () => {
        const auth = cookieAuth()
        await auth.onResponse?.(new Headers({ 'set-cookie': 'sid=abc123; Path=/' }), {
            method: 'GET',
            url: 'https://example.com/api/method/foo',
        })
        const headers: Record<string, string> = {}
        await auth.apply(headers, { method: 'GET', url: 'https://example.com/api/method/foo' })
        expect(headers.Cookie).toBe('sid=abc123')
    })

    it('reset() clears the jar', async () => {
        const auth = cookieAuth()
        await auth.onResponse?.(new Headers({ 'set-cookie': 'sid=abc123; Path=/' }), {
            method: 'GET',
            url: 'https://example.com/api/method/foo',
        })
        auth.reset?.()
        expect(auth.jar.size).toBe(0)
    })
})

describe('core/auth — strategies', () => {
    it('anonymousAuth adds no headers', async () => {
        const headers: Record<string, string> = {}
        await anonymousAuth().apply(headers, { method: 'GET', url: 'https://example.com' })
        expect(headers).toEqual({})
    })

    it('tokenAuth sets a `token key:secret` Authorization header', async () => {
        const headers: Record<string, string> = {}
        await tokenAuth({ apiKey: 'key', apiSecret: 'secret' }).apply(headers, {
            method: 'GET',
            url: 'https://example.com',
        })
        expect(headers.Authorization).toBe('token key:secret')
    })

    it('bearerAuth sets, then clears, the Authorization header', async () => {
        const auth = bearerAuth({ token: () => 'abc' })
        const headers: Record<string, string> = {}
        await auth.apply(headers, { method: 'GET', url: 'https://example.com' })
        expect(headers.Authorization).toBe('Bearer abc')
        const tokenAuthStyle = bearerAuth({ token: () => undefined, scheme: 'token' })
        headers.Authorization = 'stale'
        await tokenAuthStyle.apply(headers, { method: 'GET', url: 'https://example.com' })
        expect(headers.Authorization).toBeUndefined()
    })

    it('oauthAuth caches a token, refreshes on 401, and resets', async () => {
        let n = 0
        const auth = oauthAuth({
            getToken: () => 'first',
            refresh: async () => {
                n++
                return n === 1 ? 'second' : ''
            },
        })
        const headers: Record<string, string> = {}
        await auth.apply(headers, { method: 'GET', url: 'https://example.com' })
        expect(headers.Authorization).toBe('Bearer first')
        await expect(auth.onUnauthorized?.()).resolves.toBe(true)
        headers.Authorization = ''
        await auth.apply(headers, { method: 'GET', url: 'https://example.com' })
        expect(headers.Authorization).toBe('Bearer second')
        await expect(auth.onUnauthorized?.()).resolves.toBe(false)
        auth.reset?.()
        const noRefresh = oauthAuth({ getToken: () => undefined })
        const empty: Record<string, string> = { Authorization: 'stale' }
        await noRefresh.apply(empty, { method: 'GET', url: 'https://example.com' })
        expect(empty.Authorization).toBeUndefined()
        await expect(noRefresh.onUnauthorized?.()).resolves.toBe(false)
    })

    it('authentication strategies replace authorization headers case-insensitively', async () => {
        const headers = { authorization: 'stale' }
        await bearerAuth({ token: () => 'fresh' }).apply(headers, { method: 'GET', url: 'https://example.com' })
        expect(headers).toEqual({ Authorization: 'Bearer fresh' })
    })

    it('oauthAuth deduplicates concurrent refreshes', async () => {
        let refreshCalls = 0
        let release!: (token: string) => void
        const refreshed = new Promise<string>((resolve) => {
            release = resolve
        })
        const auth = oauthAuth({
            getToken: () => 'old',
            refresh: () => {
                refreshCalls++
                return refreshed
            },
        })

        const first = auth.onUnauthorized!()
        const second = auth.onUnauthorized!()
        expect(refreshCalls).toBe(1)
        release('new')
        await expect(Promise.all([first, second])).resolves.toEqual([true, true])
    })

    it('oauthAuth deduplicates concurrent initial token loads', async () => {
        let loads = 0
        let release!: (token: string) => void
        const auth = oauthAuth({
            getToken: () => {
                loads++
                return new Promise<string>((resolve) => {
                    release = resolve
                })
            },
        })
        const first: Record<string, string> = {}
        const second: Record<string, string> = {}
        const pending = Promise.all([
            auth.apply(first, { method: 'GET', url: 'https://example.com' }),
            auth.apply(second, { method: 'GET', url: 'https://example.com' }),
        ])
        expect(loads).toBe(1)
        release('shared')
        await pending
        expect(first.Authorization).toBe('Bearer shared')
        expect(second.Authorization).toBe('Bearer shared')
    })

    it('oauthAuth reset prevents a late refresh from restoring an obsolete token', async () => {
        let release!: (token: string) => void
        const auth = oauthAuth({
            getToken: () => 'initial',
            refresh: () =>
                new Promise<string>((resolve) => {
                    release = resolve
                }),
        })
        const refreshing = auth.onUnauthorized!()
        auth.reset!()
        release('obsolete')
        await refreshing

        const headers: Record<string, string> = {}
        await auth.apply(headers, { method: 'GET', url: 'https://example.com' })
        expect(headers.Authorization).toBe('Bearer initial')
    })

    it('oauthAuth reset starts a new refresh instead of sharing the obsolete in-flight refresh', async () => {
        const releases: Array<(token: string) => void> = []
        const auth = oauthAuth({
            getToken: () => 'initial',
            refresh: () =>
                new Promise<string>((resolve) => {
                    releases.push(resolve)
                }),
        })

        const obsolete = auth.onUnauthorized!()
        auth.reset!()
        const current = auth.onUnauthorized!()
        expect(releases).toHaveLength(2)

        releases[0]('obsolete')
        await expect(obsolete).resolves.toBe(false)
        releases[1]('current')
        await expect(current).resolves.toBe(true)

        const headers: Record<string, string> = {}
        await auth.apply(headers, { method: 'GET', url: 'https://example.com' })
        expect(headers.Authorization).toBe('Bearer current')
    })

    it('oauthAuth: late initial load must not overwrite a successful refresh (plan regression)', async () => {
        // Exact reproduction from the implementation plan:
        // hold getToken(), trigger onUnauthorized(), complete refresh with 'fresh',
        // then resolve the initial load with 'old' — apply() must use 'Bearer fresh'.
        let resolveLoad!: (token: string) => void
        const auth = oauthAuth({
            getToken: () =>
                new Promise<string>((resolve) => {
                    resolveLoad = resolve
                }),
            refresh: async () => 'fresh',
        })
        const initial = auth.apply({}, { method: 'GET', url: 'https://example.com' })
        await auth.onUnauthorized?.()
        resolveLoad('old')
        await initial
        const headers: Record<string, string> = {}
        await auth.apply(headers, { method: 'GET', url: 'https://example.com' })
        expect(headers.Authorization).toBe('Bearer fresh')
    })

    it('oauthAuth: failed refresh followed by successful one recovers correctly', async () => {
        let attempt = 0
        const auth = oauthAuth({
            getToken: () => undefined,
            refresh: async () => {
                attempt++
                if (attempt === 1) throw new Error('network error')
                return 'recovered'
            },
        })
        await expect(auth.onUnauthorized?.()).rejects.toThrow('network error')
        const result = await auth.onUnauthorized?.()
        expect(result).toBe(true)
        const headers: Record<string, string> = {}
        await auth.apply(headers, { method: 'GET', url: 'https://example.com' })
        expect(headers.Authorization).toBe('Bearer recovered')
    })

    it('oauthAuth: reset during in-flight load prevents the stale result from being cached', async () => {
        const loads: Array<(token: string) => void> = []
        const auth = oauthAuth({
            getToken: () =>
                new Promise<string>((resolve) => {
                    loads.push(resolve)
                }),
        })
        const firstApply = auth.apply({}, { method: 'GET', url: 'https://example.com' })
        auth.reset!()
        loads[0]('stale')
        await firstApply

        const headers: Record<string, string> = {}
        const freshApply = auth.apply(headers, { method: 'GET', url: 'https://example.com' })
        expect(loads).toHaveLength(2)
        loads[1]('fresh-after-reset')
        await freshApply
        expect(headers.Authorization).toBe('Bearer fresh-after-reset')
    })
})

describe('core/auth — cookie edge cases', () => {
    it('parseSetCookieLine returns null without a name=value pair', () => {
        expect(parseSetCookieLine('not-a-cookie')).toBeNull()
        expect(parseSetCookieLine('=value')).toBeNull()
    })

    it('parses Expires, ignores invalid Max-Age/Expires, and prefers Max-Age', () => {
        const now = Date.parse('2024-01-01T00:00:00Z')
        const withExpires = parseSetCookieLine('sid=abc; Expires=Wed, 21 Oct 2015 07:28:00 GMT', now)
        expect(withExpires?.delete).toBe(true)
        const invalid = parseSetCookieLine('sid=abc; Max-Age=nope; Expires=not-a-date', now)
        expect(invalid?.delete).toBe(false)
        const maxAge = parseSetCookieLine('sid=abc; Max-Age=10; Expires=Wed, 21 Oct 2015 07:28:00 GMT', now)
        expect(maxAge?.expiresAt).toBe(now + 10_000)
        expect(parseSetCookieLine('sid=abc; Path=; HttpOnly', now)?.path).toBe('/')
    })

    it('cookieDomainMatchesHost and cookieMatchesPath remaining branches', () => {
        expect(cookieDomainMatchesHost('', 'example.com')).toBe(false)
        expect(cookieDomainMatchesHost('localhost', 'localhost')).toBe(true)
        expect(cookieDomainMatchesHost('localhost', 'other')).toBe(false)
        expect(cookieDomainMatchesHost('1.2.3.4', '1.2.3.4')).toBe(true)
        expect(cookieDomainMatchesHost('1.2.3.4', '4.3.2.1')).toBe(false)
        expect(cookieDomainMatchesHost('::1', '::1')).toBe(true)
        expect(cookieMatchesPath('', '/x')).toBe(true)
        expect(cookieMatchesPath('/api', '/api')).toBe(true)
        expect(cookieMatchesPath('/api/', '/api/method')).toBe(true)
        expect(cookieMatchesPath('/api', '/apifoo')).toBe(false)
    })

    it('mergeSetCookie skips missing headers, bad lines, domain mismatches, and deletions', () => {
        const jar = new Map()
        mergeSetCookie(undefined, jar)
        mergeSetCookie('nope', jar)
        mergeSetCookie(['sid=abc; Domain=other.com'], jar, Date.now(), 'example.com')
        expect(jar.size).toBe(0)
        mergeSetCookie(['sid=abc; Path=/app'], jar, Date.now(), 'example.com')
        mergeSetCookie('sid=; Path=/', jar, Date.now(), 'example.com')
        expect(serializeCookieJar(jar, 'https://example.com/app')).toBe('sid=abc')
    })

    it('keeps same-name cookies with different paths and selects the most specific match', () => {
        const jar = new Map()
        mergeSetCookie('sid=root; Path=/', jar, Date.now(), 'example.com')
        mergeSetCookie('sid=app; Path=/app', jar, Date.now(), 'example.com')
        mergeSetCookie('sid=admin; Path=/admin', jar, Date.now(), 'example.com')

        expect(serializeCookieJar(jar, 'https://example.com/')).toBe('sid=root')
        expect(serializeCookieJar(jar, 'https://example.com/app/page')).toBe('sid=app; sid=root')
    })

    it('replaces a cookie only within the same scope', () => {
        const jar = new Map()
        mergeSetCookie('sid=old; Path=/app', jar, Date.now(), 'example.com')
        mergeSetCookie('sid=new; Path=/app', jar, Date.now(), 'example.com')

        expect(serializeCookieJar(jar, 'https://example.com/app')).toBe('sid=new')
    })

    it('deletes only a same-name cookie with the matching scope', () => {
        const jar = new Map()
        mergeSetCookie('sid=root; Path=/', jar, Date.now(), 'example.com')
        mergeSetCookie('sid=app; Path=/app', jar, Date.now(), 'example.com')
        mergeSetCookie('sid=; Path=/app', jar, Date.now(), 'example.com')

        expect(serializeCookieJar(jar, 'https://example.com/app')).toBe('sid=root')
    })

    it('applies a CSRF cookie only when it is scoped to the request URL', async () => {
        const auth = cookieAuth()
        await auth.onResponse?.(new Headers({ 'set-cookie': 'csrf_token=private; Path=/private' }), {
            method: 'GET',
            url: 'https://example.com/private',
        })
        const headers: Record<string, string> = {}

        await auth.apply(headers, { method: 'POST', url: 'https://example.com/api/method/x' })

        expect(headers['X-Frappe-CSRF-Token']).toBeUndefined()
    })

    it('serializeCookieJar drops expired cookies, host mismatches, path mismatches, and invalid URLs', () => {
        const now = Date.now()
        const jar = new Map()
        mergeSetCookie('gone=x; Max-Age=1', jar, now, 'example.com')
        expect(serializeCookieJar(jar, 'https://example.com/', now + 2000)).toBe('')
        mergeSetCookie('sid=abc; Path=/app', jar, now, 'example.com')
        expect(serializeCookieJar(jar, 'https://example.com/other')).toBe('')
        const hostJar = new Map()
        mergeSetCookie('a=1', hostJar, now, 'example.com')
        expect(serializeCookieJar(hostJar, 'https://other.com/x', now)).toBe('')
        const domainJar = new Map()
        mergeSetCookie('a=1; Domain=example.com', domainJar, now, 'example.com')
        expect(serializeCookieJar(domainJar, 'https://evil.com/x', now)).toBe('')
        expect(serializeCookieJar(domainJar, 'https://app.example.com/x', now)).toBe('a=1')
        expect(serializeCookieJar(domainJar, 'not a url', now)).toBe('')
        expect(serializeCookieJar(new Map([['x', { value: '1', path: '/', host: '' }]]))).toBe('x=1')
    })

    it('cookieAuth applies CSRF from the jar and from browser globals', async () => {
        const auth = cookieAuth()
        await auth.onResponse?.(new Headers({ 'set-cookie': 'csrf_token=tok; Path=/' }), {
            method: 'GET',
            url: 'https://example.com/x',
        })
        const headers: Record<string, string> = {}
        await auth.apply(headers, { method: 'POST', url: 'https://example.com/api/method/x' })
        expect(headers['X-Frappe-CSRF-Token']).toBe('tok')

        const origWindow = (globalThis as any).window
        const origDocument = (globalThis as any).document
        ;(globalThis as any).window = { csrf_token: 'from-window' }
        ;(globalThis as any).document = {
            querySelector: () => ({ getAttribute: () => 'from-meta' }),
            cookie: '',
        }
        const browser = cookieAuth()
        const h2: Record<string, string> = {}
        await browser.apply(h2, { method: 'POST', url: 'https://example.com/x' })
        expect(h2['X-Frappe-CSRF-Token']).toBe('from-window')

        ;(globalThis as any).window = { csrf_token: '{{ csrf_token }}' }
        const h3: Record<string, string> = {}
        await browser.apply(h3, { method: 'POST', url: 'https://example.com/x' })
        expect(h3['X-Frappe-CSRF-Token']).toBe('from-meta')

        ;(globalThis as any).document = {
            querySelector: () => null,
            cookie: 'csrf_token=from%20cookie',
        }
        const h4: Record<string, string> = {}
        await browser.apply(h4, { method: 'POST', url: 'https://example.com/x' })
        expect(h4['X-Frappe-CSRF-Token']).toBe('from cookie')

        ;(globalThis as any).document = {
            querySelector: () => null,
            cookie: 'csrf_token=%E0%A4',
        }
        const h5: Record<string, string> = {}
        await browser.apply(h5, { method: 'POST', url: 'https://example.com/x' })
        expect(h5['X-Frappe-CSRF-Token']).toBe('%E0%A4')

        ;(globalThis as any).window = { csrf_token: '{{ csrf_token }}' }
        ;(globalThis as any).document = { querySelector: () => null, cookie: '' }
        const h6: Record<string, string> = {}
        await browser.apply(h6, { method: 'POST', url: 'https://example.com/x' })
        expect(h6['X-Frappe-CSRF-Token']).toBeUndefined()

        ;(globalThis as any).window = origWindow
        ;(globalThis as any).document = origDocument
    })
})
