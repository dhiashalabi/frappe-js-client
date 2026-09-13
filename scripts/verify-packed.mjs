#!/usr/bin/env node
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const fixture = mkdtempSync(join(tmpdir(), 'frappe-js-client-packed-'))
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const node = process.execPath
const pnpmScript = process.env.npm_execpath

assert.ok(pnpmScript, 'verify-packed must be run through pnpm')
const pnpm = pnpmScript.match(/\.[cm]?js$/) ? [node, pnpmScript] : [pnpmScript]

function run(file, args, cwd = fixture) {
    return execFileSync(file, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
}

run(pnpm[0], [...pnpm.slice(1), '--dir', resolve(root, 'packages/client'), 'pack', '--pack-destination', fixture])
run(pnpm[0], [...pnpm.slice(1), '--dir', resolve(root, 'packages/codegen'), 'pack', '--pack-destination', fixture])
const tarballs = readdirSync(fixture)
    .filter((name) => name.endsWith('.tgz'))
    .map((name) => join(fixture, name))
assert.equal(tarballs.length, 2, 'expected client and codegen tarballs')

writeFileSync(join(fixture, 'package.json'), JSON.stringify({ private: true, type: 'module' }))
run(npm, ['install', '--ignore-scripts', '--no-package-lock', ...tarballs])
rmSync(join(fixture, 'node_modules/socket.io-client'), { recursive: true, force: true })

writeFileSync(
    join(fixture, 'esm.mjs'),
    `import { createFrappeClient, FrappeError } from 'frappe-js-client'
import { FrappeError as ErrorEntry } from 'frappe-js-client/errors'
import { withExtended } from 'frappe-js-client/extended'
import { retry } from 'frappe-js-client/middleware'
import { createTestClient } from 'frappe-js-client/testing'
import { createRealtime } from 'frappe-js-client/realtime'
import * as types from 'frappe-js-client/types'
import { generateModule } from 'frappe-codegen'
if (FrappeError !== ErrorEntry) throw new Error('ESM error identity differs')
const extended = withExtended(createFrappeClient({ url: 'https://example.com', frappeVersion: 16 }))
if (typeof extended.workflow.apply !== 'function') throw new Error('ESM extended client is broken')
if (typeof retry !== 'function' || typeof createTestClient !== 'function' || typeof createRealtime !== 'function') throw new Error('ESM subpath export is broken')
if (Object.keys(types).length !== 0) throw new Error('types entry should have no runtime exports')
if (!generateModule([{ name: 'ToDo', fields: [] }]).includes('GeneratedDocTypes')) throw new Error('codegen is broken')
`,
)
writeFileSync(
    join(fixture, 'cjs.cjs'),
    `const { createFrappeClient, FrappeError } = require('frappe-js-client')
const { FrappeError: ErrorEntry } = require('frappe-js-client/errors')
const { withExtended } = require('frappe-js-client/extended')
const { retry } = require('frappe-js-client/middleware')
const { createTestClient } = require('frappe-js-client/testing')
const { createRealtime } = require('frappe-js-client/realtime')
const types = require('frappe-js-client/types')
if (FrappeError !== ErrorEntry) throw new Error('CJS error identity differs')
if (typeof withExtended(createFrappeClient({ url: 'https://example.com', frappeVersion: 16 })).workflow.apply !== 'function') throw new Error('CJS extended client is broken')
if (typeof retry !== 'function' || typeof createTestClient !== 'function' || typeof createRealtime !== 'function') throw new Error('CJS subpath export is broken')
if (Object.keys(types).length !== 0) throw new Error('types entry should have no runtime exports')
`,
)
run(node, ['esm.mjs'])
run(node, ['cjs.cjs'])

const codegen = await import(join(fixture, 'node_modules/frappe-codegen/dist/index.mjs'))
writeFileSync(join(fixture, 'generated.ts'), codegen.generateModule([{ name: 'ToDo', fields: [] }]))
writeFileSync(
    join(fixture, 'consumer.ts'),
    `import { createFrappeClient } from 'frappe-js-client'
import type { GeneratedDocTypes, GeneratedInserts } from './generated.js'
const client = createFrappeClient<GeneratedDocTypes, GeneratedInserts>({ url: 'https://example.com', frappeVersion: 16 })
client.db.getDoc('ToDo', 'TD-1').then((doc) => doc.name satisfies string)
`,
)
writeFileSync(
    join(fixture, 'tsconfig.json'),
    JSON.stringify({
        compilerOptions: {
            module: 'NodeNext',
            moduleResolution: 'NodeNext',
            target: 'ES2022',
            strict: true,
            noEmit: true,
            skipLibCheck: false,
        },
        include: ['consumer.ts', 'generated.ts'],
    }),
)
run(node, [resolve(root, 'node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/bin/tsc'), '-p', 'tsconfig.json'])
run(resolve(root, 'packages/client/node_modules/.bin/tsc'), ['-p', 'tsconfig.json'])

writeFileSync(join(fixture, 'browser.mjs'), `import { createFrappeClient } from 'frappe-js-client'
import { withExtended } from 'frappe-js-client/extended'
import { FrappeError } from 'frappe-js-client/errors'
import { retry } from 'frappe-js-client/middleware'
import { createTestClient } from 'frappe-js-client/testing'
import { createRealtime } from 'frappe-js-client/realtime'
import 'frappe-js-client/types'
void [createFrappeClient, withExtended, FrappeError, retry, createTestClient, createRealtime]
`)
run(resolve(root, 'packages/client/node_modules/.bin/esbuild'), ['browser.mjs', '--bundle', '--platform=browser', '--format=esm', '--external:socket.io-client', '--outfile=browser-bundle.mjs'])

const nonRealtime = readdirSync(resolve(root, 'packages/client/dist')).filter(
    (name) => !name.startsWith('realtime') && !name.endsWith('.map'),
)
for (const name of nonRealtime) {
    assert.doesNotMatch(
        readFileSync(resolve(root, 'packages/client/dist', name), 'utf8'),
        /socket\.io-client/,
        `${name} unexpectedly references socket.io-client`,
    )
}

console.log('verify-packed: isolated ESM, CJS, codegen types, and optional realtime boundary are valid')
