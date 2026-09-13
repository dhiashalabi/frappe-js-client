import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { findDefaultConfigPath, loadConfigFile, mergeConfig } from '../src/config'

describe('mergeConfig', () => {
    it('requires a supported Frappe version for metadata generation', () => {
        setEnv('FRAPPE_VERSION', undefined)
        expect(() => mergeConfig(undefined, {})).toThrow(/frappeVersion/)
        expect(() => mergeConfig(undefined, { frappeVersion: 14 as unknown as 15 })).toThrow(/frappeVersion/)
        expect(mergeConfig(undefined, { frappeVersion: 15 }).frappeVersion).toBe(15)
        expect(mergeConfig({ frappeVersion: 15 }, { frappeVersion: 16 }).frappeVersion).toBe(16)
        setEnv('FRAPPE_VERSION', '16')
        expect(mergeConfig({ frappeVersion: 15 }, {}).frappeVersion).toBe(16)
        expect(mergeConfig({ frappeVersion: 15 }, { frappeVersion: 15 }).frappeVersion).toBe(15)
        setEnv('FRAPPE_VERSION', '14')
        expect(() => mergeConfig(undefined, {})).toThrow(/frappeVersion/)
    })
    const envKeys = ['FRAPPE_URL', 'FRAPPE_VERSION', 'FRAPPE_API_KEY', 'FRAPPE_API_SECRET'] as const
    const saved: Record<string, string | undefined> = {}

    afterEach(() => {
        for (const key of envKeys) {
            if (key in saved) {
                const value = saved[key]
                if (value === undefined) delete process.env[key]
                else process.env[key] = value
                delete saved[key]
            }
        }
    })

    function setEnv(key: (typeof envKeys)[number], value: string | undefined) {
        if (!(key in saved)) saved[key] = process.env[key]
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
    }

    it('defaults out, includeHidden true, followTables true', () => {
        const merged = mergeConfig(undefined, { frappeVersion: 16 })
        expect(merged).toMatchObject({
            out: './frappe-types.generated.ts',
            includeHidden: true,
            followTables: true,
            doctypes: [],
            modules: [],
        })
    })

    it('lets CLI override file, and env override file for url/secrets', () => {
        setEnv('FRAPPE_URL', 'https://from-env.example')
        setEnv('FRAPPE_API_KEY', 'ek')
        setEnv('FRAPPE_API_SECRET', 'es')
        const merged = mergeConfig(
            {
                url: 'https://from-file.example',
                includeHidden: true,
                followTables: false,
                doctypes: ['Customer'],
                modules: ['Selling'],
            },
            {
                frappeVersion: 16,
                url: 'https://from-cli.example',
                includeHidden: false,
                doctypes: ['ToDo'],
                apiKey: 'ck',
            },
        )
        expect(merged.url).toBe('https://from-cli.example')
        expect(merged.includeHidden).toBe(false)
        expect(merged.followTables).toBe(false)
        expect(merged.doctypes).toEqual(['Customer', 'ToDo'])
        expect(merged.modules).toEqual(['Selling'])
        expect(merged.apiKey).toBe('ck')
        expect(merged.apiSecret).toBe('es')
    })

    it('uses FRAPPE_URL when url is not in file or flags', () => {
        setEnv('FRAPPE_URL', 'https://from-env.example')
        expect(mergeConfig(undefined, { frappeVersion: 16 }).url).toBe('https://from-env.example')
        setEnv('FRAPPE_URL', '')
        expect(mergeConfig(undefined, { frappeVersion: 16 }).url).toBeUndefined()
    })
})

describe('loadConfigFile', () => {
    it('reads JSON and rejects secrets', () => {
        const dir = mkdtempSync(join(tmpdir(), 'codegen-'))
        const path = join(dir, 'frappe-codegen.config.json')
        writeFileSync(path, JSON.stringify({ url: 'https://frappe.example.com', doctypes: ['ToDo'] }))
        expect(loadConfigFile(path)).toMatchObject({
            url: 'https://frappe.example.com',
            doctypes: ['ToDo'],
        })
        writeFileSync(path, JSON.stringify({ apiKey: 'nope' }))
        expect(() => loadConfigFile(path)).toThrow(/secrets/)
        writeFileSync(path, '[]')
        expect(() => loadConfigFile(path)).toThrow(/JSON object/)
        writeFileSync(
            path,
            JSON.stringify({
                doctypes: ['ToDo', 1],
                modules: ['Selling', 2],
                includeHidden: 'yes',
            }),
        )
        expect(loadConfigFile(path)).toMatchObject({
            doctypes: ['ToDo'],
            modules: ['Selling'],
            includeHidden: undefined,
        })
        writeFileSync(path, 'null')
        expect(() => loadConfigFile(path)).toThrow(/JSON object/)
        writeFileSync(path, JSON.stringify({ apiSecret: 'nope' }))
        expect(() => loadConfigFile(path)).toThrow(/secrets/)
        writeFileSync(
            path,
            JSON.stringify({
                out: 'types.ts',
                followTables: true,
                includeHidden: false,
            }),
        )
        expect(loadConfigFile(path)).toMatchObject({
            out: 'types.ts',
            followTables: true,
            includeHidden: false,
        })
    })

    it('findDefaultConfigPath returns undefined when missing', () => {
        expect(findDefaultConfigPath(join(tmpdir(), 'no-codegen-config-here'))).toBe(undefined)
        const dir = mkdtempSync(join(tmpdir(), 'codegen-found-'))
        writeFileSync(join(dir, 'frappe-codegen.config.json'), '{}')
        expect(findDefaultConfigPath(dir)).toBe(join(dir, 'frappe-codegen.config.json'))
    })
})
