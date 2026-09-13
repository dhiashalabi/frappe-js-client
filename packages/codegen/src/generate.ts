/**
 * @module generate
 * @description Turns normalized `DocTypeMeta` into TypeScript source: one `FrappeDoc<...>`
 * type per DocType, an insert alias, plus `GeneratedDocTypes` / `GeneratedInserts` maps.
 */

import { LAYOUT_FIELD_TYPES, mapFieldType } from './field-types'
import { DocField, DocTypeMeta } from './metadata'

export interface GenerateOptions {
    /**
     * Include fields marked `hidden` in the meta. Default `true`.
     * Frappe `hidden` is form visibility (e.g. Reminder `user` / `notified`), not "absent from the document".
     */
    includeHidden?: boolean
    /** Emit a `/** label *\/` doc comment above each field. Default `true`. */
    includeLabels?: boolean
    /** Emit the GeneratedDocTypes / GeneratedInserts lookup maps. Default `true`. */
    emitDocTypeMap?: boolean
}

const DEFAULTS: Required<GenerateOptions> = {
    includeHidden: true,
    includeLabels: true,
    emitDocTypeMap: true,
}

/** `Sales Order` -> `SalesOrder`. Not injective for pathological names — collisions are rejected. */
export function toInterfaceName(doctype: string): string {
    const cleaned = doctype
        .replace(/[^a-zA-Z0-9 ]/g, ' ')
        .split(' ')
        .filter(Boolean)
        .map((word) => word[0].toUpperCase() + word.slice(1))
        .join('')
    return /^[A-Za-z_]/.test(cleaned) ? cleaned : `_${cleaned}`
}

export function assertUniqueInterfaceNames(metas: readonly DocTypeMeta[]): void {
    const byName = new Map<string, string[]>()
    const reserve = (symbol: string, source: string) => {
        const list = byName.get(symbol) ?? []
        list.push(source)
        byName.set(symbol, list)
    }
    for (const symbol of [
        'FrappeDoc',
        'FrappeInsert',
        'Link',
        'GeneratedDocTypes',
        'GeneratedInserts',
        'Omit',
        'Partial',
        'Pick',
        'Record',
    ]) {
        reserve(symbol, `reserved ${symbol}`)
    }
    for (const meta of metas) {
        const id = toInterfaceName(meta.name)
        reserve(id, meta.name)
        reserve(`${id}Insert`, `${meta.name} insert alias`)
    }
    const collisions = [...byName.entries()].filter(([, names]) => names.length > 1)
    if (collisions.length === 0) return
    const detail = collisions
        .map(([id, names]) => `${id} <= ${names.map((n) => JSON.stringify(n)).join(', ')}`)
        .join('; ')
    throw new Error(`frappe-codegen: interface name collision / generated symbol collision: ${detail}`)
}

function commentText(value: string): string {
    return value.replace(/\*\//g, '*∕')
}

function shouldEmitField(field: DocField, options: Required<GenerateOptions>): boolean {
    if (LAYOUT_FIELD_TYPES.has(field.fieldtype)) return false
    if (field.is_virtual) return false
    if (field.hidden && !options.includeHidden) return false
    if (!field.fieldname) return false
    return true
}

function isValidIdentifier(name: string): boolean {
    return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)
}

function propertyKey(fieldname: string): string {
    return isValidIdentifier(fieldname) ? fieldname : JSON.stringify(fieldname)
}

function isCheckRequiredOnRead(field: DocField): boolean {
    return field.fieldtype === 'Check'
}

function fieldComment(field: DocField, includeLabels: boolean): string {
    if (field.fieldtype === 'Password') {
        const secret = 'GET usually returns empty or masked (`*`); use db.getPassword to read the secret.'
        if (includeLabels && field.label) {
            return `    /** ${field.label.replace(/\*\//g, '*∕')} — ${secret} */\n`
        }
        return `    /** ${secret} */\n`
    }
    if (includeLabels && field.label) {
        return `    /** ${field.label.replace(/\*\//g, '*∕')} */\n`
    }
    return ''
}

/** Generates one read type plus its insert alias for a single DocType. */
export function generateInterface(
    meta: DocTypeMeta,
    allMetas: readonly DocTypeMeta[] = [meta],
    opts: GenerateOptions = {},
): string {
    const options = { ...DEFAULTS, ...opts }
    const interfaceName = toInterfaceName(meta.name)
    const knownDoctypes = new Set(allMetas.map((m) => m.name))

    const emitted = meta.fields.filter((field) => shouldEmitField(field, options))
    const insertOverrides = emitted.flatMap((field) => {
        if (field.fieldtype === 'Check') {
            return [{ name: field.fieldname, line: `    ${propertyKey(field.fieldname)}?: 0 | 1` }]
        }
        if (
            (field.fieldtype === 'Table' || field.fieldtype === 'Table MultiSelect') &&
            field.options &&
            knownDoctypes.has(field.options)
        ) {
            const child = toInterfaceName(field.options)
            return [
                {
                    name: field.fieldname,
                    line: `    ${propertyKey(field.fieldname)}${field.reqd ? '' : '?'}: ${child}Insert[]`,
                },
            ]
        }
        return []
    })

    const fieldLines = emitted.map((field) => {
        const optional = field.reqd || isCheckRequiredOnRead(field) ? '' : '?'
        const type = mapFieldType(field, {
            resolveChildInterfaceName: (childDoctype) =>
                knownDoctypes.has(childDoctype) ? toInterfaceName(childDoctype) : undefined,
        })
        return `${fieldComment(field, options.includeLabels)}    ${propertyKey(field.fieldname)}${optional}: ${type}`
    })

    const doctypeLine = `    doctype: ${JSON.stringify(meta.name)}`
    const inner = [doctypeLine, ...fieldLines].join('\n')
    const body = `{\n${inner}\n}`

    const insertAlias =
        insertOverrides.length === 0
            ? `export type ${interfaceName}Insert = FrappeInsert<${interfaceName}>`
            : `export type ${interfaceName}Insert = Omit<FrappeInsert<${interfaceName}>, ${insertOverrides.map(({ name }) => JSON.stringify(name)).join(' | ')}> & {\n${insertOverrides.map(({ line }) => line).join('\n')}\n}`

    return [
        `/** Generated from DocType \`${commentText(meta.name)}\`. Do not edit by hand — regenerate with \`frappe-codegen --help\`. */`,
        `export type ${interfaceName} = FrappeDoc<${body}>`,
        insertAlias,
    ].join('\n')
}

function collectImports(source: string): string {
    const names = ['FrappeDoc', 'FrappeInsert']
    if (source.includes('Link<')) {
        names.push('Link')
    }
    return `import type { ${names.join(', ')} } from 'frappe-js-client/types'`
}

/** Generates a full, self-contained `.ts` module. */
export function generateModule(metas: readonly DocTypeMeta[], opts: GenerateOptions = {}): string {
    const options = { ...DEFAULTS, ...opts }
    assertUniqueInterfaceNames(metas)

    const interfaces = metas.map((meta) => generateInterface(meta, metas, options)).join('\n\n')

    const header = [
        '/**',
        ' * This file was generated by frappe-codegen. Do not edit by hand —',
        ' * regenerate it instead: `frappe-codegen --url <site> --doctype "..." --out <this file>`.',
        ' */',
        collectImports(interfaces),
        '',
    ].join('\n')

    if (!options.emitDocTypeMap) {
        return `${header}\n${interfaces}\n`
    }

    const mapEntries = metas.map((meta) => `    ${JSON.stringify(meta.name)}: ${toInterfaceName(meta.name)}`).join('\n')
    const insertEntries = metas
        .map((meta) => `    ${JSON.stringify(meta.name)}: ${toInterfaceName(meta.name)}Insert`)
        .join('\n')
    const map = [
        '',
        '/** Maps a DocType name to its generated read type. Pass as `createFrappeClient<GeneratedDocTypes>(...)`. */',
        'export interface GeneratedDocTypes {',
        mapEntries,
        '}',
        '',
        '/** Maps a DocType name to its insert payload type. */',
        'export interface GeneratedInserts {',
        insertEntries,
        '}',
    ].join('\n')

    return `${header}\n${interfaces}\n${map}\n`
}
