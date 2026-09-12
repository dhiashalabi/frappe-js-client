import { describe, expect, it } from 'vitest'

import { V2Adapter } from '../../src/api/v2'
import { ConfigurationError } from '../../src/core/errors'
import { Executor, unwrapData, unwrapEnvelope, unwrapMessage } from '../../src/core/executor'
import { MemoryTransport } from '../../src/testing'

describe('unwrap helpers', () => {
    it('unwrapData reads {data}, passes primitives through, and returns null for an empty envelope', () => {
        expect(unwrapData({ data: 1 })).toBe(1)
        expect(unwrapData(null)).toBeNull()
        expect(unwrapData('x')).toBe('x')
        expect(unwrapData({ other: 1 })).toEqual({ other: 1 })
        expect(unwrapData({})).toBeNull()
    })

    it('unwrapMessage reads {message}, passes primitives through, and returns null for an empty envelope', () => {
        expect(unwrapMessage({ message: 'z' })).toBe('z')
        expect(unwrapMessage('bare')).toBe('bare')
        expect(unwrapMessage({})).toBeNull()
        expect(unwrapMessage({ other: 1 })).toEqual({ other: 1 })
    })

    it('unwrapEnvelope picks {data} for v2 and {message} for v1', () => {
        expect(unwrapEnvelope(2, { data: 1 })).toBe(1)
        expect(unwrapEnvelope(1, { message: 1 })).toBe(1)
    })
})

describe('Executor', () => {
    it('run() executes an AdapterRequest and applies its unwrap strategy', async () => {
        const transport = new MemoryTransport()
        const executor = new Executor(transport, 2)
        const adapter = new V2Adapter()

        transport.mock({ method: 'GET', path: '/api/v2/doctype/User/count', body: { data: 3 } })
        await expect(executor.run<number>(adapter.count('User'))).resolves.toBe(3)
    })

    it('call() issues a raw request with an explicit unwrap strategy', async () => {
        const transport = new MemoryTransport()
        const executor = new Executor(transport, 2)

        transport.mock({ method: 'POST', path: '/api/method/x', body: { message: 'hi' } })
        await expect(executor.call({ method: 'POST', url: '/api/method/x' }, 'message')).resolves.toBe('hi')

        transport.mock({ method: 'GET', path: '/raw', body: 9 })
        await expect(executor.call({ method: 'GET', url: '/raw' }, 'none')).resolves.toBe(9)
        await expect(executor.call({ method: 'GET', url: '/raw' }, 'data')).resolves.toBe(9)
    })

    it('validates optional request timing before invoking an injected transport', async () => {
        const transport = new MemoryTransport()
        const executor = new Executor(transport, 2)
        transport.mock({ method: 'GET', path: '/timed', body: { data: 'ok' } })

        await expect(
            executor.call({ method: 'GET', url: '/timed' }, 'data', {
                timeout: 100,
                deadline: Date.now() + 1_000,
            }),
        ).resolves.toBe('ok')
        await expect(
            executor.call({ method: 'GET', url: '/invalid' }, 'none', { timeout: Number.NaN }),
        ).rejects.toBeInstanceOf(ConfigurationError)
        await expect(
            executor.call({ method: 'GET', url: '/invalid' }, 'none', { deadline: Number.POSITIVE_INFINITY }),
        ).rejects.toBeInstanceOf(ConfigurationError)
    })
})
