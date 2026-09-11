#!/usr/bin/env node
/**
 * Post-build smoke test against the actual published artifacts (both module formats, plus the
 * CLI binary itself).
 *
 * Unit tests only exercise `src/`. This runs against `dist/` after every build, so a broken
 * tsup output (missing export, ESM/CJS divergence, a `cli.js` that fails to boot because of a
 * bad shebang or unresolved external) fails the build instead of shipping.
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.join(dir, '..', 'dist')

const SAMPLE_META = [
    {
        name: 'ToDo',
        fields: [{ fieldname: 'description', fieldtype: 'Small Text', reqd: 1 }],
    },
]

const EXPECTED_EXPORTS = [
    'DEFAULT_CONFIG_NAME',
    'findDefaultConfigPath',
    'loadConfigFile',
    'mergeConfig',
    'assertUniqueInterfaceNames',
    'generateInterface',
    'generateModule',
    'toInterfaceName',
    'fetchDocTypeMeta',
    'fetchDocTypeMetas',
    'fetchWithOptionalFollow',
    'followChildTables',
    'resolveDocTypes',
]

function assertExports(mod, label) {
    for (const name of EXPECTED_EXPORTS) {
        assert.equal(
            typeof mod[name],
            name === 'DEFAULT_CONFIG_NAME' ? 'string' : 'function',
            `${label}: missing or wrong-typed export ${name}`,
        )
    }
}

async function verifyEsm() {
    const mod = await import(path.join(distDir, 'index.mjs'))
    assertExports(mod, 'ESM')
    const source = mod.generateModule(SAMPLE_META)
    assert.match(source, /export type ToDo = FrappeDoc</, 'ESM: generateModule must emit the expected interface')
}

function verifyCjs() {
    const require = createRequire(import.meta.url)
    const mod = require(path.join(distDir, 'index.js'))
    assertExports(mod, 'CJS')
    const source = mod.generateModule(SAMPLE_META)
    assert.match(source, /export type ToDo = FrappeDoc</, 'CJS: generateModule must emit the expected interface')
}

function verifyCli() {
    const stdout = execFileSync(process.execPath, [path.join(distDir, 'cli.js'), '--help'], {
        encoding: 'utf8',
    })
    assert.match(stdout, /frappe-codegen — generate typed interfaces/, 'CLI: --help must print the usage banner')
    assert.match(stdout, /Usage:/, 'CLI: --help must print usage instructions')
}

await verifyEsm()
verifyCjs()
verifyCli()

console.log('verify-dist: ok (ESM + CJS entry parity, generateModule smoke test, CLI --help)')
