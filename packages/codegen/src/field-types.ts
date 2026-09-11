/**
 * @module field-types
 * @description Maps a Frappe DocField's `fieldtype` to the TypeScript type emitted for it.
 * Kept as one small, table-driven module so adding a new Frappe fieldtype is a one-line change.
 */

import { DocField } from './metadata'

const NUMBER_FIELD_TYPES = new Set(['Int', 'Float', 'Currency', 'Percent', 'Rating', 'Duration'])

const STRING_FIELD_TYPES = new Set([
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
])

const UNKNOWN_FIELD_TYPES = new Set(['JSON', 'Geolocation'])

/** Fieldtypes that carry no data on the parent record at all and are skipped entirely. */
export const LAYOUT_FIELD_TYPES = new Set([
    'Section Break',
    'Column Break',
    'Tab Break',
    'Fold',
    'Heading',
    'Button',
    'HTML',
    'Image',
])

export function isTableFieldType(fieldtype: string): boolean {
    return fieldtype === 'Table' || fieldtype === 'Table MultiSelect'
}

/** Parses a Select field's `options` into value-side string literals. */
export function selectLiterals(options: string | undefined): string[] {
    if (!options) return []
    return options
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map(selectValue)
}

/** `value: Label`, `value,Label`, or a bare value. */
function selectValue(line: string): string {
    const colon = line.indexOf(':')
    const comma = line.indexOf(',')
    if (colon > 0 && (comma < 0 || colon < comma)) {
        return line.slice(0, colon).trim()
    }
    if (comma > 0) {
        return line.slice(0, comma).trim()
    }
    return line
}

export interface FieldTypeContext {
    /** Resolves a Table/Table MultiSelect field's child doctype to its generated interface name, if known. */
    resolveChildInterfaceName?: (childDoctype: string) => string | undefined
}

export function isLinkType(type: string): boolean {
    return type.startsWith('Link<')
}

/** Returns the TypeScript type for a single DocField (never `undefined` — falls back to `unknown`). */
export function mapFieldType(field: DocField, ctx: FieldTypeContext = {}): string {
    const { fieldtype, options } = field

    if (fieldtype === 'Check') {
        return '0 | 1'
    }

    if (fieldtype === 'Select') {
        const literals = selectLiterals(options)
        if (literals.length === 0) {
            return 'string'
        }
        return literals.map((literal) => JSON.stringify(literal)).join(' | ')
    }

    if (isTableFieldType(fieldtype)) {
        const childInterface = options ? ctx.resolveChildInterfaceName?.(options) : undefined
        return childInterface ? `${childInterface}[]` : 'FrappeDoc<Record<string, unknown>>[]'
    }

    if (fieldtype === 'Link') {
        if (options && options.trim().length > 0) {
            return `Link<${JSON.stringify(options.trim())}>`
        }
        return 'string'
    }

    if (NUMBER_FIELD_TYPES.has(fieldtype)) {
        return 'number'
    }

    if (UNKNOWN_FIELD_TYPES.has(fieldtype)) {
        return 'unknown'
    }

    if (STRING_FIELD_TYPES.has(fieldtype)) {
        return 'string'
    }

    return 'unknown'
}
