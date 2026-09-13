import { describe, expect, it } from 'vitest'

import { cookieAuth } from '../src/core/auth'
import type { TransportRequest } from '../src/core/transport'
import { createExtendedTestClient, createTestClient, fixtureUser, MemoryTransport } from '../src/testing'

describe('MemoryTransport / testing helpers', () => {
    const prepared = (url: string, overrides: Partial<TransportRequest> = {}): TransportRequest => ({
        method: 'GET',
        url: `https://test.local${url}`,
        headers: {},
        credentials: 'same-origin',
        ...overrides,
    })
    it('cookie auth receives an absolute URL and stores the mocked session', async () => {
        const auth = cookieAuth()
        const { client, transport } = createTestClient({ auth })
        transport.mock({
            method: 'POST',
            path: '/api/method/login',
            headers: { 'set-cookie': 'sid=test-session; Path=/' },
            body: { message: 'Logged In' },
        })
        await client.auth.login({ username: 'test', password: 'test' })
        expect(auth.jar.get('sid')?.value).toBe('test-session')
        transport.mock({ method: 'POST', path: '/api/method/logout', body: { message: 'ok' } })
        await client.auth.logout()
        expect(auth.jar.size).toBe(0)
    })
    it('matches regex paths, one-shot routes, reset, and HTTP errors', async () => {
        const transport = new MemoryTransport()
        transport.mock({ method: 'get', path: /^\/api\/v2\/document\/User/, body: { data: fixtureUser } })
        const res = await transport.request(prepared('/api/v2/document/User/a'))
        expect(res.data).toEqual({ data: fixtureUser })

        transport.mock({ method: 'GET', path: '/once', body: 1, once: true })
        await transport.request(prepared('/once'))
        await expect(transport.request(prepared('/once'))).rejects.toThrow(/no mocked route/)

        transport.reset()
        expect(transport.requests).toEqual([])

        transport.mock({ method: 'GET', path: '/missing', status: 404 })
        await expect(transport.request(prepared('/missing'))).resolves.toMatchObject({
            status: 404,
            statusText: 'Not Found',
        })
        transport.mock({ method: 'GET', path: '/custom-status', status: 299, statusText: 'Custom' })
        await expect(transport.request(prepared('/custom-status'))).resolves.toMatchObject({ statusText: 'Custom' })
        transport.mock({ method: 'GET', path: '/unknown-status', status: 299 })
        await expect(transport.request(prepared('/unknown-status'))).resolves.toMatchObject({ statusText: '' })
    })

    it('honors an optional match() predicate when several routes share a path', async () => {
        const transport = new MemoryTransport()
        transport.mock({
            method: 'GET',
            path: '/api/v2/document/User',
            match: (req) => new URL(req.url).searchParams.get('q') === 'yes',
            body: { data: fixtureUser },
        })
        await expect(transport.request(prepared('/api/v2/document/User?q=no'))).rejects.toThrow(/no mocked route/)
        const res = await transport.request(prepared('/api/v2/document/User?q=yes'))
        expect(res.data).toEqual({ data: fixtureUser })
    })

    it('refuses an already aborted prepared request', async () => {
        const transport = new MemoryTransport()
        const controller = new AbortController()
        controller.abort()
        await expect(transport.request(prepared('/x', { signal: controller.signal }))).rejects.toMatchObject({
            name: 'AbortError',
        })
    })

    it('returns a plain-string error body for pipeline mapping', async () => {
        const transport = new MemoryTransport()
        transport.mock({ method: 'GET', path: '/bad', status: 500, body: '<html>Server Error</html>' })
        await expect(transport.request(prepared('/bad'))).resolves.toMatchObject({
            status: 500,
            data: '<html>Server Error</html>',
        })
    })

    it('createTestClient can target v1 and createExtendedTestClient wires extra modules', () => {
        const v1 = createTestClient({ apiVersion: 1 })
        expect(v1.client.db).toBeDefined()
        const ext = createExtendedTestClient()
        expect(ext.client.workflow).toBeDefined()
        expect(ext.client.report).toBeDefined()
        expect(ext.client.desk).toBeDefined()
        expect(ext.client.permission).toBeDefined()
        expect(ext.client.site).toBeDefined()
        expect(fixtureUser.doctype).toBe('User')
    })
})
