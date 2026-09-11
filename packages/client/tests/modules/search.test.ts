import { describe, expect, it } from 'vitest'

import { createTestClient } from '../../src/testing'

describe('FrappeSearch', () => {
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

    it('falls back to an empty array for an unrecognized response shape', async () => {
        const { client, transport } = createTestClient()
        transport.mock({
            method: 'GET',
            path: '/api/v2/method/frappe.desk.search.search_link',
            body: { data: { unexpected: true } },
        })
        await expect(client.search.searchLink('User', 'adm')).resolves.toEqual([])
    })

    it('searchWidget queries frappe.desk.search.search_widget', async () => {
        const { client, transport } = createTestClient()
        transport.mock({ method: 'GET', path: '/api/v2/method/frappe.desk.search.search_widget', body: { data: [] } })
        await client.search.searchWidget('User', 'adm', { start: 0 })
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
