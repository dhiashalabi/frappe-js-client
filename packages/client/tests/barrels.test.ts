import { describe, expect, it, vi } from 'vitest'

import { consoleLogger, emitLog, requestLogPath } from '../src/core/logger'
import * as errorsBarrel from '../src/errors'
import * as extendedBarrel from '../src/extended'
import * as indexBarrel from '../src/index'
import * as middlewareBarrel from '../src/middleware'
import * as realtimeBarrel from '../src/realtime'
import * as testingBarrel from '../src/testing'
import * as typesBarrel from '../src/types'

describe('subpath barrels re-export the core modules', () => {
    it('frappe-js-client (index) exposes the runtime API', () => {
        expect(typeof indexBarrel.createFrappeClient).toBe('function')
        expect(typeof indexBarrel.anonymousAuth).toBe('function')
        expect(typeof indexBarrel.tokenAuth).toBe('function')
        expect(typeof indexBarrel.bearerAuth).toBe('function')
        expect(typeof indexBarrel.oauthAuth).toBe('function')
        expect(typeof indexBarrel.cookieAuth).toBe('function')
        expect(typeof indexBarrel.formatFrappeDate).toBe('function')
        expect(typeof indexBarrel.formatFrappeDatetime).toBe('function')
        expect(typeof indexBarrel.consoleLogger).toBe('function')
        expect(indexBarrel.FrappeError).toBeDefined()
        expect(indexBarrel.FeatureNotSupportedError).toBeDefined()
        expect(indexBarrel.CsrfError).toBeDefined()
        expect(indexBarrel.DuplicateEntryError).toBeDefined()
        expect(indexBarrel.RateLimitError).toBeDefined()
        const client = indexBarrel.createFrappeClient({ frappeVersion: 16, url: 'https://example.com' })
        expect(client.db).toBeDefined()
        expect(client.auth).toBeDefined()
        expect(client.file).toBeDefined()
        expect(client.call).toBeDefined()
        expect(client.search).toBeDefined()
        expect(indexBarrel.formatFrappeDate(new Date(2024, 0, 5))).toBe('2024-01-05')
    })

    it('frappe-js-client/errors', () => {
        expect(errorsBarrel.FrappeError).toBeDefined()
        expect(errorsBarrel.AuthenticationError).toBeDefined()
        expect(errorsBarrel.ConfigurationError).toBeDefined()
        expect(errorsBarrel.TimeoutError).toBeDefined()
        expect(errorsBarrel.CancelledError).toBeDefined()
        expect(errorsBarrel.CsrfError).toBeDefined()
        expect(errorsBarrel.DuplicateEntryError).toBeDefined()
        expect(errorsBarrel.RateLimitError).toBeDefined()
        expect(errorsBarrel.FeatureNotSupportedError).toBeDefined()
        expect(typeof errorsBarrel.mapServerError).toBe('function')
        expect(typeof errorsBarrel.serverErrorFor).toBe('function')
    })

    it('frappe-js-client/middleware', () => {
        expect(middlewareBarrel.retry).toBeDefined()
        expect(middlewareBarrel.timing).toBeDefined()
        expect(typeof middlewareBarrel.composeMiddleware).toBe('function')
        expect((middlewareBarrel as { logging?: unknown }).logging).toBeUndefined()
    })

    it('frappe-js-client/extended, /testing, /realtime, and /types', () => {
        expect(typeof extendedBarrel.withExtended).toBe('function')
        expect(typeof testingBarrel.createTestClient).toBe('function')
        expect(typeof testingBarrel.createExtendedTestClient).toBe('function')
        expect(testingBarrel.MemoryTransport).toBeDefined()
        expect(typeof realtimeBarrel.createRealtime).toBe('function')
        // `/types` is type-only — the ESM/CJS module exists and must be importable.
        expect(typesBarrel).toBeTypeOf('object')
    })
})

describe('consoleLogger', () => {
    it('writes a redacted, structured debug line', () => {
        const spy = vi.spyOn(console, 'debug').mockImplementation(() => undefined)
        consoleLogger().debug({
            method: 'GET',
            path: '/api/v2/method/ping',
            status: 200,
            durationMs: 5,
            requestId: 'req_1',
        })
        expect(spy).toHaveBeenCalledOnce()
        expect(spy.mock.calls[0][0]).toContain('GET /api/v2/method/ping -> 200')
        spy.mockRestore()
    })

    it('renders ERR when status is missing', async () => {
        const spy = vi.spyOn(console, 'debug').mockImplementation(() => undefined)
        consoleLogger().debug({
            method: 'GET',
            path: '/x',
            durationMs: 1,
            requestId: 'r',
        })
        expect(spy.mock.calls[0][0]).toContain('-> ERR')
        spy.mockRestore()
    })

    it('prefers error class name over status in the console line', () => {
        const spy = vi.spyOn(console, 'debug').mockImplementation(() => undefined)
        consoleLogger().debug({
            method: 'GET',
            path: '/x',
            status: 0,
            durationMs: 1,
            requestId: 'r',
            error: 'TransportError',
        })
        expect(spy.mock.calls[0][0]).toContain('-> TransportError')
        spy.mockRestore()
    })
})

describe('emitLog / requestLogPath', () => {
    it('strips query strings even when URL parsing fails', () => {
        expect(requestLogPath('https://example.com/api/v2/ping?sid=secret')).toBe('/api/v2/ping')
        expect(requestLogPath('not a url?sid=secret')).toBe('not a url')
        expect(requestLogPath('not-a-url')).toBe('not-a-url')
    })

    it('swallows logger exceptions', () => {
        expect(() =>
            emitLog(
                {
                    debug() {
                        throw new Error('nope')
                    },
                },
                { method: 'GET', path: '/x', durationMs: 0, requestId: 'r' },
            ),
        ).not.toThrow()
        expect(() => emitLog(undefined, { method: 'GET', path: '/x', durationMs: 0, requestId: 'r' })).not.toThrow()
    })
})
