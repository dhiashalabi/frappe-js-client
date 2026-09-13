import { describe, expect, it } from 'vitest'

import { createTestClient } from '../../src/testing'

describe('FrappeCall — the escape hatch', () => {
    it('get() issues a GET RPC and unwraps the envelope', async () => {
        const { client, transport } = createTestClient()
        transport.mock({ method: 'GET', path: '/api/v2/method/my_app.api.ping', body: { data: 'pong' } })
        await expect(client.call.get('my_app.api.ping')).resolves.toBe('pong')
    })

    it('post() sends the body as JSON', async () => {
        const { client, transport } = createTestClient()
        transport.mock({ method: 'POST', path: '/api/v2/method/my_app.api.create', body: { data: { ok: true } } })
        await client.call.post('my_app.api.create', { name: 'x' })
        expect(JSON.parse(String(transport.requests[0]?.body))).toEqual({ name: 'x' })
    })

    it('put() and delete() route to the right verb', async () => {
        const { client, transport } = createTestClient()
        transport.mock({ method: 'PUT', path: '/api/v2/method/my_app.api.update', body: { data: 1 } })
        transport.mock({ method: 'DELETE', path: '/api/v2/method/my_app.api.remove', body: { data: 1 } })
        await client.call.put('my_app.api.update', {})
        await client.call.delete('my_app.api.remove')
        expect(transport.requests[0]?.method).toBe('PUT')
        expect(transport.requests[1]?.method).toBe('DELETE')
    })

    it('doctypeMethod() rejects with FeatureNotSupportedError on v1', async () => {
        const { client } = createTestClient({ apiVersion: 1 })
        await expect(client.call.doctypeMethod('Sales Order', 'do_thing')).rejects.toThrow(/apiVersion: 2/)
    })

    it('doctypeMethod() calls the v2 controller shorthand', async () => {
        const { client, transport } = createTestClient()
        transport.mock({ method: 'POST', path: '/api/v2/method/Sales Order/do_thing', body: { data: 'ok' } })
        await expect(client.call.doctypeMethod('Sales Order', 'do_thing')).resolves.toBe('ok')
    })

    it('runDocMethod() rejects with FeatureNotSupportedError on v1', async () => {
        const { client } = createTestClient({ apiVersion: 1 })
        await expect(client.call.runDocMethod('do_thing', { doctype: 'ToDo', name: 'x' })).rejects.toThrow(
            /apiVersion: 2/,
        )
    })

    it('runDocMethod() posts to run_doc_method on v2', async () => {
        const { client, transport } = createTestClient()
        transport.mock({ method: 'POST', path: '/api/v2/method/run_doc_method', body: { data: 'ok' } })
        await client.call.runDocMethod('do_thing', { doctype: 'ToDo', name: 'x' }, { a: 1 })
        expect(JSON.parse(String(transport.requests[0]?.body))).toEqual({
            method: 'do_thing',
            document: { doctype: 'ToDo', name: 'x' },
            kwargs: { a: 1 },
        })
    })
})
