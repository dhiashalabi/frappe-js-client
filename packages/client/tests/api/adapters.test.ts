import { describe, expect, it } from 'vitest'

import { createCapabilities } from '../../src/api/adapter'
import { V1Adapter } from '../../src/api/v1'
import { V2Adapter } from '../../src/api/v2'
import { FeatureNotSupportedError } from '../../src/core/errors'

describe('createCapabilities', () => {
    it('is conservative when frappeVersion is unset', () => {
        expect(createCapabilities(2)).toEqual({ validateLinkAndFetch: false, restListHonorsExtendedFilters: false })
    })

    it('resolves validateLinkAndFetch only for Frappe 16', () => {
        expect(createCapabilities(2, 15).validateLinkAndFetch).toBe(false)
        expect(createCapabilities(2, 16).validateLinkAndFetch).toBe(true)
    })

    it('resolves restListHonorsExtendedFilters for apiVersion 1 (always) and v2+Frappe15', () => {
        expect(createCapabilities(1).restListHonorsExtendedFilters).toBe(true)
        expect(createCapabilities(1, 16).restListHonorsExtendedFilters).toBe(true)
        expect(createCapabilities(2, 15).restListHonorsExtendedFilters).toBe(true)
        expect(createCapabilities(2, 16).restListHonorsExtendedFilters).toBe(false)
    })
})

describe('V1Adapter', () => {
    const adapter = new V1Adapter()

    it('builds classic paths', () => {
        expect(adapter.method('frappe.ping')).toBe('/api/method/frappe.ping')
        expect(adapter.classicMethod('login')).toBe('/api/method/login')
        expect(adapter.getDoc('User', 'Administrator').url).toBe('/api/resource/User/Administrator')
    })

    it('create POSTs to the resource collection', () => {
        expect(adapter.create('User', { name: 'x' })).toMatchObject({
            method: 'POST',
            url: '/api/resource/User',
            unwrap: 'data',
        })
    })

    it('update uses PUT', () => {
        expect(adapter.update('User', 'x', {}).method).toBe('PUT')
    })

    it('delete discards the envelope (unwrap: none)', () => {
        expect(adapter.delete('User', 'x').unwrap).toBe('none')
    })

    it('list unwraps: none, and reads it out of the classic {data} envelope', () => {
        const req = adapter.list('User')
        expect(req.unwrap).toBe('none')
        expect(req.url).toBe('/api/resource/User')
    })

    it('throws FeatureNotSupportedError for v2-only operations', () => {
        expect(() => adapter.meta('User')).toThrow(FeatureNotSupportedError)
        expect(() => adapter.copy('User', 'x')).toThrow(FeatureNotSupportedError)
        expect(() => adapter.docMethod('User', 'x', 'submit')).toThrow(FeatureNotSupportedError)
        expect(() => adapter.controllerMethod('User', 'x')).toThrow(FeatureNotSupportedError)
        expect(() => adapter.runDocMethod('x', {})).toThrow(FeatureNotSupportedError)
    })

    it('unwrapList reads the classic {data} envelope, tolerating non-array/missing shapes', () => {
        expect(adapter.unwrapList(null)).toEqual({ data: [] })
        expect(adapter.unwrapList({ data: { not: 'array' } })).toEqual({ data: [] })
        expect(adapter.unwrapList({ data: [1] })).toEqual({ data: [1] })
        expect(adapter.unwrapList([1, 2])).toEqual({ data: [1, 2] })
    })

    it('count / rename / submit / cancel build the classic RPC requests', () => {
        expect(adapter.count('User', { filters: [['name', '=', 'x']], debug: true, cache: true }).url).toBe(
            '/api/method/frappe.client.get_count',
        )
        expect(adapter.rename('User', 'a', 'b', true).data).toMatchObject({ merge: true })
        expect(adapter.submit('ToDo', 'x', { name: 'x' }).url).toBe('/api/method/frappe.client.submit')
        expect(adapter.cancel('ToDo', 'x').data).toEqual({ doctype: 'ToDo', name: 'x' })
    })

    it('list with no args, with an orderBy, and getDoc with expandLinks', () => {
        expect(adapter.list('User').params).toEqual({})
        expect(adapter.list('User', { limit: 5 }).params).toMatchObject({ limit: 5, order_by: undefined })
        expect(adapter.list('User', { orderBy: { field: 'name' } }).params).toMatchObject({
            order_by: 'name asc',
        })
        expect(adapter.list('User', { orderBy: { field: 'name', order: 'desc' } }).params).toMatchObject({
            order_by: 'name desc',
        })
        expect(adapter.getDoc('User', 'x', { expandLinks: true }).params).toEqual({ expand_links: 1 })
        expect(adapter.getDoc('User', 'x').params).toBeUndefined()
    })
})

describe('V2Adapter', () => {
    const adapter = new V2Adapter()

    it('builds v2 paths', () => {
        expect(adapter.method('frappe.ping')).toBe('/api/v2/method/frappe.ping')
        expect(adapter.getDoc('User', 'Administrator').url).toBe('/api/v2/document/User/Administrator')
        expect(adapter.meta('User').url).toBe('/api/v2/doctype/User/meta')
    })

    it('classicMethod always uses the classic path, regardless of apiVersion', () => {
        expect(adapter.classicMethod('login')).toBe('/api/method/login')
    })

    it('update uses PATCH', () => {
        expect(adapter.update('User', 'x', {}).method).toBe('PATCH')
    })

    it('never throws FeatureNotSupportedError — v2 supports every apiVersion-gated operation', () => {
        expect(() => adapter.meta('User')).not.toThrow()
        expect(() => adapter.copy('User', 'x')).not.toThrow()
        expect(() => adapter.docMethod('User', 'x', 'submit')).not.toThrow()
        expect(() => adapter.controllerMethod('User', 'x')).not.toThrow()
        expect(() => adapter.runDocMethod('x', {})).not.toThrow()
    })

    it('list stays on REST for a plain query, and routes through the get_list RPC when orFilters/parent/expand need it and REST does not honor them', () => {
        const unknown = new V2Adapter() // frappeVersion unset -> conservative: RPC route for extended filters
        expect(unknown.list('User').url).toBe('/api/v2/document/User')
        const rpc = unknown.list('User', { orFilters: [['x', '=', 1]] })
        expect(rpc.url).toBe('/api/v2/method/frappe.client.get_list')
        expect(rpc.params).toMatchObject({ doctype: 'User', limit_page_length: 20, limit_start: 0 })

        const v15 = new V2Adapter(15) // v15 REST forwards or_filters/parent/expand verbatim
        expect(v15.list('User', { orFilters: [['x', '=', 1]] }).url).toBe('/api/v2/document/User')
        expect(
            v15.list('User', { orFilters: [['x', '=', 1]], parent: 'Task', expand: ['owner'] }).params,
        ).toMatchObject({ parent: 'Task' })
    })

    it('unwrapList normalizes REST ({data,has_next_page}), RPC ({message}), and bare-array shapes', () => {
        expect(adapter.unwrapList(null)).toEqual({ data: [] })
        expect(adapter.unwrapList({ data: [1, 2], has_next_page: true })).toEqual({ data: [1, 2], hasNextPage: true })
        expect(adapter.unwrapList({ message: [1] })).toEqual({ data: [1] })
        expect(adapter.unwrapList([1, 2])).toEqual({ data: [1, 2] })
    })

    it('count / rename / submit / cancel / copy build the v2 REST requests', () => {
        expect(adapter.count('User', { filters: [], debug: true }).url).toBe('/api/v2/doctype/User/count')
        expect(adapter.rename('User', 'a', 'b', false).url).toContain('/rename')
        expect(adapter.submit('ToDo', 'x').url).toContain('/submit')
        expect(adapter.cancel('ToDo', 'x').url).toContain('/cancel')
        expect(adapter.copy('ToDo', 'x').url).toContain('/copy')
    })

    it('controllerMethod and runDocMethod build the v2 RPC requests', () => {
        expect(adapter.controllerMethod('ToDo', 'do_thing').url).toBe('/api/v2/method/ToDo/do_thing')
        const req = adapter.runDocMethod('do_thing', { doctype: 'ToDo', name: 'x' }, { a: 1 })
        expect(req.url).toBe('/api/v2/method/run_doc_method')
        expect(req.data).toEqual({ method: 'do_thing', document: { doctype: 'ToDo', name: 'x' }, kwargs: { a: 1 } })
    })

    it('list with an orderBy on the REST route', () => {
        expect(adapter.list('User', { orderBy: { field: 'name' } }).params).toMatchObject({
            order_by: 'name asc',
        })
        expect(adapter.list('User', { orderBy: { field: 'name', order: 'desc' } }).params).toMatchObject({
            order_by: 'name desc',
        })
    })

    it('list routes through the RPC when orFilters/parent/expand are set, with an orderBy', () => {
        const req = adapter.list('User', { orFilters: [['x', '=', 1]], orderBy: { field: 'name', order: 'desc' } })
        expect(req.url).toBe('/api/v2/method/frappe.client.get_list')
        expect(req.params).toMatchObject({ order_by: 'name desc' })
        expect(adapter.list('User', { orFilters: [['x', '=', 1]], orderBy: { field: 'name' } }).params).toMatchObject({
            order_by: 'name asc',
        })

        expect(adapter.list('User', { parent: 'x' }).url).toBe('/api/v2/method/frappe.client.get_list')
        expect(adapter.list('User', { expand: ['owner'] }).url).toBe('/api/v2/method/frappe.client.get_list')
        expect(adapter.list('User', { orFilters: [] }).url).toBe('/api/v2/document/User')
    })

    it('unwrapList treats a non-array {data}/{message} as empty', () => {
        expect(adapter.unwrapList({ data: 'not-an-array' })).toEqual({ data: [], hasNextPage: undefined })
        expect(adapter.unwrapList({ message: 'not-an-array' })).toEqual({ data: [] })
    })
})

describe('list defaults', () => {
    it('v2 defaults to a 20-row page — never an unbounded fetch', () => {
        const req = new V2Adapter().list('User')
        expect(req.params?.limit).toBe(20)
    })
})
