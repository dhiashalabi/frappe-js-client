import { describe, expect, it } from 'vitest'

import { isLinkType, LAYOUT_FIELD_TYPES, mapFieldType } from '../src/field-types'
import { DocField } from '../src/metadata'

function field(fieldtype: string, extra: Partial<DocField> = {}): DocField {
    return { fieldname: 'x', fieldtype, ...extra }
}

const NUMBER_FIELD_TYPES = ['Int', 'Float', 'Currency', 'Percent', 'Rating', 'Duration'] as const

const STRING_FIELD_TYPES = [
    'Data',
    'Small Text',
    'Text',
    'Long Text',
    'Text Editor',
    'Code',
    'HTML Editor',
    'Markdown Editor',
    'Password',
    'Read Only',
    'Dynamic Link',
    'Date',
    'Datetime',
    'Time',
    'Attach',
    'Attach Image',
    'Barcode',
    'Color',
    'Signature',
    'Phone',
    'Icon',
    'Autocomplete',
] as const

const UNKNOWN_FIELD_TYPES = ['JSON', 'Geolocation'] as const

describe('mapFieldType', () => {
    it.each(NUMBER_FIELD_TYPES)('maps %s to number', (fieldtype) => {
        expect(mapFieldType(field(fieldtype))).toBe('number')
    })

    it.each(STRING_FIELD_TYPES)('maps %s to string', (fieldtype) => {
        expect(mapFieldType(field(fieldtype))).toBe('string')
    })

    it.each(UNKNOWN_FIELD_TYPES)('maps %s to unknown', (fieldtype) => {
        expect(mapFieldType(field(fieldtype))).toBe('unknown')
    })

    it.each([...LAYOUT_FIELD_TYPES])(
        'maps layout fieldtype %s to unknown (layout is skipped at generate time)',
        (fieldtype) => {
            expect(mapFieldType(field(fieldtype))).toBe('unknown')
        },
    )

    it('maps Check to 0 | 1', () => {
        expect(mapFieldType(field('Check'))).toBe('0 | 1')
    })

    it('maps Select with multi-line options to a string-literal union in source order', () => {
        expect(mapFieldType(field('Select', { options: 'Draft\nSubmitted\nCancelled' }))).toBe(
            '"Draft" | "Submitted" | "Cancelled"',
        )
    })

    it('maps Select with empty or whitespace-only options to string', () => {
        expect(mapFieldType(field('Select'))).toBe('string')
        expect(mapFieldType(field('Select', { options: '' }))).toBe('string')
        expect(mapFieldType(field('Select', { options: '  \n  \n' }))).toBe('string')
    })

    it('JSON.stringifies Select literals that contain quotes or newlines', () => {
        expect(mapFieldType(field('Select', { options: 'plain\nvalue "quoted"\nkeeps order' }))).toBe(
            '"plain" | "value \\"quoted\\"" | "keeps order"',
        )
    })

    it('maps Table / Table MultiSelect to a known child interface array', () => {
        const ctx = {
            resolveChildInterfaceName: (child: string) => (child === 'Sales Order Item' ? 'SalesOrderItem' : undefined),
        }
        expect(mapFieldType(field('Table', { options: 'Sales Order Item' }), ctx)).toBe('SalesOrderItem[]')
        expect(mapFieldType(field('Table MultiSelect', { options: 'Sales Order Item' }), ctx)).toBe('SalesOrderItem[]')
    })

    it('maps Table / Table MultiSelect to FrappeDoc fallback when the child is unknown', () => {
        const fallback = 'FrappeDoc<Record<string, unknown>>[]'
        expect(mapFieldType(field('Table', { options: 'Sales Order Item' }))).toBe(fallback)
        expect(
            mapFieldType(field('Table', { options: 'Sales Order Item' }), {
                resolveChildInterfaceName: () => undefined,
            }),
        ).toBe(fallback)
        expect(mapFieldType(field('Table MultiSelect'))).toBe(fallback)
    })

    it('maps Link with options to Link<"Doctype"> and without options to string', () => {
        expect(mapFieldType(field('Link', { options: 'Customer' }))).toBe('Link<"Customer">')
        expect(mapFieldType(field('Link'))).toBe('string')
    })

    it('preserves commas and colons in Select values', () => {
        expect(mapFieldType(field('Select', { options: 'Open: Today\nLast, First' }))).toBe(
            '"Open: Today" | "Last, First"',
        )
    })

    it('maps an unknown/future fieldtype to unknown without throwing', () => {
        expect(mapFieldType(field('Photon Beam'))).toBe('unknown')
    })

    it('detects generated Link<...> types', () => {
        expect(isLinkType('Link<"Customer">')).toBe(true)
        expect(isLinkType('string')).toBe(false)
    })
})
