import { describe, expect, it } from 'vitest'

import {
    buildUrl,
    classicMethodPath,
    doctypeMethodPath,
    doctypePath,
    documentCopyPath,
    documentMethodPath,
    jsonParam,
    methodPath,
    resourcePath,
    toSearchParams,
} from '../../src/core/url'

describe('core/url — regression matrix', () => {
    const bases = [
        'https://example.com',
        'https://example.com/',
        'https://example.com/frappe',
        'https://example.com/frappe/',
    ]
    const paths = ['api/method/foo', '/api/method/foo', 'api/resource/User', '/api/resource/User']

    for (const base of bases) {
        for (const path of paths) {
            it(`resolves ${JSON.stringify(base)} + ${JSON.stringify(path)} without double-URL corruption`, () => {
                const url = buildUrl(base, path)
                expect(url).not.toMatch(/https?:\/\/.*https?:\/\//)
                expect(url.startsWith('https://example.com')).toBe(true)
            })
        }
    }

    it('returns an already-absolute path as-is (never double-prefixes it)', () => {
        const url = buildUrl('https://example.com', 'https://other.example.com/api/method/foo')
        expect(url).toBe('https://other.example.com/api/method/foo')
    })

    it('classicMethodPath never uses /api/v1', () => {
        expect(classicMethodPath('frappe.ping')).toBe('/api/method/frappe.ping')
    })

    it('methodPath branches on version', () => {
        expect(methodPath(1, 'frappe.ping')).toBe('/api/method/frappe.ping')
        expect(methodPath(2, 'frappe.ping')).toBe('/api/v2/method/frappe.ping')
    })

    it('resourcePath encodes doctype and name', () => {
        expect(resourcePath(1, 'Sales Order', 'SO-0001')).toBe('/api/resource/Sales%20Order/SO-0001')
        expect(resourcePath(2, 'Sales Order')).toBe('/api/v2/document/Sales%20Order')
    })

    it('rejects path traversal in segments', () => {
        expect(() => resourcePath(1, '..', 'x')).toThrow()
        expect(() => resourcePath(1, 'User', '../../etc/passwd')).toThrow()
    })

    it('rejects an empty method path', () => {
        expect(() => classicMethodPath('')).toThrow()
        expect(() => classicMethodPath('/')).toThrow()
    })

    it('covers remaining path helpers, jsonParam, and toSearchParams', () => {
        expect(doctypePath('Sales Order', 'count')).toBe('/api/v2/doctype/Sales%20Order/count')
        expect(documentMethodPath('ToDo', 'x', 'submit')).toBe('/api/v2/document/ToDo/x/method/submit')
        expect(doctypeMethodPath('ToDo', 'custom')).toBe('ToDo/custom')
        expect(documentCopyPath('ToDo', 'x')).toBe('/api/v2/document/ToDo/x/copy')
        expect(classicMethodPath('already%20encoded')).toBe('/api/method/already%20encoded')
        expect(() => classicMethodPath('%E0%A4')).not.toThrow()
        expect(() => resourcePath(1, '', 'x')).toThrow()
        expect(() => resourcePath(1, '.', 'x')).toThrow()
        expect(() => resourcePath(1, 'a\0b', 'x')).toThrow()
        expect(jsonParam(null)).toBeUndefined()
        expect(jsonParam(undefined)).toBeUndefined()
        expect(jsonParam('plain')).toBe('plain')
        expect(jsonParam({ a: 1 })).toBe('{"a":1}')
        expect(toSearchParams().toString()).toBe('')
        expect(toSearchParams({ a: 1, b: { c: 2 }, skip: undefined }).get('b')).toBe('{"c":2}')
        expect(toSearchParams({ debug: true, cache: false }).get('debug')).toBe('1')
        expect(toSearchParams({ debug: true, cache: false }).get('cache')).toBe('0')
        expect(resourcePath(1, 'User')).toBe('/api/resource/User')
        expect(methodPath(1, '/frappe.ping')).toBe('/api/method/frappe.ping')
    })
})
