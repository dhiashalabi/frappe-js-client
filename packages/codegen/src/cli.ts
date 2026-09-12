#!/usr/bin/env node
/**
 * @module cli
 * @description `frappe-codegen` — reads DocType metadata from a live Frappe site and writes a
 * generated `.ts` file of typed interfaces. See `README.md` for usage.
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'

import { anonymousAuth, createFrappeClient, tokenAuth } from 'frappe-js-client'

import { CliOverlay, findDefaultConfigPath, loadConfigFile, mergeConfig } from './config'
import { generateModule } from './generate'
import { fetchWithOptionalFollow, resolveDocTypes } from './resolve'

const HELP = `frappe-codegen — generate typed interfaces from a live Frappe site's DocType metadata.

Usage:
  frappe-codegen -u <site-url> -d "Sales Order" [-d "Customer" ...] [options]
  frappe-codegen --config frappe-codegen.config.json

Required after config/env merge:
  -u, --url <url>                    Frappe site base URL (or FRAPPE_URL / config "url")
  at least one --doctype, --module, or config doctypes/modules

Auth (or FRAPPE_API_KEY / FRAPPE_API_SECRET; omit for anonymous meta reads):
  --api-key <key>                    Frappe API key
  --api-secret <secret>              Frappe API secret

Output:
  -o, --out <path>                   Output .ts file. Default: ./frappe-types.generated.ts

DocTypes:
  -d, --doctype <name>               DocType to generate. Repeatable.
  --module <name>                    All DocTypes in this Frappe module. Repeatable.
  --follow-tables                    Also generate Table / Table MultiSelect children (default)
  --no-follow-tables                 Do not follow child tables
  --dry-run                          Print resolved DocType names and exit

Options:
  --config <path>                    JSON config file (default: ./frappe-codegen.config.json if present)
  --include-hidden                   Emit fields marked "hidden" on the form (default: included).
                                     Frappe "hidden" is form visibility, not "not on the document" —
                                     e.g. Reminder.user and Reminder.notified.
  --no-include-hidden                Omit form-hidden fields
  --include-labels                   Emit a "/** label */" doc comment above each field (default: true)
  --no-include-labels                Omit field labels
  --include-doctype-map              Emit GeneratedDocTypes / GeneratedInserts (default: true)
  --no-include-doctype-map           Omit the lookup interfaces
  -h, --help                         Show this help text

Example:
  frappe-codegen --url https://frappe.example.com --api-key $FRAPPE_API_KEY --api-secret $FRAPPE_API_SECRET \\
    --doctype "Sales Order" --out src/generated/frappe-types.ts
`

export function parseCliArgs(argv: string[]): CliOverlay | { help: true } {
    const { values } = parseArgs({
        args: argv,
        options: {
            url: { type: 'string', short: 'u' },
            doctype: { type: 'string', multiple: true, short: 'd' },
            module: { type: 'string', multiple: true },
            'api-key': { type: 'string' },
            'api-secret': { type: 'string' },
            out: { type: 'string', short: 'o' },
            config: { type: 'string' },
            'include-hidden': { type: 'boolean' },
            'include-labels': { type: 'boolean' },
            'include-doctype-map': { type: 'boolean' },
            'follow-tables': { type: 'boolean' },
            'dry-run': { type: 'boolean' },
            help: { type: 'boolean', default: false, short: 'h' },
        },
        allowNegative: true,
    })

    if (values.help) {
        return { help: true }
    }

    const overlay: CliOverlay = {
        url: values.url,
        out: values.out,
        doctypes: values.doctype,
        modules: values.module,
        apiKey: values['api-key'],
        apiSecret: values['api-secret'],
        includeHidden: values['include-hidden'],
        includeLabels: values['include-labels'],
        emitDocTypeMap: values['include-doctype-map'],
        followTables: values['follow-tables'],
        dryRun: values['dry-run'],
        configPath: values.config,
    }
    return overlay
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
    try {
        const parsed = parseCliArgs(argv)
        if ('help' in parsed) {
            process.stdout.write(HELP)
            return
        }

        const configPath = parsed.configPath ?? findDefaultConfigPath()
        const file = configPath ? loadConfigFile(configPath) : undefined
        const config = mergeConfig(file, parsed)

        if (!config.url) {
            throw new Error('--url is required (or FRAPPE_URL / config url). Run --help for usage.')
        }
        if (config.doctypes.length === 0 && config.modules.length === 0) {
            throw new Error(
                'At least one --doctype or --module is required (or config doctypes/modules). Run --help for usage.',
            )
        }

        const auth =
            config.apiKey && config.apiSecret
                ? tokenAuth({ apiKey: config.apiKey, apiSecret: config.apiSecret })
                : anonymousAuth()
        const client = createFrappeClient({ url: config.url, apiVersion: 2, auth })

        process.stderr.write(`Fetching DocType names from ${config.url} ...\n`)
        const names = await resolveDocTypes(client, {
            doctypes: config.doctypes,
            modules: config.modules,
        })
        if (names.length === 0) {
            throw new Error('No DocTypes matched. Check --doctype / --module.')
        }

        process.stderr.write(
            `Fetching metadata for ${names.length} DocType(s)${config.followTables ? ' (following child tables)' : ''} ...\n`,
        )
        const metas = await fetchWithOptionalFollow(client, names, config.followTables)

        if (config.dryRun) {
            const seed = new Set(names)
            for (const meta of metas) {
                const tag = seed.has(meta.name) ? 'seed' : 'child'
                process.stdout.write(`${meta.name}\t${tag}\n`)
            }
            return
        }

        const source = generateModule(metas, {
            includeHidden: config.includeHidden,
            includeLabels: config.includeLabels,
            emitDocTypeMap: config.emitDocTypeMap,
        })

        mkdirSync(dirname(config.out), { recursive: true })
        writeFileSync(config.out, source, 'utf8')
        process.stderr.write(`Wrote ${metas.length} interface(s) to ${config.out}\n`)
    } catch (error) {
        process.stderr.write(`frappe-codegen failed: ${error instanceof Error ? error.message : String(error)}\n`)
        process.exitCode = 1
    }
}

export function isDirectCliRun(entry = process.argv[1], moduleUrl = import.meta.url): boolean {
    if (typeof entry !== 'string' || !entry) return false
    if (/(?:^|[/\\])cli\.(?:cjs|js|mjs|ts)$/.test(entry)) return true
    return pathToFileURL(entry).href === moduleUrl
}

export function boot(entry = process.argv[1], run: () => Promise<void> = main): void {
    if (isDirectCliRun(entry)) {
        void run()
    }
}

boot()
