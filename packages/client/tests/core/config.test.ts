import { describe, expect, it } from 'vitest'

import { anonymousAuth } from '../../src/core/auth'
import { deriveConfig, normalizeConfig } from '../../src/core/config'
import { ConfigurationError } from '../../src/core/errors'

describe('core/config', () => {
    it('normalizes and freezes the config', () => {
        const config = normalizeConfig({ url: 'https://example.com/' })
        expect(config.baseUrl).toBe('https://example.com')
        expect(config.apiVersion).toBe(2)
        expect(config.timeout).toBe(30_000)
        expect(Object.isFrozen(config)).toBe(true)
    })

    it('throws ConfigurationError (not a silent console.warn) for an invalid URL', () => {
        expect(() => normalizeConfig({ url: 'not a url' })).toThrow(ConfigurationError)
        expect(() => normalizeConfig({ url: '' })).toThrow(ConfigurationError)
    })

    it('rejects non-http(s) protocols', () => {
        expect(() => normalizeConfig({ url: 'ftp://example.com' })).toThrow(ConfigurationError)
    })

    it('rejects an invalid apiVersion', () => {
        expect(() => normalizeConfig({ url: 'https://example.com', apiVersion: 3 as any })).toThrow(ConfigurationError)
    })

    it('rejects an invalid frappeVersion', () => {
        expect(() => normalizeConfig({ url: 'https://example.com', frappeVersion: 13 as any })).toThrow(
            ConfigurationError,
        )
        expect(normalizeConfig({ url: 'https://example.com', frappeVersion: 16 }).frappeVersion).toBe(16)
    })

    it('rejects a non-positive timeout', () => {
        expect(() => normalizeConfig({ url: 'https://example.com', timeout: 0 })).toThrow(ConfigurationError)
        expect(() => normalizeConfig({ url: 'https://example.com', timeout: -1 })).toThrow(ConfigurationError)
        expect(() => normalizeConfig({ url: 'https://example.com', timeout: Number.NaN })).toThrow(ConfigurationError)
        expect(() => normalizeConfig({ url: 'https://example.com', timeout: Number.POSITIVE_INFINITY })).toThrow(
            ConfigurationError,
        )
    })

    it('defaults auth to anonymousAuth when omitted', () => {
        const config = normalizeConfig({ url: 'https://example.com' })
        expect(config.auth.name).toBe('anonymous')
    })

    it('deriveConfig produces an independent, still-frozen config', () => {
        const base = normalizeConfig({ url: 'https://example.com', headers: { 'X-A': '1' } })
        const derived = deriveConfig(base, { headers: { 'X-B': '2' } })
        expect(derived).not.toBe(base)
        expect(derived.headers).toEqual({ 'X-A': '1', 'X-B': '2' })
        expect(base.headers).toEqual({ 'X-A': '1' })
        expect(Object.isFrozen(derived)).toBe(true)
    })

    it('deriveConfig can swap the auth strategy without touching the base config', () => {
        const base = normalizeConfig({ url: 'https://example.com' })
        const newAuth = anonymousAuth()
        const derived = deriveConfig(base, { auth: newAuth })
        expect(derived.auth).toBe(newAuth)
        expect(base.auth).not.toBe(newAuth)
    })

    it('deriveConfig preserves logger and siteName', () => {
        const logger = { debug() {} }
        const base = normalizeConfig({
            url: 'https://example.com',
            logger,
            siteName: 'site.local',
        })
        const derived = deriveConfig(base, {})
        expect(derived.logger).toBe(logger)
        expect(derived.siteName).toBe('site.local')
    })

    it('keeps a path that has no trailing slash', () => {
        expect(normalizeConfig({ url: 'https://example.com/app' }).baseUrl).toBe('https://example.com/app')
    })
})
