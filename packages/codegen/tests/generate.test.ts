import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import ts from 'typescript'
import { describe, expect, it } from 'vitest'

import { generateInterface, generateModule, toInterfaceName } from '../src/generate'
import { DocTypeMeta } from '../src/metadata'

const here = dirname(fileURLToPath(import.meta.url))

const todoFixture = JSON.parse(readFileSync(join(here, 'fixtures/todo.meta.json'), 'utf8')) as DocTypeMeta

function meta(name: string, fields: DocTypeMeta['fields'], extra: Partial<DocTypeMeta> = {}): DocTypeMeta {
    return { name, fields, ...extra }
}

function assertSyntacticallyValidTs(source: string): void {
    const result = ts.transpileModule(source, {
        compilerOptions: {
            module: ts.ModuleKind.ESNext,
            target: ts.ScriptTarget.ES2022,
            strict: true,
        },
        reportDiagnostics: true,
    })
    const errors = (result.diagnostics ?? []).filter((d) => d.category === ts.DiagnosticCategory.Error)
    expect(errors).toEqual([])
}

describe('toInterfaceName', () => {
    it('strips spaces: Sales Order -> SalesOrder', () => {
        expect(toInterfaceName('Sales Order')).toBe('SalesOrder')
    })

    it('sanitizes hyphens, slashes, and parentheses to a valid identifier', () => {
        expect(toInterfaceName('HR Settings')).toBe('HRSettings')
        expect(toInterfaceName('POS Profile')).toBe('POSProfile')
        expect(toInterfaceName('item-price')).toBe('ItemPrice')
        expect(toInterfaceName('foo/bar')).toBe('FooBar')
        expect(toInterfaceName('Item (Variant)')).toBe('ItemVariant')
    })

    it('prefixes a leading digit with an underscore', () => {
        expect(toInterfaceName('2FA Settings')).toBe('_2FASettings')
        expect(toInterfaceName('123')).toBe('_123')
    })
})

describe('generateInterface', () => {
    it('emits a required property for reqd: 1 and an optional property otherwise', () => {
        const source = generateInterface(
            meta('ToDo', [
                { fieldname: 'description', fieldtype: 'Text', reqd: 1 },
                { fieldname: 'status', fieldtype: 'Select', options: 'Open\nClosed' },
            ]),
            undefined,
            { includeLabels: false },
        )
        expect(source).toContain('    description: string')
        expect(source).toContain('    status?: "Open" | "Closed"')
        expect(source).not.toContain('description?:')
    })

    it('excludes hidden fields by default and includes them when includeHidden is true', () => {
        const todo = meta('ToDo', [
            { fieldname: 'description', fieldtype: 'Text' },
            { fieldname: 'idx', fieldtype: 'Int', hidden: 1, label: 'Index' },
        ])
        const hidden = generateInterface(todo, [todo], { includeLabels: false })
        expect(hidden).not.toContain('idx')

        const shown = generateInterface(todo, [todo], {
            includeHidden: true,
            includeLabels: false,
        })
        expect(shown).toContain('    idx?: number')
    })

    it("emits Reminder's form-hidden data fields only when includeHidden is true", () => {
        const reminder = meta('Reminder', [
            {
                fieldname: 'user',
                fieldtype: 'Link',
                options: 'User',
                reqd: 1,
                hidden: 1,
                label: 'User',
            },
            {
                fieldname: 'remind_at',
                fieldtype: 'Datetime',
                reqd: 1,
                label: 'Remind At',
            },
            {
                fieldname: 'description',
                fieldtype: 'Small Text',
                reqd: 1,
                label: 'Description',
            },
            {
                fieldname: 'reminder_doctype',
                fieldtype: 'Link',
                options: 'DocType',
                label: 'Document Type',
            },
            {
                fieldname: 'reminder_docname',
                fieldtype: 'Dynamic Link',
                options: 'reminder_doctype',
                label: 'Document Name',
            },
            {
                fieldname: 'notified',
                fieldtype: 'Check',
                hidden: 1,
                label: 'notified',
            },
        ])

        const withoutHidden = generateInterface(reminder, [reminder], {
            includeLabels: false,
        })
        expect(withoutHidden).toContain('    remind_at: string')
        expect(withoutHidden).toContain('    description: string')
        expect(withoutHidden).toContain('    reminder_doctype?: Link<"DocType">')
        expect(withoutHidden).toContain('    reminder_docname?: string')
        expect(withoutHidden).not.toMatch(/\buser:/)
        expect(withoutHidden).not.toContain('notified')

        const withHidden = generateInterface(reminder, [reminder], {
            includeHidden: true,
            includeLabels: false,
        })
        expect(withHidden).toContain('    user: Link<"User">')
        expect(withHidden).toContain('    remind_at: string')
        expect(withHidden).toContain('    description: string')
        expect(withHidden).toContain('    reminder_doctype?: Link<"DocType">')
        expect(withHidden).toContain('    reminder_docname?: string')
        expect(withHidden).toContain('    notified: 0 | 1')
        expect(withHidden).toContain('export type ReminderInsert = FrappeInsert<')
        expect(withHidden).toContain('"notified"')
    })

    it('skips fields without a fieldname and omits comments when label is missing', () => {
        const source = generateInterface(
            meta('ToDo', [
                { fieldname: '', fieldtype: 'Data', label: 'Nope' },
                { fieldname: 'status', fieldtype: 'Data' },
            ]),
        )
        expect(source).not.toContain('Nope')
        expect(source).toContain('    status?: string')
        expect(source).not.toContain('    /**')
    })

    it('never emits layout fieldtypes as properties', () => {
        const source = generateInterface(
            meta('ToDo', [
                { fieldname: 'section', fieldtype: 'Section Break', label: 'A' },
                { fieldname: 'column', fieldtype: 'Column Break' },
                { fieldname: 'tab', fieldtype: 'Tab Break' },
                { fieldname: 'fold', fieldtype: 'Fold' },
                { fieldname: 'heading', fieldtype: 'Heading' },
                { fieldname: 'go', fieldtype: 'Button' },
                { fieldname: 'html', fieldtype: 'HTML' },
                { fieldname: 'image', fieldtype: 'Image' },
                { fieldname: 'status', fieldtype: 'Data' },
            ]),
            undefined,
            { includeLabels: false },
        )
        expect(source).toContain('    status?: string')
        expect(source).not.toContain('section')
        expect(source).not.toContain('column')
        expect(source).not.toContain('tab')
        expect(source).not.toContain('fold')
        expect(source).not.toContain('heading')
        expect(source).not.toMatch(/\bgo\?:/)
        expect(source).not.toMatch(/\bhtml\?:/)
        expect(source).not.toContain('image')
    })

    it('never emits virtual fields', () => {
        const source = generateInterface(
            meta('ToDo', [
                { fieldname: 'description', fieldtype: 'Text', reqd: 1 },
                { fieldname: 'open_count', fieldtype: 'Int', is_virtual: 1, label: 'Open Count' },
            ]),
            undefined,
            { includeLabels: false },
        )
        expect(source).toContain('    description: string')
        expect(source).not.toContain('open_count')
    })

    it('omits /** label */ comments when includeLabels is false', () => {
        const source = generateInterface(
            meta('ToDo', [{ fieldname: 'status', fieldtype: 'Data', label: 'Status' }]),
            undefined,
            { includeLabels: false },
        )
        expect(source).not.toContain('    /** Status */')
        expect(source).toContain('    status?: string')
    })

    it('always emits a doctype literal even when there are no other fields', () => {
        const empty = generateInterface(meta('Empty', []), undefined, {
            includeLabels: false,
        })
        expect(empty).toContain('    doctype: "Empty"')
        expect(empty).toContain('export type EmptyInsert = FrappeInsert<Empty>')
        expect(empty).not.toContain('= FrappeDoc<Record<string, never>>')

        const layoutOnly = generateInterface(meta('Layout Only', [{ fieldname: 'sb', fieldtype: 'Section Break' }]))
        expect(layoutOnly).toContain('    doctype: "Layout Only"')
    })

    it('quotes field names that are not valid JS identifiers', () => {
        const source = generateInterface(
            meta('Odd', [{ fieldname: 'weird name', fieldtype: 'Data', reqd: 1 }]),
            undefined,
            { includeLabels: false },
        )
        expect(source).toContain('    "weird name": string')
    })

    it('escapes */ in labels so they cannot break out of the doc comment', () => {
        const source = generateInterface(
            meta('ToDo', [
                {
                    fieldname: 'status',
                    fieldtype: 'Data',
                    label: 'close */ still a label',
                },
            ]),
        )
        expect(source).toContain('/** close *∕ still a label */')
        expect(source).not.toContain('/** close */ still a label */')
    })

    it('documents Password fields even without a label', () => {
        const withLabel = generateInterface(
            meta('User', [{ fieldname: 'pwd', fieldtype: 'Password', label: 'Password' }]),
        )
        expect(withLabel).toContain('GET usually returns empty or masked')
        const noLabel = generateInterface(meta('User', [{ fieldname: 'pwd', fieldtype: 'Password' }]), undefined, {
            includeLabels: false,
        })
        expect(noLabel).toContain('GET usually returns empty or masked')
    })
})

describe('generateModule', () => {
    it('starts with the generated-file header and the FrappeDoc import', () => {
        const source = generateModule([meta('ToDo', [])])
        expect(source.startsWith('/**')).toBe(true)
        expect(source).toContain('This file was generated by frappe-codegen. Do not edit by hand —')
        expect(source).toContain("import type { FrappeDoc, FrappeInsert } from 'frappe-js-client/types'")
    })

    it('omits GeneratedDocTypes when emitDocTypeMap is false', () => {
        const source = generateModule([meta('ToDo', [])], {
            emitDocTypeMap: false,
        })
        expect(source).not.toContain('GeneratedDocTypes')
    })

    it('keys GeneratedDocTypes by the exact doctype name via JSON.stringify', () => {
        const source = generateModule([meta('Sales Order', []), meta('Customer', [])])
        expect(source).toContain('    "Sales Order": SalesOrder')
        expect(source).toContain('    "Customer": Customer')
        expect(source).toContain('    "Sales Order": SalesOrderInsert')
        expect(source).toContain('export interface GeneratedInserts {')
    })

    it('resolves Table fields to a sibling child interface when that doctype is in metas', () => {
        const parent = meta('Sales Order', [
            {
                fieldname: 'items',
                fieldtype: 'Table',
                options: 'Sales Order Item',
                reqd: 1,
                label: 'Items',
            },
        ])
        const child = meta('Sales Order Item', [
            { fieldname: 'item_code', fieldtype: 'Link', options: 'Item', reqd: 1 },
        ])
        const source = generateModule([parent, child], { includeLabels: false })
        expect(source).toContain('    items: SalesOrderItem[]')
        expect(source).toContain('export type SalesOrderItem = FrappeDoc<{')
        expect(source).toContain('Link')
    })

    it('falls back when a Table child DocType is not in the same generation set', () => {
        const source = generateModule(
            [
                meta('Project', [
                    {
                        fieldname: 'tasks',
                        fieldtype: 'Table',
                        options: 'Project Task',
                        reqd: 1,
                    },
                ]),
            ],
            { includeLabels: false },
        )
        expect(source).toContain('    tasks: FrappeDoc<Record<string, unknown>>[]')
        expect(source).not.toContain('ProjectTask')
    })

    it('fails when two DocTypes collapse to the same interface name', () => {
        expect(() =>
            generateModule([
                meta('HR Settings', [{ fieldname: 'x', fieldtype: 'Data' }]),
                meta('HRSettings', [{ fieldname: 'y', fieldtype: 'Data' }]),
            ]),
        ).toThrow(/interface name collision/)
    })

    it('generates ToDo types from the fixture metadata', () => {
        const source = generateModule([todoFixture], { includeLabels: false })
        expect(source).toContain('export type ToDo = FrappeDoc<{')
        expect(source).toContain('    doctype: "ToDo"')
        expect(source).toContain('    description: string')
        expect(source).toContain('    status: "Open" | "Closed"')
        expect(source).toContain('    allocated_to?: Link<"User">')
        expect(source).toContain('    reference_name?: string')
        expect(source).toContain('"ToDo": ToDo')
        expect(source).not.toContain('sender')
        expect(source).not.toContain('section_break_reference')
    })

    it('matches the ToDo golden file', () => {
        const source = generateModule([todoFixture], { includeLabels: false })
        const expected = readFileSync(join(here, 'fixtures/todo.generated.expected.ts'), 'utf8')
        expect(source).toBe(expected)
    })

    it('is syntactically valid TypeScript for every fixture used above', () => {
        const sources = [
            generateModule([todoFixture]),
            generateModule([meta('Empty', [])], { emitDocTypeMap: false }),
            generateModule(
                [
                    meta('Odd', [
                        { fieldname: 'weird name', fieldtype: 'Data' },
                        {
                            fieldname: 'note',
                            fieldtype: 'Data',
                            label: 'close */ still',
                        },
                    ]),
                ],
                { includeHidden: true },
            ),
        ]
        for (const source of sources) {
            assertSyntacticallyValidTs(source)
        }
    })
})
