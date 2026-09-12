import { appendFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { NotFoundError } from 'frappe-js-client'
import { afterEach, describe, expect, it, vi } from 'vitest'

const { createFrappeClient, tokenAuth, anonymousAuth, fetchDocTypeMetas } = vi.hoisted(() => ({
    createFrappeClient: vi.fn(() => ({
        db: {
            paginate: async function* () {
                /* no DocTypes */
            },
        },
    })),
    tokenAuth: vi.fn((opts: { apiKey: string; apiSecret: string }) => ({
        name: 'token' as const,
        ...opts,
    })),
    anonymousAuth: vi.fn(() => ({ name: 'anonymous' as const })),
    fetchDocTypeMetas: vi.fn(),
}))

vi.mock('node:fs', async (importOriginal) => {
    const actual = await importOriginal<typeof import('node:fs')>()
    return {
        ...actual,
        mkdirSync: vi.fn(),
        writeFileSync: vi.fn(),
    }
})

vi.mock('frappe-js-client', async (importOriginal) => {
    const actual = await importOriginal<typeof import('frappe-js-client')>()
    return {
        ...actual,
        createFrappeClient,
        tokenAuth,
        anonymousAuth,
    }
})

vi.mock('../src/metadata', () => ({
    fetchDocTypeMetas,
}))

import { boot, isDirectCliRun, main, parseCliArgs } from '../src/cli'

const required = ['--url', 'https://frappe.example.com', '--doctype', 'ToDo']

describe('parseCliArgs', () => {
    it('does not validate url/doctype at parse time (merge/main do)', () => {
        expect(parseCliArgs(['--doctype', 'ToDo'])).toMatchObject({
            doctypes: ['ToDo'],
            url: undefined,
        })
        expect(parseCliArgs(['--url', 'https://frappe.example.com'])).toMatchObject({
            url: 'https://frappe.example.com',
            doctypes: undefined,
        })
    })

    it('accumulates repeated --doctype flags', () => {
        const parsed = parseCliArgs(['--url', 'https://frappe.example.com', '--doctype', 'A', '--doctype', 'B'])
        expect(parsed).toMatchObject({ doctypes: ['A', 'B'] })
    })

    it('leaves --out unset when omitted so mergeConfig can default it', () => {
        const parsed = parseCliArgs(required)
        expect(parsed).toMatchObject({ out: undefined })
    })

    it('treats --api-key and --api-secret as optional and independent', () => {
        expect(parseCliArgs(required)).toMatchObject({
            apiKey: undefined,
            apiSecret: undefined,
        })
        expect(parseCliArgs([...required, '--api-key', 'k'])).toMatchObject({
            apiKey: 'k',
            apiSecret: undefined,
        })
        expect(parseCliArgs([...required, '--api-secret', 's'])).toMatchObject({
            apiKey: undefined,
            apiSecret: 's',
        })
    })

    it('toggles include-hidden / include-labels / include-doctype-map / follow-tables when passed', () => {
        expect(parseCliArgs(required)).toMatchObject({
            includeHidden: undefined,
            includeLabels: undefined,
            emitDocTypeMap: undefined,
            followTables: undefined,
        })
        expect(
            parseCliArgs([
                ...required,
                '--include-hidden',
                '--no-include-labels',
                '--no-include-doctype-map',
                '--no-follow-tables',
            ]),
        ).toMatchObject({
            includeHidden: true,
            includeLabels: false,
            emitDocTypeMap: false,
            followTables: false,
        })
    })

    it('accepts short flags for url, doctype, out, and help', () => {
        expect(parseCliArgs(['-u', 'https://frappe.example.com', '-d', 'ToDo', '-o', 'out.ts'])).toMatchObject({
            url: 'https://frappe.example.com',
            doctypes: ['ToDo'],
            out: 'out.ts',
        })
        expect(parseCliArgs(['-h'])).toEqual({ help: true })
    })

    it('returns { help: true } for --help before validating required flags', () => {
        expect(parseCliArgs(['--help'])).toEqual({ help: true })
        expect(parseCliArgs(['--help', '--url', 'https://frappe.example.com'])).toEqual({ help: true })
    })
})

describe('main', () => {
    afterEach(() => {
        fetchDocTypeMetas.mockReset()
        createFrappeClient.mockClear()
        tokenAuth.mockClear()
        anonymousAuth.mockClear()
        vi.mocked(mkdirSync).mockClear()
        vi.mocked(writeFileSync).mockClear()
        process.exitCode = undefined
    })

    it('builds the client with tokenAuth when both api-key and api-secret are present', async () => {
        fetchDocTypeMetas.mockResolvedValue([{ name: 'ToDo', fields: [] }])

        await main([...required, '--api-key', 'k', '--api-secret', 's', '--out', 'src/generated/types.ts'])

        expect(tokenAuth).toHaveBeenCalledWith({ apiKey: 'k', apiSecret: 's' })
        expect(anonymousAuth).not.toHaveBeenCalled()
        expect(createFrappeClient).toHaveBeenCalledWith(
            expect.objectContaining({
                url: 'https://frappe.example.com',
                apiVersion: 2,
                auth: expect.objectContaining({ name: 'token' }),
            }),
        )
        expect(mkdirSync).toHaveBeenCalledWith('src/generated', {
            recursive: true,
        })
        expect(writeFileSync).toHaveBeenCalledWith(
            'src/generated/types.ts',
            expect.stringContaining('export type ToDo'),
            'utf8',
        )
        expect(process.exitCode).toBeUndefined()
    })

    it('builds the client with anonymousAuth when credentials are omitted', async () => {
        fetchDocTypeMetas.mockResolvedValue([{ name: 'ToDo', fields: [] }])

        await main(required)

        expect(anonymousAuth).toHaveBeenCalled()
        expect(tokenAuth).not.toHaveBeenCalled()
        expect(createFrappeClient).toHaveBeenCalledWith(
            expect.objectContaining({
                auth: expect.objectContaining({ name: 'anonymous' }),
            }),
        )
    })

    it('catches fetch errors, prints the frappe-codegen failed: prefix, and sets exitCode 1', async () => {
        fetchDocTypeMetas.mockRejectedValue(new NotFoundError({ status: 404, message: 'DocType Missing not found' }))
        const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)

        await main([...required.slice(0, 2), '--doctype', 'Missing'])

        expect(stderr).toHaveBeenCalledWith('frappe-codegen failed: DocType Missing not found\n')
        expect(process.exitCode).toBe(1)
        stderr.mockRestore()
    })

    it('writes help to stdout and does not fetch metadata', async () => {
        const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

        await main(['--help'])

        expect(stdout).toHaveBeenCalledWith(expect.stringContaining('Usage:'))
        expect(stdout).toHaveBeenCalledWith(expect.stringContaining('--include-hidden'))
        expect(stdout).toHaveBeenCalledWith(expect.stringContaining('Reminder.user'))
        expect(stdout).toHaveBeenCalledWith(expect.stringContaining('--no-include-hidden'))
        expect(fetchDocTypeMetas).not.toHaveBeenCalled()
        stdout.mockRestore()
    })

    it('stringifies non-Error failures', async () => {
        fetchDocTypeMetas.mockRejectedValue('nope')
        const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
        await main(required)
        expect(stderr).toHaveBeenCalledWith('frappe-codegen failed: nope\n')
        stderr.mockRestore()
    })

    it('fails when url or doctypes are missing after merge', async () => {
        const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
        await main(['--doctype', 'ToDo'])
        expect(stderr).toHaveBeenCalledWith(expect.stringContaining('--url is required'))
        await main(['--url', 'https://frappe.example.com'])
        expect(stderr).toHaveBeenCalledWith(expect.stringContaining('At least one --doctype or --module'))
        stderr.mockRestore()
    })

    it('prints seed and child names on --dry-run and does not write a file', async () => {
        fetchDocTypeMetas
            .mockResolvedValueOnce([
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
            ])
            .mockResolvedValueOnce([{ name: 'Sales Order Item', fields: [] }])
        const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
        await main(['--url', 'https://frappe.example.com', '--doctype', 'Sales Order', '--dry-run'])
        expect(stdout).toHaveBeenCalledWith('Sales Order\tseed\n')
        expect(stdout).toHaveBeenCalledWith('Sales Order Item\tchild\n')
        expect(writeFileSync).not.toHaveBeenCalled()
        stdout.mockRestore()
    })

    it('omits following-child-tables wording when --no-follow-tables', async () => {
        fetchDocTypeMetas.mockResolvedValue([{ name: 'ToDo', fields: [] }])
        const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
        await main([...required, '--no-follow-tables'])
        expect(stderr).toHaveBeenCalledWith(expect.stringContaining('Fetching metadata for 1 DocType(s) ...\n'))
        stderr.mockRestore()
    })

    it('fails when --module resolves to no DocTypes', async () => {
        const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
        await main(['--url', 'https://frappe.example.com', '--module', 'Selling'])
        expect(stderr).toHaveBeenCalledWith(expect.stringContaining('No DocTypes matched'))
        stderr.mockRestore()
    })

    it('reads --config JSON for url and doctypes', async () => {
        fetchDocTypeMetas.mockResolvedValue([{ name: 'ToDo', fields: [] }])
        const dir = mkdtempSync(join(tmpdir(), 'codegen-cli-'))
        const path = join(dir, 'frappe-codegen.config.json')
        appendFileSync(path, JSON.stringify({ url: 'https://from-config.example', doctypes: ['ToDo'] }))
        await main(['--config', path])
        expect(createFrappeClient).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://from-config.example' }))
        expect(writeFileSync).toHaveBeenCalled()
    })
})

describe('CLI boot', () => {
    it('isDirectCliRun / boot', () => {
        expect(isDirectCliRun('')).toBe(false)
        expect(isDirectCliRun('/tmp/vitest')).toBe(false)
        expect(isDirectCliRun('/tmp/cli.ts')).toBe(true)
        expect(isDirectCliRun('/usr/bin/frappe-codegen', 'file:///usr/bin/frappe-codegen')).toBe(true)
        expect(isDirectCliRun(1 as unknown as string)).toBe(false)
        expect(isDirectCliRun('\0')).toBe(false)
        const run = vi.fn(async () => undefined)
        boot('/not-the-cli', run)
        expect(run).not.toHaveBeenCalled()
        boot('/project/src/cli.ts', run)
        expect(run).toHaveBeenCalledOnce()
    })
})
