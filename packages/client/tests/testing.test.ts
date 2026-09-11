import { describe, expect, it } from 'vitest'

import { CancelledError } from '../src/core/errors'
import { createExtendedTestClient, createTestClient, fixtureUser, MemoryTransport } from '../src/testing'

describe('MemoryTransport / testing helpers', () => {
    it('matches regex paths, one-shot routes, reset, and HTTP errors', async () => {
        const transport = new MemoryTransport()
        transport.mock({ method: 'get', path: /^\/api\/v2\/document\/User/, body: { data: fixtureUser } })
        const res = await transport.request({ method: 'GET', url: '/api/v2/document/User/a' })
        expect(res.data).toEqual({ data: fixtureUser })

        transport.mock({ method: 'GET', path: '/once', body: 1, once: true })
        await transport.request({ method: 'GET', url: '/once' })
        await expect(transport.request({ method: 'GET', url: '/once' })).rejects.toThrow(/no mocked route/)

        transport.reset()
        expect(transport.requests).toEqual([])

        transport.mock({ method: 'GET', path: '/missing', status: 404 })
        await expect(transport.request({ method: 'GET', url: '/missing' })).rejects.toMatchObject({ status: 404 })
    })

    it('honors an optional match() predicate when several routes share a path', async () => {
        const transport = new MemoryTransport()
        transport.mock({
            method: 'GET',
            path: '/api/v2/document/User',
            match: (req) => req.params?.q === 'yes',
            body: { data: fixtureUser },
        })
        await expect(
            transport.request({ method: 'GET', url: '/api/v2/document/User', params: { q: 'no' } }),
        ).rejects.toThrow(/no mocked route/)
        const res = await transport.request({ method: 'GET', url: '/api/v2/document/User', params: { q: 'yes' } })
        expect(res.data).toEqual({ data: fixtureUser })
    })

    it('throws CancelledError when the signal is already aborted', async () => {
        const transport = new MemoryTransport()
        const controller = new AbortController()
        controller.abort()
        await expect(transport.request({ method: 'GET', url: '/x', signal: controller.signal })).rejects.toBeInstanceOf(
            CancelledError,
        )
    })

    it('decodes a plain-string error body for mapServerError', async () => {
        const transport = new MemoryTransport()
        transport.mock({ method: 'GET', path: '/bad', status: 500, body: '<html>Server Error</html>' })
        await expect(transport.request({ method: 'GET', url: '/bad' })).rejects.toMatchObject({ status: 500 })
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
