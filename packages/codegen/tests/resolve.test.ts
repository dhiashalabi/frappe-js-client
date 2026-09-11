import { type FrappeClient } from 'frappe-js-client'
import { createTestClient } from 'frappe-js-client/testing'
import { describe, expect, it } from 'vitest'

import { DocTypeMeta } from '../src/metadata'
import { childTableDoctypes, fetchWithOptionalFollow, followChildTables, resolveDocTypes } from '../src/resolve'

function asClient(client: { db: FrappeClient['db'] }): FrappeClient {
    return client as FrappeClient
}

describe('childTableDoctypes', () => {
    it('collects Table and Table MultiSelect options', () => {
        const meta: DocTypeMeta = {
            name: 'Sales Order',
            fields: [
                { fieldname: 'items', fieldtype: 'Table', options: 'Sales Order Item' },
                {
                    fieldname: 'taxes',
                    fieldtype: 'Table MultiSelect',
                    options: 'Sales Taxes',
                },
                { fieldname: 'customer', fieldtype: 'Link', options: 'Customer' },
            ],
        }
        expect(childTableDoctypes(meta)).toEqual(['Sales Order Item', 'Sales Taxes'])
    })
})

describe('followChildTables', () => {
    it('fetches missing children and is cycle-safe', async () => {
        const { client, transport } = createTestClient()
        transport.mock({
            method: 'GET',
            path: '/api/v2/doctype/Sales Order Item/meta',
            body: {
                data: {
                    name: 'Sales Order Item',
                    fields: [
                        {
                            fieldname: 'nested',
                            fieldtype: 'Table',
                            options: 'Sales Order',
                        },
                        {
                            fieldname: 'taxes',
                            fieldtype: 'Table',
                            options: 'Sales Taxes and Charges',
                        },
                    ],
                },
            },
        })
        transport.mock({
            method: 'GET',
            path: '/api/v2/doctype/Sales Taxes and Charges/meta',
            body: {
                data: { name: 'Sales Taxes and Charges', fields: [] },
            },
        })

        const seeds: DocTypeMeta[] = [
            {
                name: 'Sales Order',
                fields: [
                    {
                        fieldname: 'items',
                        fieldtype: 'Table',
                        options: 'Sales Order Item',
                    },
                ],
            },
        ]

        const all = await followChildTables(asClient(client), seeds)
        const names = all.map((m) => m.name).sort()
        expect(names).toEqual(['Sales Order', 'Sales Order Item', 'Sales Taxes and Charges'])
    })

    it('does not re-fetch children already present in the seed set', async () => {
        const { client, transport } = createTestClient()
        const seeds: DocTypeMeta[] = [
            {
                name: 'Sales Order',
                fields: [
                    {
                        fieldname: 'items',
                        fieldtype: 'Table',
                        options: 'Sales Order Item',
                    },
                ],
            },
            { name: 'Sales Order Item', fields: [] },
        ]

        const all = await followChildTables(asClient(client), seeds)
        expect(all.map((m) => m.name).sort()).toEqual(['Sales Order', 'Sales Order Item'])
        expect(transport.requests).toHaveLength(0)
    })
})

describe('resolveDocTypes', () => {
    it('unions explicit names with DocTypes listed for a module', async () => {
        const { client, transport } = createTestClient()
        transport.mock({
            method: 'GET',
            path: '/api/v2/document/DocType',
            body: { data: [{ name: 'Sales Order' }, { name: 1 }] },
        })
        const names = await resolveDocTypes(asClient(client), {
            doctypes: ['Customer'],
            modules: ['Selling'],
        })
        expect(names.sort()).toEqual(['Customer', 'Sales Order'])
    })
})

describe('fetchWithOptionalFollow', () => {
    it('skips children when followTables is false', async () => {
        const { client, transport } = createTestClient()
        transport.mock({
            method: 'GET',
            path: '/api/v2/doctype/Sales Order/meta',
            body: {
                data: {
                    name: 'Sales Order',
                    fields: [
                        {
                            fieldname: 'items',
                            fieldtype: 'Table',
                            options: 'Sales Order Item',
                        },
                    ],
                },
            },
        })
        const metas = await fetchWithOptionalFollow(asClient(client), ['Sales Order'], false)
        expect(metas.map((m) => m.name)).toEqual(['Sales Order'])
        expect(transport.requests).toHaveLength(1)
    })

    it('follows children when followTables is true', async () => {
        const { client, transport } = createTestClient()
        transport.mock({
            method: 'GET',
            path: '/api/v2/doctype/Parent/meta',
            body: {
                data: {
                    name: 'Parent',
                    fields: [{ fieldname: 'rows', fieldtype: 'Table', options: 'Child Row' }],
                },
            },
        })
        transport.mock({
            method: 'GET',
            path: '/api/v2/doctype/Child Row/meta',
            body: { data: { name: 'Child Row', fields: [] } },
        })
        const metas = await fetchWithOptionalFollow(asClient(client), ['Parent'], true)
        expect(metas.map((m) => m.name).sort()).toEqual(['Child Row', 'Parent'])
    })
})
