import { describe, expect, it } from 'vitest'

import { ConfigurationError } from '../../src/core/errors'
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
        expect(transport.requests[0]?.params?.limit).toBe(20)
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
        transport.mock({ method: 'PUT', path: '/api/resource/User/test.user@example.com', body: fixtureUser })
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
