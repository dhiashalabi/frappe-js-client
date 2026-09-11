#!/usr/bin/env node
/**
 * Post-build smoke test against the actual published artifacts (both module formats).
 *
 * This exists because tsup can silently duplicate module-level state (classes, WeakMaps)
 * across entry points when code-splitting is off. A duplicate `FrappeError` class per entry
 * breaks `instanceof` across `frappe-js-client` / `frappe-js-client/errors`, breaks
 * `withExtended`, and breaks the `retry` middleware's `instanceof` checks. None of this is
 * visible from `src/`-only unit tests, so it is verified here, against `dist/`, after every
 * build.
 */
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.join(dir, '..', 'dist')

async function verifyEsm() {
    const {
        createFrappeClient,
        FrappeError: MainFrappeError,
        ConfigurationError,
        ServerError,
    } = await import(path.join(distDir, 'index.mjs'))
    const { FrappeError: ErrFrappeError } = await import(path.join(distDir, 'errors.mjs'))
    const { withExtended } = await import(path.join(distDir, 'extended.mjs'))
    const { retry, composeMiddleware } = await import(path.join(distDir, 'middleware.mjs'))
    const { createTestClient } = await import(path.join(distDir, 'testing.mjs'))

    assert.equal(MainFrappeError, ErrFrappeError, 'ESM: FrappeError must be the same class across index/errors')

    const configError = new ConfigurationError('x')
    assert.ok(configError instanceof ErrFrappeError, 'ESM: errors-entry instanceof must catch main-entry errors')

    const client = createFrappeClient({ url: 'https://example.com' })
    const extended = withExtended(client)
    assert.equal(typeof extended.workflow.apply, 'function', 'ESM: withExtended must attach the extended modules')

    let attempts = 0
    const pipeline = composeMiddleware([retry({ attempts: 1, baseDelayMs: 0 })], async () => {
        attempts++
        throw new ServerError({ status: 500, message: 'boom' })
    })
    await pipeline({ method: 'GET', url: 'https://example.com/x', headers: {}, requestId: 'r' }).catch(() => {})
    assert.equal(attempts, 2, 'ESM: retry() must retry a ServerError thrown by the main-entry transport shape')

    const { client: testClient } = createTestClient()
    assert.ok(testClient.config, 'ESM: createTestClient() must return a real FrappeClient (has .config)')
    assert.equal(typeof testClient.withAuth, 'function', 'ESM: createTestClient() client must support withAuth')
}

function verifyCjs() {
    const require = createRequire(import.meta.url)
    const { createFrappeClient, FrappeError: MainFrappeError, ConfigurationError } = require(
        path.join(distDir, 'index.js'),
    )
    const { FrappeError: ErrFrappeError } = require(path.join(distDir, 'errors.js'))
    const { withExtended } = require(path.join(distDir, 'extended.js'))
    const { createTestClient } = require(path.join(distDir, 'testing.js'))

    assert.equal(MainFrappeError, ErrFrappeError, 'CJS: FrappeError must be the same class across index/errors')
    assert.ok(new ConfigurationError('x') instanceof ErrFrappeError, 'CJS: errors-entry instanceof must work')

    const client = createFrappeClient({ url: 'https://example.com' })
    const extended = withExtended(client)
    assert.equal(typeof extended.workflow.apply, 'function', 'CJS: withExtended must attach the extended modules')

    const { client: testClient } = createTestClient()
    assert.ok(testClient.config, 'CJS: createTestClient() must return a real FrappeClient (has .config)')
}

await verifyEsm()
verifyCjs()

console.log('verify-dist: ok (ESM + CJS entry identity, withExtended, retry, testing entry)')
