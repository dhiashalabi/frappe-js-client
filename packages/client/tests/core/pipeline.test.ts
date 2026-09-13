import { describe, expect, it, vi } from 'vitest'

import { createFrappeClient } from '../../src/client'
import { tokenAuth } from '../../src/core/auth'
import type { Transport, TransportRequest, TransportResponse } from '../../src/core/transport'

class RecordingTransport implements Transport {
    requests: TransportRequest[] = []
    async request<T>(request: TransportRequest): Promise<TransportResponse<T>> {
        this.requests.push(request)
        return { data: { data: { name: 'TASK-1' } } as T, status: 200, statusText: 'OK', headers: new Headers() }
    }
}

describe('shared request pipeline', () => {
    it('prepares custom transport requests and preserves derived-client policy', async () => {
        const transport = new RecordingTransport()
        const middleware = vi.fn(async (request, next) => next(request))
        const client = createFrappeClient({
            url: 'https://frappe.example.com',
            frappeVersion: 16,
            transport,
        })
            .withAuth(tokenAuth({ apiKey: 'key', apiSecret: 'secret' }))
            .withHeaders({ 'X-Client': 'yes' })
            .withMiddleware(middleware)
        await client.db.getDoc('ToDo', 'TASK-1')
        expect(transport.requests).toHaveLength(1)
        expect(transport.requests[0]).toMatchObject({
            url: 'https://frappe.example.com/api/v2/document/ToDo/TASK-1',
            method: 'GET',
            headers: { Authorization: 'token key:secret', 'X-Client': 'yes' },
        })
        expect(middleware).toHaveBeenCalledOnce()
    })

    it('maps custom transport errors and preserves response metadata', async () => {
        const payload: Record<string, unknown> = { exc_type: 'ValidationError', message: 'bad request' }
        const transport: Transport = {
            request: async <T>() => ({ data: payload as T, status: 417, statusText: 'Expectation Failed', headers: new Headers({ 'retry-after': '1' }) }),
        }
        const client = createFrappeClient({ url: 'https://frappe.example.com', frappeVersion: 16, transport })
        await expect(client.db.getDoc('ToDo', 'x')).rejects.toMatchObject({ name: 'ValidationError', status: 417, statusText: 'Expectation Failed' })

        const stringTransport: Transport = { request: async <T>() => ({ data: 'server failed' as T, status: 500, statusText: 'Internal Server Error', headers: new Headers() }) }
        await expect(createFrappeClient({ url: 'https://frappe.example.com', frappeVersion: 16, transport: stringTransport }).db.getDoc('ToDo', 'x')).rejects.toMatchObject({ status: 500 })

        const cyclic: Record<string, unknown> = {}
        cyclic.self = cyclic
        const cyclicTransport: Transport = { request: async <T>() => ({ data: cyclic as T, status: 500, statusText: 'Internal Server Error', headers: new Headers() }) }
        await expect(createFrappeClient({ url: 'https://frappe.example.com', frappeVersion: 16, transport: cyclicTransport }).db.getDoc('ToDo', 'x')).rejects.toMatchObject({ status: 500 })
    })
})
