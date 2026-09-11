import { type FrappeClient } from 'frappe-js-client'
import { createTestClient } from 'frappe-js-client/testing'
import { describe, expect, it } from 'vitest'

import { fetchDocTypeMeta, fetchDocTypeMetas } from '../src/metadata'

function asClient(client: { db: FrappeClient['db'] }): FrappeClient {
    return client as FrappeClient
}

describe('fetchDocTypeMeta', () => {
    it('GETs /api/v2/doctype/{doctype}/meta and URL-encodes names with spaces', async () => {
        const { client, transport } = createTestClient()
        const raw = {
            name: 'Sales Order',
            fields: [{ fieldname: 'customer', fieldtype: 'Link' }],
            istable: 0 as const,
            issingle: 0 as const,
        }
        transport.mock({
            method: 'GET',
            path: '/api/v2/doctype/Sales Order/meta',
            body: { data: raw },
        })

        const meta = await fetchDocTypeMeta(asClient(client), 'Sales Order')

        expect(meta).toEqual(raw)
        expect(transport.requests).toHaveLength(1)
        expect(transport.requests[0]?.method).toBe('GET')
        expect(transport.requests[0]?.url).toBe('/api/v2/doctype/Sales%20Order/meta')
    })

    it('defaults missing optional fields without throwing', async () => {
        const { client, transport } = createTestClient()
        transport.mock({
            method: 'GET',
            path: '/api/v2/doctype/ToDo/meta',
            body: { data: { fields: [{ fieldname: 'status', fieldtype: 'Data' }] } },
        })

        const meta = await fetchDocTypeMeta(asClient(client), 'ToDo')

        expect(meta).toEqual({
            name: 'ToDo',
            fields: [{ fieldname: 'status', fieldtype: 'Data' }],
            istable: undefined,
            issingle: undefined,
        })
    })

    it('defaults missing fields to an empty array', async () => {
        const { client, transport } = createTestClient()
        transport.mock({
            method: 'GET',
            path: '/api/v2/doctype/Empty/meta',
            body: { data: {} },
        })
        const meta = await fetchDocTypeMeta(asClient(client), 'Empty')
        expect(meta).toEqual({
            name: 'Empty',
            fields: [],
            istable: undefined,
            issingle: undefined,
        })
    })

    it('propagates NotFoundError from the transport unchanged', async () => {
        const { client, transport } = createTestClient()
        transport.mock({
            method: 'GET',
            path: '/api/v2/doctype/Missing/meta',
            status: 404,
            body: { message: 'DocType Missing not found' },
        })

        await expect(fetchDocTypeMeta(asClient(client), 'Missing')).rejects.toThrow(/requires Frappe v15\+ REST API v2/)
        await expect(fetchDocTypeMeta(asClient(client), 'Missing')).rejects.toMatchObject({
            cause: { name: 'NotFoundError', status: 404 },
        })
    })

    it('rethrows other transport failures unchanged', async () => {
        const { client, transport } = createTestClient()
        transport.mock({
            method: 'GET',
            path: '/api/v2/doctype/Broken/meta',
            status: 500,
            body: { message: 'boom' },
        })
        await expect(fetchDocTypeMeta(asClient(client), 'Broken')).rejects.toMatchObject({
            name: 'ServerError',
            status: 500,
        })
    })

    it('rethrows non-Error failures unchanged', async () => {
        const { client } = createTestClient()
        client.db.getMeta = async () => {
            throw 'not-an-error'
        }
        await expect(fetchDocTypeMeta(asClient(client), 'ToDo')).rejects.toBe('not-an-error')
    })

    it('wraps FeatureNotSupportedError when the client is on apiVersion 1', async () => {
        const { client } = createTestClient({ apiVersion: 1 })
        await expect(fetchDocTypeMeta(asClient(client), 'User')).rejects.toThrow(/requires Frappe v15\+ REST API v2/)
        await expect(fetchDocTypeMeta(asClient(client), 'User')).rejects.toMatchObject({
            cause: { name: 'FeatureNotSupportedError' },
        })
    })
})

describe('fetchDocTypeMetas', () => {
    it('fetches doctypes in the given order and preserves that order', async () => {
        const { client, transport } = createTestClient()
        transport.mock({
            method: 'GET',
            path: '/api/v2/doctype/Customer/meta',
            body: { data: { name: 'Customer', fields: [] } },
        })
        transport.mock({
            method: 'GET',
            path: '/api/v2/doctype/Sales Order/meta',
            body: { data: { name: 'Sales Order', fields: [] } },
        })

        const metas = await fetchDocTypeMetas(asClient(client), ['Customer', 'Sales Order'])

        expect(metas.map((m) => m.name)).toEqual(['Customer', 'Sales Order'])
        expect(transport.requests.map((r) => r.url).sort()).toEqual(
            ['/api/v2/doctype/Customer/meta', '/api/v2/doctype/Sales%20Order/meta'].sort(),
        )
    })

    it('returns an empty array when given no doctypes', async () => {
        const { client } = createTestClient()
        expect(await fetchDocTypeMetas(asClient(client), [])).toEqual([])
    })
})
