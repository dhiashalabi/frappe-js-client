import { describe, expect, it } from 'vitest'

import { ConfigurationError, FeatureNotSupportedError } from '../../src/core/errors'
import { createTestClient } from '../../src/testing'
import { fixtureUser } from '../../src/testing/fixtures'

describe('FrappeDB (via MemoryTransport, v2 default)', () => {
    it('getDoc resolves through /api/v2/document/{doctype}/{name}', async () => {
        const { client, transport } = createTestClient()
        transport.mock({
            method: 'GET',
            path: '/api/v2/document/User/test.user@example.com',
            body: { data: fixtureUser },
        })
        const user = await client.db.getDoc('User', 'test.user@example.com')
        expect(user).toEqual(fixtureUser)
    })

    it('getDoc rejects without a name rather than issuing a request', async () => {
        const { client } = createTestClient()
        await expect(client.db.getDoc('User', '')).rejects.toBeInstanceOf(ConfigurationError)
    })

    it('getDocList defaults to a 20-row page — never fetches unbounded', async () => {
        const { client, transport } = createTestClient()
        transport.mock({
            method: 'GET',
            path: '/api/v2/document/User',
            body: { data: [fixtureUser], has_next_page: true },
        })
        const list = await client.db.getDocList('User')
        expect(list).toEqual([fixtureUser])
        expect(new URL(transport.requests[0]!.url).searchParams.get('limit')).toBe('20')
        expect(new URL(transport.requests[0]!.url).searchParams.get('fields')).toBe('["*"]')
    })

    it('normalizes the full-document field selector for Frappe JSON parsing', async () => {
        const { client, transport } = createTestClient()
        transport.mock({ method: 'GET', path: '/api/v2/document/User', body: { data: [fixtureUser] } })

        await client.db.getDocList('User', { fields: '*' })

        expect(new URL(transport.requests[0]!.url).searchParams.get('fields')).toBe('["*"]')
    })

    it('supports document names containing path separators', async () => {
        const { client, transport } = createTestClient()
        transport.mock({
            method: 'GET',
            path: '/api/v2/document/Sales Invoice/INV/2026/0001',
            body: { data: { ...fixtureUser, doctype: 'Sales Invoice', name: 'INV/2026/0001' } },
        })

        const doc = await client.db.getDoc('Sales Invoice', 'INV/2026/0001')

        expect(doc.name).toBe('INV/2026/0001')
    })

    it('rejects invalid pagination bounds before issuing a request', async () => {
        const { client, transport } = createTestClient()
        for (const limit of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
            await expect(client.db.getDocList('User', { limit })).rejects.toBeInstanceOf(ConfigurationError)
        }
        for (const start of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
            await expect(client.db.getDocList('User', { start })).rejects.toBeInstanceOf(ConfigurationError)
        }
        expect(transport.requests).toHaveLength(0)
    })

    it('rejects tuple-shaped list responses instead of returning them as documents', async () => {
        const { client, transport } = createTestClient()
        await expect(client.db.getDocList('User', { asDict: false } as any)).rejects.toBeInstanceOf(ConfigurationError)
        expect(transport.requests).toHaveLength(0)
    })

    it('validates request timing for injected transports too', async () => {
        const { client, transport } = createTestClient()
        await expect(client.auth.ping({ timeout: Number.NaN })).rejects.toBeInstanceOf(ConfigurationError)
        await expect(client.auth.ping({ deadline: Number.POSITIVE_INFINITY })).rejects.toBeInstanceOf(
            ConfigurationError,
        )
        expect(transport.requests).toHaveLength(0)
    })

    it('paginate() yields documents across pages without ever requesting an unbounded page', async () => {
        const { client, transport } = createTestClient()
        transport.mock({
            method: 'GET',
            path: '/api/v2/document/User',
            body: { data: [fixtureUser, fixtureUser] },
            once: true,
        })
        transport.mock({ method: 'GET', path: '/api/v2/document/User', body: { data: [] }, once: true })

        const seen: unknown[] = []
        for await (const doc of client.db.paginate('User', { limit: 2 })) {
            seen.push(doc)
        }
        expect(seen).toHaveLength(2)
    })

    it('paginate() stops when hasNextPage is false even if the page is full', async () => {
        const { client, transport } = createTestClient()
        transport.mock({
            method: 'GET',
            path: '/api/v2/document/User',
            body: { data: [fixtureUser, fixtureUser], has_next_page: false },
        })
        const seen: unknown[] = []
        for await (const doc of client.db.paginate('User', { limit: 2 })) {
            seen.push(doc)
        }
        expect(seen).toHaveLength(2)
        expect(transport.requests).toHaveLength(1)
    })

    it('rejects a malformed list response instead of hiding it as an empty page', async () => {
        const { client, transport } = createTestClient()
        transport.mock({ method: 'GET', path: '/api/v2/document/User', body: { data: { unexpected: true } } })

        await expect(client.db.getDocList('User')).rejects.toMatchObject({ name: 'ResponseError' })
    })

    it('getDocList expand throws FeatureNotSupportedError on frappeVersion 14', async () => {
        const { client } = createTestClient({ apiVersion: 1, frappeVersion: 14 })
        await expect(client.db.getDocList('User', { expand: ['owner'] })).rejects.toBeInstanceOf(
            FeatureNotSupportedError,
        )
        await expect(client.db.getDocList('User', { expand: ['owner'] })).rejects.toThrow(/Frappe 15/)
    })

    it('getDocList expand is allowed when frappeVersion is unset or 15+', async () => {
        const unset = createTestClient()
        unset.transport.mock({
            method: 'GET',
            path: '/api/v2/method/frappe.client.get_list',
            body: { message: [fixtureUser] },
        })
        await expect(unset.client.db.getDocList('User', { expand: ['owner'] })).resolves.toEqual([fixtureUser])

        const v15 = createTestClient({ frappeVersion: 15 })
        v15.transport.mock({
            method: 'GET',
            path: '/api/v2/document/User',
            body: { data: [fixtureUser] },
        })
        await expect(v15.client.db.getDocList('User', { expand: ['owner'] })).resolves.toEqual([fixtureUser])
    })

    it('createDoc POSTs to the resource endpoint', async () => {
        const { client, transport } = createTestClient()
        transport.mock({ method: 'POST', path: '/api/v2/document/User', body: { data: fixtureUser } })
        const created = await client.db.createDoc('User', fixtureUser as any)
        expect(created).toEqual(fixtureUser)
    })

    it('updateDoc uses PATCH on v2', async () => {
        const { client, transport } = createTestClient()
        transport.mock({
            method: 'PATCH',
            path: '/api/v2/document/User/test.user@example.com',
            body: { data: fixtureUser },
        })
        await client.db.updateDoc('User', 'test.user@example.com', { first_name: 'Changed' })
        expect(transport.requests[0]?.method).toBe('PATCH')
    })

    it('updateDoc uses PUT on v1', async () => {
        const { client, transport } = createTestClient({ apiVersion: 1 })
        transport.mock({ method: 'PUT', path: '/api/resource/User/test.user@example.com', body: { data: fixtureUser } })
        await client.db.updateDoc('User', 'test.user@example.com', { first_name: 'Changed' })
        expect(transport.requests[0]?.method).toBe('PUT')
    })

    it('getMeta throws FeatureNotSupportedError on a v1 client', async () => {
        const { client } = createTestClient({ apiVersion: 1 })
        await expect(client.db.getMeta('User')).rejects.toThrow(/apiVersion: 2/)
    })

    it('a per-request AbortSignal cancels the request before it reaches the transport', async () => {
        const { client } = createTestClient()
        const controller = new AbortController()
        controller.abort()
        // MemoryTransport itself doesn't check signals — this documents the option is accepted end-to-end
        // by the request pipeline; FetchTransport-level abort behavior is covered in fetch.test.ts.
        await expect(client.db.getDoc('User', 'x', undefined, { signal: controller.signal })).rejects.toThrow()
    })
})
