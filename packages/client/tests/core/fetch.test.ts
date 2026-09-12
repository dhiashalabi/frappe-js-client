import { afterEach, describe, expect, it, vi } from 'vitest'

import { anonymousAuth, getSetCookieHeader, oauthAuth, tokenAuth } from '../../src/core/auth'
import { normalizeConfig } from '../../src/core/config'
import {
    AuthenticationError,
    CancelledError,
    ConfigurationError,
    TimeoutError,
    TransportError,
} from '../../src/core/errors'
import { FetchTransport } from '../../src/core/fetch'
import { retry } from '../../src/core/middleware'

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json', ...headers },
    })
}

describe('FetchTransport', () => {
    const originalFetch = globalThis.fetch

    afterEach(() => {
        globalThis.fetch = originalFetch
        vi.useRealTimers()
    })

    it('applies the auth strategy header before sending', async () => {
        let seenHeaders: HeadersInit | undefined
        globalThis.fetch = vi.fn(async (_url, init) => {
            seenHeaders = init?.headers
            return jsonResponse({ data: 'ok' })
        }) as any

        const config = normalizeConfig({ url: 'https://example.com', auth: tokenAuth({ apiKey: 'k', apiSecret: 's' }) })
        const transport = new FetchTransport({ config })
        await transport.request({ method: 'GET', url: '/api/v2/method/ping' })

        expect((seenHeaders as Record<string, string>).Authorization).toBe('token k:s')
    })

    it('maps a non-2xx response to the correct FrappeError subclass', async () => {
        globalThis.fetch = vi.fn(async () => jsonResponse({ message: 'Not authenticated' }, 401)) as any
        const config = normalizeConfig({ url: 'https://example.com', auth: anonymousAuth() })
        const transport = new FetchTransport({ config })

        await expect(transport.request({ method: 'GET', url: '/api/v2/method/ping' })).rejects.toBeInstanceOf(
            AuthenticationError,
        )
    })

    it('retries once after oauthAuth refresh on 401', async () => {
        let n = 0
        globalThis.fetch = vi.fn(async () => {
            n++
            if (n === 1) return jsonResponse({ message: 'expired' }, 401)
            return jsonResponse({ data: 'ok' })
        }) as any
        const auth = oauthAuth({
            getToken: () => 'old',
            refresh: async () => 'new',
        })
        const transport = new FetchTransport({
            config: normalizeConfig({ url: 'https://example.com', auth }),
        })
        const res = await transport.request({ method: 'GET', url: '/api/v2/method/ping' })
        expect(res.status).toBe(200)
        expect(n).toBe(2)
        expect((globalThis.fetch as any).mock.calls[1][1].headers.Authorization).toBe('Bearer new')
    })

    it('releases a 401 response body before authentication replay', async () => {
        let cancelled = false
        let calls = 0
        globalThis.fetch = vi.fn(async () => {
            calls++
            if (calls === 1) {
                return new Response(
                    new ReadableStream({
                        cancel() {
                            cancelled = true
                        },
                    }),
                    { status: 401 },
                )
            }
            return jsonResponse({ data: 'ok' })
        }) as any
        const transport = new FetchTransport({
            config: normalizeConfig({
                url: 'https://example.com',
                auth: oauthAuth({ getToken: () => 'old', refresh: async () => 'new' }),
            }),
        })

        await transport.request({ method: 'GET', url: '/x' })

        expect(cancelled).toBe(true)
    })

    it('applies per-request header overrides case-insensitively', async () => {
        let seen = new Headers()
        globalThis.fetch = vi.fn(async (_url, init) => {
            seen = new Headers(init?.headers)
            return jsonResponse({ data: 'ok' })
        }) as any
        const transport = new FetchTransport({
            config: normalizeConfig({ url: 'https://example.com', headers: { 'X-Tenant': 'old' } }),
        })

        await transport.request({ method: 'GET', url: '/x', headers: { 'x-tenant': 'new' } })

        expect(seen.get('x-tenant')).toBe('new')
    })

    it('enforces the deadline while asynchronous authentication is pending', async () => {
        const transport = new FetchTransport({
            config: normalizeConfig({
                url: 'https://example.com',
                auth: oauthAuth({ getToken: () => new Promise<string>(() => undefined) }),
            }),
        })

        await expect(transport.request({ method: 'GET', url: '/x', deadline: Date.now() + 5 })).rejects.toBeInstanceOf(
            TimeoutError,
        )
    })

    it('clears the deadline timer when authentication setup fails', async () => {
        vi.useFakeTimers()
        const transport = new FetchTransport({
            config: normalizeConfig({
                url: 'https://example.com',
                auth: {
                    name: 'failing',
                    apply() {
                        return Promise.reject(new Error('auth exploded'))
                    },
                },
            }),
        })

        await expect(transport.request({ method: 'GET', url: '/x', deadline: Date.now() + 60_000 })).rejects.toThrow(
            'auth exploded',
        )
        expect(vi.getTimerCount()).toBe(0)
    })

    it('removes query values from error request context', async () => {
        globalThis.fetch = vi.fn(async () => jsonResponse({ message: 'denied' }, 403)) as any
        const transport = new FetchTransport({ config: normalizeConfig({ url: 'https://example.com' }) })

        await expect(
            transport.request({ method: 'GET', url: '/x', params: { access_token: 'secret', filter: 'private' } }),
        ).rejects.toMatchObject({ request: { url: 'https://example.com/x' } })
    })

    it('delivers both the original 401 and replay response headers to auth', async () => {
        const seen: string[] = []
        let calls = 0
        globalThis.fetch = vi.fn(async () => {
            calls++
            return jsonResponse({ data: 'ok' }, calls === 1 ? 401 : 200, {
                'x-auth-step': calls === 1 ? 'expired' : 'refreshed',
            })
        }) as any
        const auth = {
            name: 'refreshing',
            apply() {},
            onResponse(headers: Headers) {
                seen.push(headers.get('x-auth-step')!)
            },
            onUnauthorized: () => true,
        }
        const transport = new FetchTransport({ config: normalizeConfig({ url: 'https://example.com', auth }) })

        await transport.request({ method: 'GET', url: '/x' })
        expect(seen).toEqual(['expired', 'refreshed'])
    })

    it('allows only one authentication replay across middleware retries', async () => {
        let refreshes = 0
        globalThis.fetch = vi.fn(async () => jsonResponse({ message: 'expired' }, 401)) as any
        const auth = {
            name: 'refreshing',
            apply() {},
            onUnauthorized() {
                refreshes++
                return true
            },
        }
        const transport = new FetchTransport({
            config: normalizeConfig({
                url: 'https://example.com',
                auth,
                middleware: [retry({ attempts: 1, baseDelayMs: 0, shouldRetry: () => true })],
            }),
        })

        await expect(transport.request({ method: 'GET', url: '/x' })).rejects.toBeInstanceOf(AuthenticationError)
        expect(refreshes).toBe(1)
        expect(globalThis.fetch).toHaveBeenCalledTimes(3)
    })

    it('maps a fetch rejection (no HTTP response) to TransportError', async () => {
        globalThis.fetch = vi.fn(async () => {
            throw new TypeError('fetch failed')
        }) as any
        const config = normalizeConfig({ url: 'https://example.com' })
        const transport = new FetchTransport({ config })

        await expect(transport.request({ method: 'GET', url: '/api/v2/method/ping' })).rejects.toBeInstanceOf(
            TransportError,
        )
    })

    it('maps a caller-provided AbortSignal abort to CancelledError', async () => {
        const controller = new AbortController()
        globalThis.fetch = vi.fn(async (_url, init: any) => {
            if (init.signal?.aborted) {
                throw new DOMException('Aborted', 'AbortError')
            }
            return new Promise((_resolve, reject) => {
                init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
            })
        }) as any

        const config = normalizeConfig({ url: 'https://example.com' })
        const transport = new FetchTransport({ config })
        const promise = transport.request({ method: 'GET', url: '/api/v2/method/ping', signal: controller.signal })
        // Abort on the next microtask so the request has actually reached `fetch()` and attached
        // its listener — mirroring how a real caller aborts mid-flight rather than pre-aborted.
        await Promise.resolve()
        controller.abort()

        await expect(promise).rejects.toBeInstanceOf(CancelledError)
    })

    it('maps a timeout to TimeoutError, distinct from user cancellation', async () => {
        globalThis.fetch = vi.fn(async (_url, init: any) => {
            return new Promise((_resolve, reject) => {
                init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
            })
        }) as any

        const config = normalizeConfig({ url: 'https://example.com', timeout: 5 })
        const transport = new FetchTransport({ config })

        await expect(transport.request({ method: 'GET', url: '/api/v2/method/ping' })).rejects.toBeInstanceOf(
            TimeoutError,
        )
    })

    it('preserves the raw response text even when the body is not valid JSON', async () => {
        globalThis.fetch = vi.fn(async () => new Response('<html>oops</html>', { status: 500 })) as any
        const config = normalizeConfig({ url: 'https://example.com' })
        const transport = new FetchTransport({ config })

        try {
            await transport.request({ method: 'GET', url: '/api/v2/method/ping' })
            expect.unreachable()
        } catch (error: any) {
            expect(error.responseText).toBe('<html>oops</html>')
        }
    })
})

describe('FetchTransport — remaining branches', () => {
    const originalFetch = globalThis.fetch
    const originalXhr = (globalThis as any).XMLHttpRequest
    const originalAny = (AbortSignal as any).any

    afterEach(() => {
        globalThis.fetch = originalFetch
        ;(globalThis as any).XMLHttpRequest = originalXhr
        if (originalAny) (AbortSignal as any).any = originalAny
        else delete (AbortSignal as any).any
        vi.unstubAllGlobals()
        vi.useRealTimers()
    })

    function transport(overrides: Record<string, unknown> = {}) {
        return new FetchTransport({ config: normalizeConfig({ url: 'https://example.com', ...overrides }) as any })
    }

    function stubXhr(opts: { status?: number; response?: string } = {}) {
        const sent: Array<{ onload: (() => void) | null }> = []
        class StubXMLHttpRequest {
            timeout = 0
            withCredentials = false
            responseType = 'text'
            status = opts.status ?? 200
            statusText = opts.status && opts.status !== 200 ? 'Error' : 'OK'
            response = opts.response ?? '{"data":"ok"}'
            upload = { onprogress: undefined as ((event: ProgressEvent) => void) | undefined }
            ontimeout: (() => void) | null = null
            onabort: (() => void) | null = null
            onerror: (() => void) | null = null
            onload: (() => void) | null = null
            open() {}
            setRequestHeader() {}
            getAllResponseHeaders() {
                return ''
            }
            abort() {
                this.onabort?.()
            }
            send() {
                sent.push(this)
                queueMicrotask(() => this.onload?.())
            }
        }
        ;(globalThis as any).XMLHttpRequest = StubXMLHttpRequest
        return sent
    }

    it('removes fallback composed-signal listeners after a successful request', async () => {
        ;(AbortSignal as any).any = undefined
        const controller = new AbortController()
        const add = vi.spyOn(controller.signal, 'addEventListener')
        const remove = vi.spyOn(controller.signal, 'removeEventListener')
        globalThis.fetch = vi.fn(async () => jsonResponse({ data: 'ok' })) as any

        await transport().request({ method: 'GET', url: '/x', signal: controller.signal })
        expect(add.mock.calls.length).toBeGreaterThanOrEqual(1)
        expect(add.mock.calls.length).toBe(remove.mock.calls.length)
    })

    it('honors a cancellation signal supplied by middleware', async () => {
        const controller = new AbortController()
        globalThis.fetch = vi.fn(
            (_url: string, init: { signal: AbortSignal }) =>
                new Promise((_resolve, reject) => {
                    init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true })
                }),
        ) as any
        const t = transport({
            timeout: 1000,
            middleware: [(request: any, next: any) => next({ ...request, signal: controller.signal })],
        })
        const pending = t.request({ method: 'GET', url: '/x' })
        await Promise.resolve()
        controller.abort()
        await expect(pending).rejects.toBeInstanceOf(CancelledError)
    })

    it('honors an already-aborted signal supplied by middleware', async () => {
        delete (AbortSignal as any).any
        const controller = new AbortController()
        controller.abort('middleware cancelled')
        globalThis.fetch = vi.fn(async (_url: string, init: { signal?: AbortSignal }) => {
            if (init.signal?.aborted) {
                const error = new DOMException('Aborted', 'AbortError')
                throw error
            }
            return jsonResponse({})
        }) as any
        const t = transport({
            middleware: [(request: any, next: any) => next({ ...request, signal: controller.signal })],
        })

        await expect(t.request({ method: 'GET', url: '/x' })).rejects.toBeInstanceOf(CancelledError)
    })

    it('sets siteName headers, JSON body, requestId, and logs success', async () => {
        const debug = vi.fn()
        globalThis.fetch = vi.fn(async () => jsonResponse({ data: 1 })) as any
        const t = new FetchTransport({
            config: normalizeConfig({
                url: 'https://example.com',
                siteName: 'site.localhost',
                logger: { debug },
            }),
        })
        const res = await t.request({
            method: 'POST',
            url: '/api/v2/method/ping',
            data: { a: 1 },
            requestId: 'rid-1',
            params: { x: 1, skip: null },
        })
        expect(res.data).toEqual({ data: 1 })
        expect(debug.mock.calls[0][0]).toMatchObject({
            method: 'POST',
            path: '/api/v2/method/ping',
            status: 200,
            requestId: 'rid-1',
        })
        const headers = (globalThis.fetch as any).mock.calls[0][1].headers
        expect(headers.Host).toBe('site.localhost')
        expect(headers['X-Frappe-Site-Name']).toBe('site.localhost')
        expect(headers['Content-Type']).toContain('application/json')
        expect(debug).toHaveBeenCalled()
    })

    it('does not overwrite an existing Content-Type and appends params to a url that already has a query', async () => {
        globalThis.fetch = vi.fn(async (url: string) => {
            expect(String(url)).toContain('?keep=1&extra=2')
            return jsonResponse({})
        }) as any
        await transport().request({
            method: 'GET',
            url: 'https://example.com/api/v2/method/ping?keep=1',
            params: { extra: 2 },
            headers: { 'Content-Type': 'text/plain' },
        })
    })

    it('does not add a second Content-Type when the existing key is lowercase', async () => {
        globalThis.fetch = vi.fn(async (_url, init: any) => {
            const keys = Object.keys(init.headers).filter((k) => k.toLowerCase() === 'content-type')
            expect(keys).toEqual(['content-type'])
            expect(init.headers['content-type']).toBe('text/plain')
            return jsonResponse({})
        }) as any
        await transport().request({
            method: 'POST',
            url: '/x',
            data: { a: 1 },
            headers: { 'content-type': 'text/plain' },
        })
    })

    it('returns the resolved url when params serialize to empty', async () => {
        globalThis.fetch = vi.fn(async (url: string) => {
            expect(String(url)).not.toContain('?')
            return jsonResponse({})
        }) as any
        await transport().request({ method: 'GET', url: '/api/v2/method/ping', params: { a: undefined } })
    })

    it('sends FormData without a Content-Type so fetch can set the boundary', async () => {
        globalThis.fetch = vi.fn(async (_url, init: any) => {
            expect(init.body).toBeInstanceOf(FormData)
            expect(init.headers['Content-Type']).toBeUndefined()
            return jsonResponse({})
        }) as any
        const form = new FormData()
        form.append('file', new Blob(['x']), 'x.txt')
        await transport().request({ method: 'POST', url: '/api/method/upload_file', data: form })

        await transport().request({
            method: 'POST',
            url: '/api/method/upload_file',
            data: form,
            headers: { 'Content-Type': 'multipart/form-data' },
        })
        expect((globalThis.fetch as any).mock.calls.at(-1)[1].headers['Content-Type']).toBeUndefined()
    })

    it('reads blob, arraybuffer, and empty-text bodies', async () => {
        globalThis.fetch = vi.fn(async () => new Response(new Blob(['hi']), { status: 200 })) as any
        const blob = await transport().request({ method: 'GET', url: '/f', responseType: 'blob' })
        expect(blob.data).toBeInstanceOf(Blob)

        globalThis.fetch = vi.fn(async () => new Response(new Uint8Array([1, 2]), { status: 200 })) as any
        const buf = await transport().request({ method: 'GET', url: '/f', responseType: 'arraybuffer' })
        expect(buf.data).toBeInstanceOf(ArrayBuffer)

        globalThis.fetch = vi.fn(async () => new Response('', { status: 200 })) as any
        const empty = await transport().request({ method: 'GET', url: '/f', responseType: 'text' })
        expect(empty.data).toBe('')
    })

    it('maps server messages, exception fallbacks, and logs failures', async () => {
        const debug = vi.fn()
        globalThis.fetch = vi.fn(async () =>
            jsonResponse(
                {
                    exception: 'boom',
                    exc: 'traceback',
                    exc_type: 'ValidationError',
                    errors: [1],
                    extra_field: 'keep',
                    _server_messages: JSON.stringify([
                        JSON.stringify({ message: 'bad', title: 'T' }),
                        { message: 'obj' },
                    ]),
                },
                417,
            ),
        ) as any
        const t = new FetchTransport({
            config: normalizeConfig({ url: 'https://example.com', logger: { debug } }),
        })
        await expect(t.request({ method: 'GET', url: '/api/v2/method/ping' })).rejects.toMatchObject({
            extra: { extra_field: 'keep' },
        })
        expect(debug.mock.calls[0][0]).toMatchObject({
            path: '/api/v2/method/ping',
            status: 417,
            error: 'ValidationError',
        })

        globalThis.fetch = vi.fn(async () => jsonResponse({ _server_messages: '{' }, 500)) as any
        await expect(t.request({ method: 'GET', url: '/x' })).rejects.toBeDefined()

        globalThis.fetch = vi.fn(async () =>
            jsonResponse({ _server_messages: JSON.stringify(['not-json']) }, 500),
        ) as any
        await expect(t.request({ method: 'GET', url: '/x' })).rejects.toBeDefined()

        globalThis.fetch = vi.fn(async () => jsonResponse({ _server_messages: [{ message: 'a' }] }, 500)) as any
        await expect(t.request({ method: 'GET', url: '/x' })).rejects.toBeDefined()

        globalThis.fetch = vi.fn(async () =>
            jsonResponse({ _server_messages: [JSON.stringify({ message: 'from-string' })] }, 500),
        ) as any
        await expect(t.request({ method: 'GET', url: '/x' })).rejects.toMatchObject({
            serverMessages: [{ message: 'from-string' }],
        })

        globalThis.fetch = vi.fn(async () => jsonResponse({ _server_messages: 12 }, 500)) as any
        await expect(t.request({ method: 'GET', url: '/x' })).rejects.toBeDefined()

        globalThis.fetch = vi.fn(async () => jsonResponse({ _server_messages: '{"x":1}' }, 500)) as any
        await expect(t.request({ method: 'GET', url: '/x' })).rejects.toBeDefined()

        globalThis.fetch = vi.fn(async () => jsonResponse({ _server_messages: [1, 'nope'] }, 500)) as any
        await expect(t.request({ method: 'GET', url: '/x' })).rejects.toBeDefined()

        globalThis.fetch = vi.fn(async () => jsonResponse('bare-error', 500)) as any
        await expect(t.request({ method: 'GET', url: '/x' })).rejects.toMatchObject({ status: 500 })
    })

    it('maps a non-Error network failure and a non-AbortError throw', async () => {
        globalThis.fetch = vi.fn(async () => {
            throw { reason: 'network-failure' }
        }) as any
        await expect(transport().request({ method: 'GET', url: '/x' })).rejects.toBeInstanceOf(TransportError)
    })

    it('falls back when AbortSignal.any is missing', async () => {
        delete (AbortSignal as any).any
        const controller = new AbortController()
        globalThis.fetch = vi.fn(async (_url, init: any) => {
            init.signal.addEventListener('abort', () => {})
            return jsonResponse({})
        }) as any
        await transport().request({ method: 'GET', url: '/x', signal: controller.signal })
    })

    it('AbortSignal.any fallback aborts immediately when a signal is already aborted', async () => {
        delete (AbortSignal as any).any
        const controller = new AbortController()
        controller.abort()
        globalThis.fetch = vi.fn(async (_url, init: any) => {
            if (init.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
            return jsonResponse({})
        }) as any
        await expect(
            transport().request({ method: 'GET', url: '/x', signal: controller.signal }),
        ).rejects.toBeInstanceOf(CancelledError)
    })

    it('AbortSignal.any fallback wires abort listeners when signals are not yet aborted', async () => {
        delete (AbortSignal as any).any
        const controller = new AbortController()
        globalThis.fetch = vi.fn(async (_url, init: any) => {
            return new Promise((_resolve, reject) => {
                init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
            })
        }) as any
        const promise = transport().request({ method: 'GET', url: '/x', signal: controller.signal })
        await Promise.resolve()
        controller.abort()
        await expect(promise).rejects.toBeInstanceOf(CancelledError)
    })

    it('falls back when crypto.randomUUID is missing', async () => {
        vi.stubGlobal('crypto', {})
        globalThis.fetch = vi.fn(async () => jsonResponse({})) as any
        await transport().request({ method: 'GET', url: '/x' })
    })

    it('reports best-effort upload progress around fetch when XHR is unavailable', async () => {
        delete (globalThis as any).XMLHttpRequest
        const events: { loaded: number; total?: number }[] = []
        globalThis.fetch = vi.fn(async () => jsonResponse({})) as any
        await transport().request({
            method: 'POST',
            url: '/x',
            data: { a: 1 },
            onUploadProgress: (e) => events.push(e),
        })
        expect(events[0]).toEqual({ loaded: 0 })
        expect(events.at(-1)).toEqual({ loaded: 1, total: 1 })
    })

    it('uses XHR when onUploadProgress is set and no middleware is configured', async () => {
        class StubXMLHttpRequest {
            static last: StubXMLHttpRequest
            method = ''
            url = ''
            timeout = 0
            withCredentials = false
            responseType = 'text'
            status = 200
            statusText = 'OK'
            response = '{"ok":true}'
            upload = { onprogress: undefined as ((ev: ProgressEvent) => void) | undefined }
            ontimeout: (() => void) | null = null
            onabort: (() => void) | null = null
            onerror: (() => void) | null = null
            onload: (() => void) | null = null
            headers: Record<string, string> = {}
            open(method: string, url: string) {
                this.method = method
                this.url = url
            }
            setRequestHeader(k: string, v: string) {
                this.headers[k] = v
            }
            abort() {
                this.onabort?.()
            }
            send() {
                StubXMLHttpRequest.last = this
                this.upload.onprogress?.({ loaded: 4, total: 8, lengthComputable: true } as ProgressEvent)
                this.upload.onprogress?.({ loaded: 1, lengthComputable: false } as ProgressEvent)
                queueMicrotask(() => this.onload?.())
            }
        }
        ;(globalThis as any).XMLHttpRequest = StubXMLHttpRequest
        const events: { loaded: number; total?: number }[] = []
        const res = await transport().request({
            method: 'POST',
            url: '/x',
            data: { a: 1 },
            onUploadProgress: (e) => events.push(e),
        })
        expect(res.data).toEqual({ ok: true })
        expect(events).toEqual([
            { loaded: 4, total: 8 },
            { loaded: 1, total: undefined },
        ])

        const withDeadline = await transport().request({
            method: 'POST',
            url: '/x',
            data: { a: 1 },
            onUploadProgress: () => undefined,
            deadline: Date.now() + 5_000,
        })
        expect(withDeadline.data).toEqual({ ok: true })
    })

    it('logs pathname only, never query secrets, and ignores a throwing logger', async () => {
        const secret = 'SEEDED_SID_VALUE'
        const debug = vi.fn()
        globalThis.fetch = vi.fn(async () => jsonResponse({})) as any
        await transport({ logger: { debug } }).request({
            method: 'GET',
            url: '/api/v2/method/ping',
            params: { sid: secret },
        })
        expect(debug).toHaveBeenCalledOnce()
        expect(debug.mock.calls[0][0].path).toBe('/api/v2/method/ping')
        expect(JSON.stringify(debug.mock.calls[0][0])).not.toContain(secret)

        const boom = vi.fn(() => {
            throw new Error('logger-broke')
        })
        globalThis.fetch = vi.fn(async () => jsonResponse({ ok: 1 })) as any
        await expect(
            transport({ logger: { debug: boom } }).request({ method: 'GET', url: '/safe' }),
        ).resolves.toMatchObject({ status: 200 })
        expect(boom).toHaveBeenCalled()
    })

    it('logs network failures with status 0 and error class name, not message', async () => {
        const debug = vi.fn()
        globalThis.fetch = vi.fn(async () => {
            throw new TypeError('fetch failed with secret-token')
        }) as any
        await expect(transport({ logger: { debug } }).request({ method: 'GET', url: '/x' })).rejects.toBeInstanceOf(
            TransportError,
        )
        expect(debug.mock.calls[0][0]).toMatchObject({ path: '/x', status: 0, error: 'TransportError' })
        expect(JSON.stringify(debug.mock.calls[0][0])).not.toContain('secret-token')
    })

    it('logs non-Frappe middleware throws as error name only', async () => {
        const debug = vi.fn()
        globalThis.fetch = vi.fn(async () => jsonResponse({})) as any
        await expect(
            transport({
                logger: { debug },
                middleware: [
                    async () => {
                        throw { reason: 'middleware-rejected-without-Error' }
                    },
                ],
            }).request({ method: 'GET', url: '/x' }),
        ).rejects.toEqual({ reason: 'middleware-rejected-without-Error' })
        expect(debug.mock.calls[0][0]).toMatchObject({ error: 'UnknownError', path: '/x' })
        expect(debug.mock.calls[0][0].status).toBeUndefined()

        debug.mockClear()
        await expect(
            transport({
                logger: { debug },
                middleware: [
                    async () => {
                        throw new Error('boom-secret')
                    },
                ],
            }).request({ method: 'GET', url: '/x' }),
        ).rejects.toThrow('boom-secret')
        expect(debug.mock.calls[0][0]).toMatchObject({ error: 'Error', path: '/x' })
        expect(JSON.stringify(debug.mock.calls[0][0])).not.toContain('boom-secret')
    })

    it('logs XHR upload success and failure', async () => {
        class StubXMLHttpRequest {
            status = 200
            statusText = 'OK'
            response = 'ok'
            timeout = 0
            withCredentials = false
            responseType = 'text'
            upload = { onprogress: undefined as ((ev: ProgressEvent) => void) | undefined }
            ontimeout: (() => void) | null = null
            onabort: (() => void) | null = null
            onerror: (() => void) | null = null
            onload: (() => void) | null = null
            open() {}
            setRequestHeader() {}
            abort() {}
            send() {
                queueMicrotask(() => this.onload?.())
            }
        }
        ;(globalThis as any).XMLHttpRequest = StubXMLHttpRequest
        const debug = vi.fn()
        await transport({ logger: { debug } }).request({
            method: 'POST',
            url: '/upload',
            data: { a: 1 },
            onUploadProgress: () => undefined,
        })
        expect(debug.mock.calls[0][0]).toMatchObject({ method: 'POST', path: '/upload', status: 200 })

        debug.mockClear()
        StubXMLHttpRequest.prototype.send = function send(this: StubXMLHttpRequest) {
            queueMicrotask(() => this.onerror?.())
        }
        await expect(
            transport({ logger: { debug } }).request({
                method: 'POST',
                url: '/upload',
                data: { a: 1 },
                onUploadProgress: () => undefined,
            }),
        ).rejects.toBeInstanceOf(TransportError)
        expect(debug.mock.calls[0][0]).toMatchObject({ path: '/upload', status: 0, error: 'TransportError' })
    })

    it('parses XHR JSON, captures response headers, and retries 401 after refresh', async () => {
        let sends = 0
        class StubXMLHttpRequest {
            status = 401
            statusText = 'OK'
            response = '{"message":"expired"}'
            timeout = 0
            withCredentials = false
            responseType = 'text'
            upload = { onprogress: undefined as ((ev: ProgressEvent) => void) | undefined }
            ontimeout: (() => void) | null = null
            onabort: (() => void) | null = null
            onerror: (() => void) | null = null
            onload: (() => void) | null = null
            open() {}
            setRequestHeader() {}
            abort() {}
            getAllResponseHeaders() {
                return 'x-a: 1\r\nx-b: 2'
            }
            send() {
                sends++
                if (sends === 1) {
                    this.status = 401
                    this.response = '{"message":"expired"}'
                } else {
                    this.status = 200
                    this.response = '{"ok":true}'
                }
                queueMicrotask(() => this.onload?.())
            }
        }
        ;(globalThis as any).XMLHttpRequest = StubXMLHttpRequest
        const captured: Headers[] = []
        const baseAuth = oauthAuth({
            getToken: () => 'old',
            refresh: async () => 'new',
        })
        const auth = {
            ...baseAuth,
            onResponse: (headers: Headers) => {
                captured.push(headers)
            },
        }
        const t = new FetchTransport({
            config: normalizeConfig({ url: 'https://example.com', auth }),
        })
        const res = await t.request({
            method: 'POST',
            url: '/upload',
            data: { a: 1 },
            onUploadProgress: () => undefined,
        })
        expect(res.data).toEqual({ ok: true })
        expect(sends).toBe(2)
        expect(captured.at(-1)?.get('x-a')).toBe('1')
    })

    it('does not retry XHR 401 when the auth strategy cannot refresh', async () => {
        class StubXMLHttpRequest {
            status = 401
            statusText = 'Unauthorized'
            response = '{"message":"expired"}'
            timeout = 0
            withCredentials = false
            responseType = 'text'
            upload = { onprogress: undefined as ((ev: ProgressEvent) => void) | undefined }
            ontimeout: (() => void) | null = null
            onabort: (() => void) | null = null
            onerror: (() => void) | null = null
            onload: (() => void) | null = null
            open() {}
            setRequestHeader() {}
            abort() {}
            getAllResponseHeaders() {
                return ''
            }
            send() {
                queueMicrotask(() => this.onload?.())
            }
        }
        ;(globalThis as any).XMLHttpRequest = StubXMLHttpRequest
        const t = new FetchTransport({
            config: normalizeConfig({ url: 'https://example.com', auth: anonymousAuth() }),
        })
        await expect(
            t.request({
                method: 'POST',
                url: '/upload',
                data: { a: 1 },
                onUploadProgress: () => undefined,
            }),
        ).rejects.toBeInstanceOf(AuthenticationError)
    })

    it('treats an empty XHR body as text', async () => {
        class StubXMLHttpRequest {
            status = 200
            statusText = 'OK'
            response = ''
            timeout = 0
            withCredentials = false
            responseType = 'text'
            upload = { onprogress: undefined as ((ev: ProgressEvent) => void) | undefined }
            ontimeout: (() => void) | null = null
            onabort: (() => void) | null = null
            onerror: (() => void) | null = null
            onload: (() => void) | null = null
            open() {}
            setRequestHeader() {}
            abort() {}
            getAllResponseHeaders() {
                return 'not-a-header'
            }
            send() {
                queueMicrotask(() => this.onload?.())
            }
        }
        ;(globalThis as any).XMLHttpRequest = StubXMLHttpRequest
        await expect(
            transport().request({
                method: 'POST',
                url: '/upload',
                data: { a: 1 },
                responseType: 'text',
                onUploadProgress: () => undefined,
            }),
        ).resolves.toMatchObject({ data: '' })

        StubXMLHttpRequest.prototype.send = function send(this: StubXMLHttpRequest) {
            this.response = { weird: true } as any
            queueMicrotask(() => this.onload?.())
        }
        const parsed = await transport().request({
            method: 'POST',
            url: '/upload',
            data: { a: 1 },
            onUploadProgress: () => undefined,
        })
        expect(parsed.data).toBe('[object Object]')

        StubXMLHttpRequest.prototype.send = function send(this: StubXMLHttpRequest) {
            this.response = null as any
            queueMicrotask(() => this.onload?.())
        }
        const emptyNull = await transport().request({
            method: 'POST',
            url: '/upload',
            data: { a: 1 },
            onUploadProgress: () => undefined,
        })
        expect(emptyNull.data).toBe('')
    })

    it('XHR maps timeout, abort, error, and non-2xx JSON/non-JSON', async () => {
        const xhrState: {
            mode:
                | 'timeout'
                | 'abort'
                | 'error'
                | 'fail-json'
                | 'fail-text'
                | 'fail-blob'
                | 'fail-arraybuffer'
                | 'ok-blob'
                | 'form'
            status: number
            response: unknown
        } = { mode: 'timeout', status: 417, response: '{"message":"nope","exc_type":"ValidationError"}' }

        class StubXMLHttpRequest {
            timeout = 0
            withCredentials = false
            responseType = 'text'
            status = 200
            statusText = 'OK'
            response: any = ''
            upload = { onprogress: undefined as any }
            ontimeout: (() => void) | null = null
            onabort: (() => void) | null = null
            onerror: (() => void) | null = null
            onload: (() => void) | null = null
            open() {}
            setRequestHeader() {}
            abort() {
                this.onabort?.()
            }
            send() {
                this.status = xhrState.status
                this.response = xhrState.response
                queueMicrotask(() => {
                    if (xhrState.mode === 'timeout') this.ontimeout?.()
                    else if (xhrState.mode === 'abort') this.onabort?.()
                    else if (xhrState.mode === 'error') this.onerror?.()
                    else this.onload?.()
                })
            }
        }
        ;(globalThis as any).XMLHttpRequest = StubXMLHttpRequest
        const progress = () => undefined

        const constructorAbort = new AbortController()
        const OriginalStub = (globalThis as any).XMLHttpRequest
        ;(globalThis as any).XMLHttpRequest = class extends OriginalStub {
            constructor() {
                super()
                constructorAbort.abort()
            }
        }
        await expect(
            transport().request({
                method: 'GET',
                url: '/x',
                onUploadProgress: progress,
                signal: constructorAbort.signal,
            }),
        ).rejects.toBeInstanceOf(CancelledError)
        ;(globalThis as any).XMLHttpRequest = OriginalStub

        await expect(
            transport({ timeout: 5 }).request({ method: 'GET', url: '/x', onUploadProgress: progress }),
        ).rejects.toBeInstanceOf(TimeoutError)

        xhrState.mode = 'abort'
        const already = new AbortController()
        already.abort()
        await expect(
            transport().request({ method: 'GET', url: '/x', onUploadProgress: progress, signal: already.signal }),
        ).rejects.toBeInstanceOf(CancelledError)

        const c = new AbortController()
        const p = transport().request({ method: 'GET', url: '/x', onUploadProgress: progress, signal: c.signal })
        await Promise.resolve()
        c.abort()
        await expect(p).rejects.toBeInstanceOf(CancelledError)

        xhrState.mode = 'error'
        await expect(
            transport().request({ method: 'GET', url: '/x', onUploadProgress: progress }),
        ).rejects.toBeInstanceOf(TransportError)

        xhrState.mode = 'fail-json'
        await expect(
            transport().request({ method: 'GET', url: '/x', onUploadProgress: progress }),
        ).rejects.toMatchObject({
            status: 417,
        })

        xhrState.mode = 'fail-text'
        xhrState.status = 500
        xhrState.response = '<html>'
        await expect(
            transport().request({ method: 'GET', url: '/x', onUploadProgress: progress }),
        ).rejects.toMatchObject({
            status: 500,
        })

        xhrState.response = { message: 'object-body' }
        await expect(
            transport().request({ method: 'GET', url: '/x', onUploadProgress: progress }),
        ).rejects.toMatchObject({
            status: 500,
        })

        xhrState.mode = 'fail-blob'
        xhrState.status = 500
        xhrState.response = new Blob(['{"exception":"boom"}'])
        await expect(
            transport().request({ method: 'GET', url: '/x', responseType: 'blob', onUploadProgress: progress }),
        ).rejects.toMatchObject({ status: 500 })

        xhrState.mode = 'fail-arraybuffer'
        xhrState.response = new TextEncoder().encode('{"exception":"boom"}').buffer
        await expect(
            transport().request({ method: 'GET', url: '/x', responseType: 'arraybuffer', onUploadProgress: progress }),
        ).rejects.toMatchObject({ status: 500 })

        xhrState.mode = 'ok-blob'
        xhrState.status = 200
        xhrState.response = new Blob(['x'])
        const blobRes = await transport().request({
            method: 'GET',
            url: '/x',
            responseType: 'blob',
            onUploadProgress: progress,
        })
        expect(blobRes.data).toBeInstanceOf(Blob)

        xhrState.mode = 'form'
        xhrState.response = 'ok'
        const form = new FormData()
        form.append('f', '1')
        await transport().request({ method: 'POST', url: '/x', data: form, onUploadProgress: progress })

        vi.stubGlobal('window', { location: { hostname: 'frappe.local' } })
        vi.stubGlobal('document', {})
        await transport().request({ method: 'POST', url: '/x', data: { a: 1 }, onUploadProgress: progress })
    })

    it('XHR: throwing onResponse routes the error to the outer rejection, no unhandled promise', async () => {
        stubXhr()
        const auth = {
            name: 'boom',
            apply() {},
            onResponse() {
                throw new Error('onResponse exploded')
            },
        }
        await expect(
            transport({ auth }).request({ method: 'GET', url: '/x', onUploadProgress: () => undefined }),
        ).rejects.toThrow('onResponse exploded')
    })

    it('XHR: rejecting refreshAuth routes the error to the outer rejection', async () => {
        const sent = stubXhr({ status: 401, response: '{"message":"expired"}' })
        const auth = {
            name: 'failing-refresh',
            apply() {},
            async onUnauthorized() {
                throw new Error('refresh network failure')
            },
        }
        await expect(
            transport({ auth }).request({ method: 'GET', url: '/x', onUploadProgress: () => undefined }),
        ).rejects.toThrow('refresh network failure')
        expect(sent).toHaveLength(1)
    })

    it('XHR: abort during refresh does not send a replay XHR', async () => {
        const sent = stubXhr({ status: 401, response: '{"message":"expired"}' })
        let resolveRefresh!: (value: boolean) => void
        const controller = new AbortController()
        const auth = {
            name: 'slow-refresh',
            apply() {},
            async onUnauthorized() {
                controller.abort()
                return new Promise<boolean>((resolve) => {
                    resolveRefresh = resolve
                })
            },
        }
        const pending = expect(
            transport({ auth }).request({
                method: 'GET',
                url: '/x',
                onUploadProgress: () => undefined,
                signal: controller.signal,
            }),
        ).rejects.toBeInstanceOf(CancelledError)
        await vi.waitFor(() => expect(resolveRefresh).toBeTypeOf('function'))
        resolveRefresh(true)
        await pending
        expect(sent).toHaveLength(1)
    })

    it('aborts the underlying XHR when the operation deadline expires', async () => {
        let aborted = 0
        class PendingXMLHttpRequest {
            timeout = 0
            withCredentials = false
            responseType = 'text'
            upload = { onprogress: undefined as any }
            ontimeout: (() => void) | null = null
            onabort: (() => void) | null = null
            onerror: (() => void) | null = null
            onload: (() => void) | null = null
            open() {}
            setRequestHeader() {}
            send() {}
            abort() {
                aborted++
                this.onabort?.()
            }
        }
        ;(globalThis as any).XMLHttpRequest = PendingXMLHttpRequest

        await expect(
            transport().request({
                method: 'POST',
                url: '/x',
                data: new FormData(),
                onUploadProgress: () => undefined,
                deadline: Date.now() + 5,
            }),
        ).rejects.toBeInstanceOf(TimeoutError)
        expect(aborted).toBe(1)
    })

    it('sets X-Frappe-Site-Name from window.location in a browser without siteName, and does not send credentials for anonymousAuth', async () => {
        vi.stubGlobal('window', { location: { hostname: 'frappe.local' } })
        vi.stubGlobal('document', {})
        globalThis.fetch = vi.fn(async (_url, init: any) => {
            expect(init.headers['X-Frappe-Site-Name']).toBe('frappe.local')
            expect(init.headers.Host).toBeUndefined() // Host is a forbidden header name in browsers
            expect(init.credentials).toBe('same-origin')
            return jsonResponse({})
        }) as any
        await transport().request({ method: 'GET', url: '/x' })
    })

    it('does not set the Host header in a browser even when siteName is configured', async () => {
        vi.stubGlobal('window', { location: { hostname: 'frappe.local' } })
        vi.stubGlobal('document', {})
        globalThis.fetch = vi.fn(async (_url, init: any) => {
            expect(init.headers.Host).toBeUndefined()
            expect(init.headers['X-Frappe-Site-Name']).toBe('site.localhost')
            return jsonResponse({})
        }) as any
        await transport({ siteName: 'site.localhost' }).request({ method: 'GET', url: '/x' })
    })

    it('defaults credentials to include for cookieAuth in a browser', async () => {
        vi.stubGlobal('window', { location: { hostname: 'frappe.local' } })
        vi.stubGlobal('document', { cookie: '', querySelector: () => null })
        globalThis.fetch = vi.fn(async (_url, init: any) => {
            expect(init.credentials).toBe('include')
            return jsonResponse({})
        }) as any
        const t = new FetchTransport({
            config: normalizeConfig({
                url: 'https://example.com',
                auth: (await import('../../src/core/auth')).cookieAuth(),
            }),
        })
        await t.request({ method: 'GET', url: '/x' })
    })

    it('logs a non-Frappe error thrown by middleware', async () => {
        const debug = vi.fn()
        globalThis.fetch = vi.fn(async () => jsonResponse({})) as any
        const t = new FetchTransport({
            config: normalizeConfig({
                url: 'https://example.com',
                logger: { debug },
                middleware: [
                    async () => {
                        throw new Error('mw')
                    },
                ],
            }),
        })
        await expect(t.request({ method: 'GET', url: '/x' })).rejects.toThrow('mw')
        expect(debug.mock.calls[0][0]).toMatchObject({ error: 'Error', path: '/x' })

        debug.mockClear()
        const nonErrorRejection = { type: 'non-error-rejection' as const }
        const t2 = new FetchTransport({
            config: normalizeConfig({
                url: 'https://example.com',
                logger: { debug },
                middleware: [
                    async () => {
                        throw nonErrorRejection
                    },
                ],
            }),
        })
        await expect(t2.request({ method: 'GET', url: '/x' })).rejects.toBe(nonErrorRejection)
        expect(debug.mock.calls[0][0]).toMatchObject({ error: 'UnknownError', path: '/x' })
    })

    it('throws ConfigurationError when onUploadProgress is combined with middleware', async () => {
        globalThis.fetch = vi.fn(async () => jsonResponse({})) as any
        await expect(
            transport({
                middleware: [async (req: any, next: any) => next(req)],
            }).request({
                method: 'POST',
                url: '/x',
                data: { a: 1 },
                onUploadProgress: () => undefined,
                deadline: Date.now() + 5_000,
            }),
        ).rejects.toBeInstanceOf(ConfigurationError)
        expect(globalThis.fetch).not.toHaveBeenCalled()
    })

    it('maps an empty non-2xx body', async () => {
        globalThis.fetch = vi.fn(async () => new Response('', { status: 500 })) as any
        await expect(transport().request({ method: 'GET', url: '/x' })).rejects.toMatchObject({ status: 500 })
    })

    it('maps a non-2xx response returned by middleware to ServerError', async () => {
        globalThis.fetch = vi.fn(async () => jsonResponse({})) as any
        await expect(
            transport({
                middleware: [
                    async () => ({
                        status: 500,
                        statusText: 'Internal Server Error',
                        headers: new Headers(),
                        body: { message: 'mw-fail', _server_messages: '[]' },
                        responseText: '{"message":"mw-fail"}',
                    }),
                ],
            }).request({ method: 'GET', url: '/x' }),
        ).rejects.toMatchObject({
            name: 'ServerError',
            status: 500,
            message: 'mw-fail',
        })
        expect(globalThis.fetch).not.toHaveBeenCalled()
    })

    it('maps a thrown DOMException TimeoutError to TimeoutError', async () => {
        globalThis.fetch = vi.fn(async () => {
            throw new DOMException('Timeout', 'TimeoutError')
        }) as any
        await expect(transport().request({ method: 'GET', url: '/x' })).rejects.toBeInstanceOf(TimeoutError)
    })

    it('maps a body-read failure through mapNetworkError', async () => {
        globalThis.fetch = vi.fn(async () => {
            const res = jsonResponse({ data: 1 })
            res.text = async () => {
                throw new TypeError('body failed')
            }
            return res
        }) as any
        await expect(transport().request({ method: 'GET', url: '/x' })).rejects.toBeInstanceOf(TransportError)
    })

    it('returns the raw text when a successful (2xx) body is not valid JSON', async () => {
        globalThis.fetch = vi.fn(async () => new Response('not json', { status: 200 })) as any
        const result = await transport().request({ method: 'GET', url: '/x' })
        expect(result.data).toBe('not json')
    })

    it('aborts immediately when `deadline` has already elapsed before the first attempt', async () => {
        globalThis.fetch = vi.fn((_url: string, init: { signal?: AbortSignal }) => {
            return new Promise((_resolve, reject) => {
                if (init.signal?.aborted) {
                    reject(init.signal.reason)
                    return
                }
                init.signal?.addEventListener('abort', () => reject(init.signal?.reason))
            })
        }) as any
        await expect(
            transport().request({ method: 'GET', url: '/x', deadline: Date.now() - 1 } as any),
        ).rejects.toBeInstanceOf(TimeoutError)
    })

    it('aborts via a deadline that has not elapsed yet, once the timer fires', async () => {
        vi.useFakeTimers()
        globalThis.fetch = vi.fn((_url: string, init: { signal?: AbortSignal }) => {
            return new Promise((_resolve, reject) => {
                init.signal?.addEventListener('abort', () => reject(init.signal?.reason))
            })
        }) as any
        const pending = transport().request({ method: 'GET', url: '/x', deadline: Date.now() + 50 } as any)
        const settled = pending.then(
            () => undefined,
            (error) => error,
        )
        await vi.advanceTimersByTimeAsync(60)
        expect(await settled).toBeInstanceOf(TimeoutError)
        vi.useRealTimers()
    })

    it('times out if the deadline elapses while reading the body', async () => {
        vi.useFakeTimers()
        globalThis.fetch = vi.fn(async () => {
            const res = jsonResponse({ data: 1 })
            res.text = () =>
                new Promise<string>((resolve) => {
                    setTimeout(() => resolve('{"data":1}'), 20)
                })
            return res
        }) as any
        const pending = transport({ timeout: 5 }).request({ method: 'GET', url: '/x' })
        const settled = pending.then(
            () => undefined,
            (error) => error,
        )
        await vi.advanceTimersByTimeAsync(25)
        expect(await settled).toBeInstanceOf(TimeoutError)
        vi.useRealTimers()
    })
})

describe('getSetCookieHeader', () => {
    it('prefers getSetCookie() and falls back to a single set-cookie header', () => {
        expect(getSetCookieHeader({ getSetCookie: () => ['a=1', 'b=2'] } as any)).toEqual(['a=1', 'b=2'])
        expect(getSetCookieHeader({ getSetCookie: () => [] } as any)).toBeUndefined()
        expect(getSetCookieHeader({ get: (n: string) => (n === 'set-cookie' ? 'a=1' : null) } as any)).toEqual(['a=1'])
        expect(getSetCookieHeader({ get: () => null } as any)).toBeUndefined()
    })
})
