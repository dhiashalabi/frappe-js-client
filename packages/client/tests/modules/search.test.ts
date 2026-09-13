import { describe, expect, it } from 'vitest'

import { createTestClient } from '../../src/testing'

describe('FrappeSearch', () => {
    it('rejects an unexpected search_link response shape', async () => {
        const { client, transport } = createTestClient()
        transport.mock({
            method: 'GET',
            path: '/api/v2/method/frappe.desk.search.search_link',
            body: { data: { unexpected: true } },
        })

        await expect(client.search.searchLink('User', 'a')).rejects.toMatchObject({ name: 'ResponseError' })
    })
    it('searchLink queries frappe.desk.search.search_link', async () => {
        const { client, transport } = createTestClient()
        transport.mock({
            method: 'GET',
            path: '/api/v2/method/frappe.desk.search.search_link',
            body: { data: [{ value: 'x', description: 'y' }] },
        })
        const result = await client.search.searchLink('User', 'adm')
        expect(result).toEqual([{ value: 'x', description: 'y' }])
        const { client: c2, transport: t2 } = createTestClient()
        t2.mock({
            method: 'GET',
            path: '/api/v2/method/frappe.desk.search.search_link',
            body: { data: [] },
        })
        await c2.search.searchLink('User', 'adm', {
            query: 'q',
            filters: {},
            pageLength: 10,
            searchField: 'name',
            referenceDoctype: 'ToDo',
            ignoreUserPermissions: true,
            linkFieldname: 'user',
        })
        expect(t2.requests[0]?.params).toMatchObject({ query: 'q', page_length: 10, link_fieldname: 'user' })
    })

    it('normalizes the Frappe 14 `{results: [...]}` response shape', async () => {
        const { client, transport } = createTestClient()
        transport.mock({
            method: 'GET',
            path: '/api/v2/method/frappe.desk.search.search_link',
            body: { data: { results: [{ value: 'x', description: 'y' }] } },
        })
        await expect(client.search.searchLink('User', 'adm')).resolves.toEqual([{ value: 'x', description: 'y' }])
    })

    it('rejects an unrecognized response shape instead of hiding it as an empty result', async () => {
        const { client, transport } = createTestClient()
        transport.mock({
            method: 'GET',
            path: '/api/v2/method/frappe.desk.search.search_link',
            body: { data: { unexpected: true } },
        })
        await expect(client.search.searchLink('User', 'adm')).rejects.toMatchObject({ name: 'ResponseError' })
    })

    it('searchWidget queries frappe.desk.search.search_widget', async () => {
        const { client, transport } = createTestClient()
        transport.mock({ method: 'GET', path: '/api/v2/method/frappe.desk.search.search_widget', body: { data: [] } })
        await expect(client.search.searchWidget('User', 'adm', { start: 0 })).resolves.toEqual([])
        expect(transport.requests[0]?.params?.start).toBe(0)
        await client.search.searchWidget('User', 'adm', {
            query: 'q',
            filters: {},
            pageLength: 5,
            searchField: 'name',
            referenceDoctype: 'ToDo',
            ignoreUserPermissions: true,
            linkFieldname: 'user',
            filterFields: ['name'],
            asDict: true,
        })
    })

    it('searchWidget normalizes a Frappe 14 `{values}` envelope', async () => {
        const { client, transport } = createTestClient({ apiVersion: 1 })
        transport.mock({
            method: 'GET',
            path: '/api/method/frappe.desk.search.search_widget',
            body: { values: [['Administrator', 'Admin']] },
        })
        await expect(client.search.searchWidget('User', 'Adm')).resolves.toEqual([['Administrator', 'Admin']])
    })

    it('searchWidget accepts a returned array (Frappe 15+)', async () => {
        const { client, transport } = createTestClient()
        transport.mock({
            method: 'GET',
            path: '/api/v2/method/frappe.desk.search.search_widget',
            body: { data: [['Administrator']] },
        })
        await expect(client.search.searchWidget('User', 'Adm')).resolves.toEqual([['Administrator']])
    })

    it('searchWidget accepts a bare array body (unwrap none)', async () => {
        const { client, transport } = createTestClient({ apiVersion: 1 })
        transport.mock({
            method: 'GET',
            path: '/api/method/frappe.desk.search.search_widget',
            body: [['Administrator']],
        })
        await expect(client.search.searchWidget('User', 'Adm')).resolves.toEqual([['Administrator']])
    })

    it('searchWidget unwraps nested `{ data: { values } }` and `{ data: { message } }` envelopes', async () => {
        const nestedValues = createTestClient()
        nestedValues.transport.mock({
            method: 'GET',
            path: '/api/v2/method/frappe.desk.search.search_widget',
            body: { data: { values: [['Administrator']] } },
        })
        await expect(nestedValues.client.search.searchWidget('User', 'Adm')).resolves.toEqual([['Administrator']])

        const nestedMessage = createTestClient()
        nestedMessage.transport.mock({
            method: 'GET',
            path: '/api/v2/method/frappe.desk.search.search_widget',
            body: { data: { message: [['Guest']] } },
        })
        await expect(nestedMessage.client.search.searchWidget('User', 'G')).resolves.toEqual([['Guest']])
    })

    it('searchWidget returns non-array `data` / `message` / unrecognized bodies as-is', async () => {
        const dataObj = createTestClient()
        dataObj.transport.mock({
            method: 'GET',
            path: '/api/v2/method/frappe.desk.search.search_widget',
            body: { data: { unexpected: true } },
        })
        await expect(dataObj.client.search.searchWidget('User', 'x')).resolves.toEqual({ unexpected: true })

        const messageScalar = createTestClient({ apiVersion: 1 })
        messageScalar.transport.mock({
            method: 'GET',
            path: '/api/method/frappe.desk.search.search_widget',
            body: { message: 'ok' },
        })
        await expect(messageScalar.client.search.searchWidget('User', 'x')).resolves.toBe('ok')

        const unrecognized = createTestClient({ apiVersion: 1 })
        unrecognized.transport.mock({
            method: 'GET',
            path: '/api/method/frappe.desk.search.search_widget',
            body: { unexpected: true },
        })
        await expect(unrecognized.client.search.searchWidget('User', 'x')).resolves.toEqual({ unexpected: true })

        const scalar = createTestClient({ apiVersion: 1 })
        scalar.transport.mock({
            method: 'GET',
            path: '/api/method/frappe.desk.search.search_widget',
            body: 'none',
        })
        await expect(scalar.client.search.searchWidget('User', 'x')).resolves.toBe('none')

        const empty = createTestClient({ apiVersion: 1 })
        empty.transport.mock({
            method: 'GET',
            path: '/api/method/frappe.desk.search.search_widget',
            body: null,
        })
        await expect(empty.client.search.searchWidget('User', 'x')).resolves.toBeNull()
    })

    it('getLinkTitle queries frappe.desk.search.get_link_title', async () => {
        const { client, transport } = createTestClient()
        transport.mock({
            method: 'GET',
            path: '/api/v2/method/frappe.desk.search.get_link_title',
            body: { data: 'Administrator' },
        })
        await expect(client.search.getLinkTitle('User', 'Administrator')).resolves.toBe('Administrator')
    })
})
