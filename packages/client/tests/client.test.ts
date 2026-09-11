import { describe, expect, it, vi } from 'vitest'

import { getClientInternal } from '../src/client'
import { cookieAuth } from '../src/core/auth'
import { anonymousAuth, createFrappeClient, tokenAuth } from '../src/index'

describe('createFrappeClient', () => {
    it('defaults to apiVersion 2 and a 30s timeout', () => {
        const client = createFrappeClient({ url: 'https://example.com' })
        expect(client.config.apiVersion).toBe(2)
        expect(client.config.timeout).toBe(30_000)
    })

    it('is immutable — withAuth returns a new client and leaves the original untouched', () => {
        const original = createFrappeClient({ url: 'https://example.com', auth: anonymousAuth() })
        const derived = original.withAuth(tokenAuth({ apiKey: 'k', apiSecret: 's' }))

        expect(derived).not.toBe(original)
        expect(original.config.auth.name).toBe('anonymous')
        expect(derived.config.auth.name).toBe('token')
    })

    it('withHeaders merges rather than replaces', () => {
        const original = createFrappeClient({ url: 'https://example.com', headers: { 'X-A': '1' } })
        const derived = original.withHeaders({ 'X-B': '2' })
        expect(derived.config.headers).toEqual({ 'X-A': '1', 'X-B': '2' })
        expect(original.config.headers).toEqual({ 'X-A': '1' })
    })

    it('withMiddleware appends to the existing pipeline', () => {
        const mw1 = async (req: any, next: any) => next(req)
        const mw2 = async (req: any, next: any) => next(req)
        const original = createFrappeClient({ url: 'https://example.com', middleware: [mw1] })
        const derived = original.withMiddleware(mw2)
        expect(derived.config.middleware).toEqual([mw1, mw2])
        expect(original.config.middleware).toEqual([mw1])
    })

    it('exposes every core module', () => {
        const client = createFrappeClient({ url: 'https://example.com' })
        expect(client.auth).toBeDefined()
        expect(client.db).toBeDefined()
        expect(client.file).toBeDefined()
        expect(client.call).toBeDefined()
        expect(client.search).toBeDefined()
    })

    it('builds a v1 client and exposes __internal for frappe-js-client/extended', () => {
        const client = createFrappeClient({ url: 'https://example.com', apiVersion: 1 })
        expect(client.config.apiVersion).toBe(1)
        expect(getClientInternal(client).transport).toBeDefined()
        expect(getClientInternal(client).deps.adapter.version).toBe(1)
        expect(() => getClientInternal({} as any)).toThrow(/createFrappeClient/)
    })

    it('captures Set-Cookie onto cookieAuth after a response, via AuthStrategy.onResponse', async () => {
        const original = globalThis.fetch
        globalThis.fetch = vi.fn(
            async () =>
                new Response(JSON.stringify({ data: 'pong' }), {
                    status: 200,
                    headers: { 'Set-Cookie': 'sid=abc; Path=/' },
                }),
        ) as any
        const auth = cookieAuth()
        const client = createFrappeClient({ url: 'https://example.com', auth })
        await client.auth.ping()
        expect(auth.jar.get('sid')?.value).toBe('abc')
        globalThis.fetch = original
    })

    it('works fine with an auth strategy that has no onResponse hook', async () => {
        const original = globalThis.fetch
        globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ data: 'pong' }), { status: 200 })) as any
        const client = createFrappeClient({ url: 'https://example.com' })
        await expect(client.auth.ping()).resolves.toBe('pong')
        globalThis.fetch = original
    })
})
