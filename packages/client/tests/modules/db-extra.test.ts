import { describe, expect, it } from 'vitest'

import { createTestClient } from '../../src/testing'
import { fixtureUser } from '../../src/testing/fixtures'

describe('FrappeDB — remaining coverage', () => {
    it('getLastDoc fetches the most recent doc by name', async () => {
        const { client, transport } = createTestClient()
        transport.mock({
            method: 'GET',
            path: '/api/v2/document/ToDo',
            body: { data: [{ name: 'TD-0002' }] },
            once: true,
        })
        transport.mock({
            method: 'GET',
            path: '/api/v2/document/ToDo/TD-0002',
            body: { data: { name: 'TD-0002' } },
            once: true,
        })
        const last = await client.db.getLastDoc('ToDo')
        expect(last?.name).toBe('TD-0002')
    })

    it('getLastDoc returns null when nothing matches', async () => {
        const { client, transport } = createTestClient()
        transport.mock({ method: 'GET', path: '/api/v2/document/ToDo', body: { data: [] } })
        await expect(client.db.getLastDoc('ToDo')).resolves.toBeNull()
    })

    it('getCount uses the v2 doctype/count endpoint', async () => {
        const { client, transport } = createTestClient()
        transport.mock({ method: 'GET', path: '/api/v2/doctype/User/count', body: 4 })
        await expect(client.db.getCount('User')).resolves.toBe(4)
    })

    it('getCount uses the v1 RPC endpoint', async () => {
        const { client, transport } = createTestClient({ apiVersion: 1 })
        transport.mock({ method: 'GET', path: '/api/method/frappe.client.get_count', body: { message: 4 } })
        await expect(client.db.getCount('User')).resolves.toBe(4)
    })

    it('exists() derives from getCount', async () => {
        const { client, transport } = createTestClient()
        transport.mock({ method: 'GET', path: '/api/v2/doctype/User/count', body: 1 })
        await expect(client.db.exists('User', 'Administrator')).resolves.toBe(true)
    })

    it('getValue / setValue / getSingleValue / getSingle / setSingle', async () => {
        const { client, transport } = createTestClient()
        transport.mock({
            method: 'GET',
            path: '/api/v2/method/frappe.client.get_value',
            body: { data: { email: 'a@b.com' } },
        })
        transport.mock({ method: 'POST', path: '/api/v2/method/frappe.client.set_value', body: { data: fixtureUser } })
        transport.mock({ method: 'GET', path: '/api/v2/method/frappe.client.get_single_value', body: { data: 'x' } })
        transport.mock({ method: 'GET', path: '/api/v2/method/frappe.client.get', body: { data: fixtureUser } })

        await client.db.getValue('User', 'email')
        await client.db.setValue('User', 'Administrator', 'email', 'new@b.com')
        await client.db.getSingleValue('System Settings', 'country')
        await client.db.getSingle('System Settings')
        await client.db.setSingle('System Settings', { country: 'X' })
    })

    it('renameDoc uses the v2 document-method rename endpoint', async () => {
        const { client, transport } = createTestClient()
        transport.mock({ method: 'POST', path: '/api/v2/document/ToDo/x/method/rename', body: { data: 'y' } })
        await expect(client.db.renameDoc('ToDo', 'x', 'y')).resolves.toBe('y')
    })

    it('renameDoc uses the v1 RPC rename endpoint', async () => {
        const { client, transport } = createTestClient({ apiVersion: 1 })
        transport.mock({ method: 'POST', path: '/api/method/frappe.client.rename_doc', body: { message: 'y' } })
        await expect(client.db.renameDoc('ToDo', 'x', 'y')).resolves.toBe('y')
    })

    it('submit and cancel round-trip on v2', async () => {
        const { client, transport } = createTestClient()
        transport.mock({
            method: 'POST',
            path: '/api/v2/document/Sales Order/SO-1/method/submit',
            body: { data: fixtureUser },
        })
        transport.mock({
            method: 'POST',
            path: '/api/v2/document/Sales Order/SO-1/method/cancel',
            body: { data: fixtureUser },
        })
        await client.db.submit({ doctype: 'Sales Order', name: 'SO-1' } as any)
        await client.db.cancel('Sales Order', 'SO-1')
    })

    it('submit and cancel round-trip on v1', async () => {
        const { client, transport } = createTestClient({ apiVersion: 1 })
        transport.mock({ method: 'POST', path: '/api/method/frappe.client.submit', body: { message: fixtureUser } })
        transport.mock({ method: 'POST', path: '/api/method/frappe.client.cancel', body: { message: fixtureUser } })
        await client.db.submit({ doctype: 'Sales Order', name: 'SO-1' } as any)
        await client.db.cancel('Sales Order', 'SO-1')
    })

    it('copyDoc rejects with FeatureNotSupportedError on v1', async () => {
        const { client } = createTestClient({ apiVersion: 1 })
        await expect(client.db.copyDoc('Sales Order', 'SO-1')).rejects.toThrow(/apiVersion: 2/)
    })

    it('copyDoc works on v2', async () => {
        const { client, transport } = createTestClient()
        transport.mock({ method: 'GET', path: '/api/v2/document/Sales Order/SO-1/copy', body: { data: fixtureUser } })
        await client.db.copyDoc('Sales Order', 'SO-1')
    })

    it('runMethod rejects with FeatureNotSupportedError on v1', async () => {
        const { client } = createTestClient({ apiVersion: 1 })
        await expect(client.db.runMethod('Sales Order', 'SO-1', 'do_thing')).rejects.toThrow(/apiVersion: 2/)
    })

    it('deleteDoc rejects without a name', async () => {
        const { client } = createTestClient()
        await expect(client.db.deleteDoc('User')).rejects.toThrow(/document name/)
    })

    it('deleteDoc goes through the RPC envelope on v1 and a bare REST call on v2', async () => {
        const v2 = createTestClient()
        v2.transport.mock({ method: 'DELETE', path: '/api/v2/document/ToDo/x', body: 'x' })
        await v2.client.db.deleteDoc('ToDo', 'x')

        const v1 = createTestClient({ apiVersion: 1 })
        v1.transport.mock({ method: 'DELETE', path: '/api/resource/ToDo/x', body: { message: 'x' } })
        await v1.client.db.deleteDoc('ToDo', 'x')
    })

    it('rejects updateDoc without a name and covers remaining db branches', async () => {
        const { client, transport } = createTestClient()
        await expect(client.db.updateDoc('User', null, {})).rejects.toThrow(/document name/)

        transport.mock({
            method: 'GET',
            path: '/api/v2/document/User/a',
            body: { data: fixtureUser },
        })
        await client.db.getDoc('User', 'a', { expandLinks: true })

        transport.mock({
            method: 'GET',
            path: '/api/v2/method/frappe.client.get_value',
            body: { data: {} },
        })
        await client.db.getValue('User', ['email', 'first_name'], {
            filters: [['name', '=', 'a']],
            asDict: false,
            debug: true,
            parent: 'x',
        })

        transport.mock({ method: 'POST', path: '/api/v2/method/frappe.client.set_value', body: { data: fixtureUser } })
        await client.db.setValue('User', 'a', { email: 'z' })

        transport.mock({ method: 'GET', path: '/api/v2/doctype/User/count', body: 0 })
        await expect(client.db.exists('User', 'missing')).resolves.toBe(false)

        transport.mock({ method: 'GET', path: '/api/v2/doctype/User/meta', body: { data: { name: 'User' } } })
        await client.db.getMeta('User')

        transport.mock({ method: 'POST', path: '/api/v2/document/ToDo/x/method/do_thing', body: { data: 1 } })
        await client.db.runMethod('ToDo', 'x', 'do_thing', { a: 1 })

        // `parent` (and `orFilters`/`expand`) route through the `frappe.client.get_list` RPC by
        // default (conservative — `frappeVersion` is unset), since Frappe 16's v2 REST list does
        // not honor them (F6).
        transport.mock({
            method: 'GET',
            path: '/api/v2/method/frappe.client.get_list',
            body: { message: [fixtureUser] },
        })
        await client.db.getDocList('ToDo', {
            fields: ['name'],
            filters: [],
            orFilters: [],
            orderBy: { field: 'name', order: 'asc' },
            groupBy: 'name',
            limit: 5,
            start: 0,
            parent: 'x',
            debug: true,
            asDict: true,
            expand: ['owner'],
        })

        transport.mock({ method: 'GET', path: '/api/v2/document/ToDo', body: { data: [fixtureUser] } })
        const pages: unknown[] = []
        for await (const doc of client.db.paginate('ToDo')) {
            pages.push(doc)
        }
        expect(pages).toHaveLength(1)
    })
})
