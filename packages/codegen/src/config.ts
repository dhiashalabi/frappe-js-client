/**
 * @module config
 * @description Loads `frappe-codegen.config.json` (no secrets). CLI flags and FRAPPE_* env override.
 */

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export const DEFAULT_CONFIG_NAME = 'frappe-codegen.config.json'

export interface CodegenFileConfig {
    url?: string
    out?: string
    includeHidden?: boolean
    followTables?: boolean
    doctypes?: string[]
    modules?: string[]
}

export interface ResolvedCodegenConfig {
    url?: string
    out: string
    includeHidden: boolean
    followTables: boolean
    doctypes: string[]
    modules: string[]
    apiKey?: string
    apiSecret?: string
    dryRun: boolean
    emitDocTypeMap: boolean
    includeLabels: boolean
}

export function loadConfigFile(path: string): CodegenFileConfig {
    const raw = readFileSync(path, 'utf8')
    const parsed: unknown = JSON.parse(raw)
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error(`frappe-codegen: ${path} must be a JSON object`)
    }
    const obj = parsed as Record<string, unknown>
    if ('apiKey' in obj || 'apiSecret' in obj || 'api-key' in obj) {
        throw new Error('frappe-codegen: do not put API secrets in the config file; use --api-key / FRAPPE_API_KEY')
    }
    return {
        url: typeof obj.url === 'string' ? obj.url : undefined,
        out: typeof obj.out === 'string' ? obj.out : undefined,
        includeHidden: typeof obj.includeHidden === 'boolean' ? obj.includeHidden : undefined,
        followTables: typeof obj.followTables === 'boolean' ? obj.followTables : undefined,
        doctypes: Array.isArray(obj.doctypes)
            ? obj.doctypes.filter((d): d is string => typeof d === 'string')
            : undefined,
        modules: Array.isArray(obj.modules) ? obj.modules.filter((d): d is string => typeof d === 'string') : undefined,
    }
}

export function findDefaultConfigPath(cwd = process.cwd()): string | undefined {
    const candidate = resolve(cwd, DEFAULT_CONFIG_NAME)
    return existsSync(candidate) ? candidate : undefined
}

export interface CliOverlay {
    url?: string
    out?: string
    includeHidden?: boolean
    followTables?: boolean
    doctypes?: string[]
    modules?: string[]
    apiKey?: string
    apiSecret?: string
    dryRun?: boolean
    emitDocTypeMap?: boolean
    includeLabels?: boolean
    configPath?: string
}

function envString(name: string): string | undefined {
    const value = process.env[name]
    return value && value.length > 0 ? value : undefined
}

/** Merge file config, then env, then CLI flags (last wins). */
export function mergeConfig(file: CodegenFileConfig | undefined, overlay: CliOverlay): ResolvedCodegenConfig {
    const envUrl = envString('FRAPPE_URL')
    const envKey = envString('FRAPPE_API_KEY')
    const envSecret = envString('FRAPPE_API_SECRET')

    const doctypes = [...(file?.doctypes ?? []), ...(overlay.doctypes ?? [])]
    const modules = [...(file?.modules ?? []), ...(overlay.modules ?? [])]

    return {
        url: overlay.url ?? envUrl ?? file?.url,
        out: overlay.out ?? file?.out ?? './frappe-types.generated.ts',
        includeHidden: overlay.includeHidden ?? file?.includeHidden ?? true,
        followTables: overlay.followTables ?? file?.followTables ?? true,
        doctypes: [...new Set(doctypes)],
        modules: [...new Set(modules)],
        apiKey: overlay.apiKey ?? envKey,
        apiSecret: overlay.apiSecret ?? envSecret,
        dryRun: overlay.dryRun ?? false,
        emitDocTypeMap: overlay.emitDocTypeMap ?? true,
        includeLabels: overlay.includeLabels ?? true,
    }
}
