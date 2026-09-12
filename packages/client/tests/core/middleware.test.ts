import { afterEach, describe, expect, it, vi } from 'vitest'

import { CancelledError, ConfigurationError, NotFoundError, TimeoutError, TransportError } from '../../src/core/errors'
import {
    composeMiddleware,
    FrappeRequest,
    FrappeResponse,
    redactBody,
    redactHeaders,
    retry,
    timing,
} from '../../src/core/middleware'

function req(overrides: Partial<FrappeRequest> = {}): FrappeRequest {
    return { method: 'GET', url: 'https://example.com/api/method/x', headers: {}, requestId: 'req_1', ...overrides }
}

function res(overrides: Partial<FrappeResponse> = {}): FrappeResponse {
    return { status: 200, statusText: 'OK', headers: new Headers(), body: {}, ...overrides }
}

describe('core/middleware', () => {
    afterEach(() => {
        vi.useRealTimers()
        vi.restoreAllMocks()
    })
    it('composes middleware so the first entry runs outermost', () => {
        const order: string[] = []
        const a = async (r: FrappeRequest, next: any) => {
            order.push('a-before')
            const out = await next(r)
            order.push('a-after')
            return out
        }
        const b = async (r: FrappeRequest, next: any) => {
            order.push('b-before')
            const out = await next(r)
            order.push('b-after')
            return out
        }
        const pipeline = composeMiddleware([a, b], async () => {
            order.push('terminal')
            return res()
        })
        return pipeline(req()).then(() => {
            expect(order).toEqual(['a-before', 'b-before', 'terminal', 'b-after', 'a-after'])
        })
    })

    describe('retry', () => {
        it('does not retry non-idempotent verbs by default', async () => {
            let calls = 0
            const mw = retry()
            const pipeline = composeMiddleware([mw], async () => {
                calls++
                throw new Error('boom')
            })
            await expect(pipeline(req({ method: 'POST' }))).rejects.toThrow('boom')
            expect(calls).toBe(1)
        })

        it('retries idempotent verbs on failure up to `attempts`', async () => {
            let calls = 0
            const mw = retry({ attempts: 2, baseDelayMs: 0 })
            const pipeline = composeMiddleware([mw], async () => {
                calls++
                if (calls < 3) throw new TransportError({ status: 0, message: 'boom' })
                return res()
            })
            const result = await pipeline(req({ method: 'GET' }))
            expect(calls).toBe(3)
            expect(result.status).toBe(200)
        })

        it('gives up after exhausting attempts', async () => {
            let calls = 0
            const mw = retry({ attempts: 1, baseDelayMs: 0 })
            const pipeline = composeMiddleware([mw], async () => {
                calls++
                throw new TransportError({ status: 0, message: 'boom' })
            })
            await expect(pipeline(req({ method: 'GET' }))).rejects.toThrow('boom')
            expect(calls).toBe(2)
        })

        it('does not retry 4xx, cancel, or timeout by default', async () => {
            let calls = 0
            const mw = retry({ attempts: 2, baseDelayMs: 0 })
            const notFound = composeMiddleware([mw], async () => {
                calls++
                throw new NotFoundError({ status: 404, message: 'missing' })
            })
            await expect(notFound(req())).rejects.toBeInstanceOf(NotFoundError)
            expect(calls).toBe(1)

            calls = 0
            const cancelled = composeMiddleware([mw], async () => {
                calls++
                throw new CancelledError({ status: 0, message: 'Request was cancelled' })
            })
            await expect(cancelled(req())).rejects.toBeInstanceOf(CancelledError)
            expect(calls).toBe(1)
        })

        it('does not retry a generic thrown Error', async () => {
            let calls = 0
            const mw = retry({ attempts: 2, baseDelayMs: 0 })
            const pipeline = composeMiddleware([mw], async () => {
                calls++
                throw new Error('nope')
            })
            await expect(pipeline(req())).rejects.toThrow('nope')
            expect(calls).toBe(1)
        })

        it('aborts during backoff', async () => {
            const controller = new AbortController()
            const mw = retry({ attempts: 2, baseDelayMs: 30 })
            const pipeline = composeMiddleware([mw], async () => {
                throw new TransportError({ status: 0, message: 'down' })
            })
            const pending = pipeline(req({ signal: controller.signal }))
            await Promise.resolve()
            controller.abort()
            await expect(pending).rejects.toBeInstanceOf(CancelledError)
        })

        it('does not wait when the signal is already aborted', async () => {
            const controller = new AbortController()
            controller.abort()
            const mw = retry({ attempts: 1, baseDelayMs: 20 })
            const pipeline = composeMiddleware([mw], async () => {
                throw new TransportError({ status: 0, message: 'down' })
            })
            await expect(pipeline(req({ signal: controller.signal }))).rejects.toBeInstanceOf(CancelledError)
        })

        it('rejects invalid retry configuration', () => {
            for (const attempts of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
                expect(() => retry({ attempts })).toThrow(ConfigurationError)
            }
            for (const baseDelayMs of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
                expect(() => retry({ baseDelayMs })).toThrow(ConfigurationError)
            }
            for (const maxDelayMs of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
                expect(() => retry({ maxDelayMs })).toThrow(ConfigurationError)
            }
            expect(() => retry({ attempts: 0, baseDelayMs: 0 })).not.toThrow()
        })

        it('stops during backoff when the overall deadline expires', async () => {
            let calls = 0
            const pipeline = composeMiddleware([retry({ attempts: 2, baseDelayMs: 50 })], async () => {
                calls++
                throw new TransportError({ status: 0, message: 'down' })
            })

            await expect(pipeline(req({ deadline: Date.now() + 5 }))).rejects.toBeInstanceOf(TimeoutError)
            expect(calls).toBe(1)
        })

        it('rejects before backoff when the deadline is already exhausted', async () => {
            const pipeline = composeMiddleware([retry({ attempts: 1, baseDelayMs: 20 })], async () => {
                throw new TransportError({ status: 0, message: 'down' })
            })

            await expect(pipeline(req({ deadline: Date.now() - 1 }))).rejects.toBeInstanceOf(TimeoutError)
        })

        it('removes its abort listener after a completed backoff', async () => {
            const controller = new AbortController()
            const remove = vi.spyOn(controller.signal, 'removeEventListener')
            let calls = 0
            const pipeline = composeMiddleware([retry({ attempts: 1, baseDelayMs: 1 })], async () => {
                calls++
                if (calls === 1) throw new TransportError({ status: 0, message: 'down' })
                return res()
            })

            await expect(pipeline(req({ signal: controller.signal }))).resolves.toMatchObject({ status: 200 })
            expect(remove).toHaveBeenCalledOnce()
        })

        it('honors Retry-After before retrying', async () => {
            vi.useFakeTimers()
            let calls = 0
            const pipeline = composeMiddleware([retry({ attempts: 1 })], async () => {
                calls++
                if (calls === 1) {
                    return res({ status: 429, headers: new Headers({ 'Retry-After': '2' }) })
                }
                return res()
            })

            const pending = pipeline(req())
            await vi.advanceTimersByTimeAsync(1999)
            expect(calls).toBe(1)
            await vi.advanceTimersByTimeAsync(1)
            await expect(pending).resolves.toMatchObject({ status: 200 })
        })

        it('supports HTTP-date Retry-After and ignores invalid values', async () => {
            vi.useFakeTimers()
            vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
            let calls = 0
            const dated = composeMiddleware([retry({ attempts: 1 })], async () => {
                calls++
                return calls === 1
                    ? res({ status: 503, headers: new Headers({ 'Retry-After': 'Thu, 01 Jan 2026 00:00:02 GMT' }) })
                    : res()
            })
            const datedPending = dated(req())
            await vi.advanceTimersByTimeAsync(2000)
            await expect(datedPending).resolves.toMatchObject({ status: 200 })

            calls = 0
            const invalid = composeMiddleware([retry({ attempts: 1, baseDelayMs: 1 })], async () => {
                calls++
                return calls === 1 ? res({ status: 503, headers: new Headers({ 'Retry-After': 'later' }) }) : res()
            })
            const invalidPending = invalid(req())
            await vi.advanceTimersByTimeAsync(1)
            await expect(invalidPending).resolves.toMatchObject({ status: 200 })
        })

        it('can ignore Retry-After for response and error retries', async () => {
            let responseCalls = 0
            const responsePipeline = composeMiddleware(
                [retry({ attempts: 1, baseDelayMs: 0, respectRetryAfter: false })],
                async () => {
                    responseCalls++
                    return responseCalls === 1
                        ? res({ status: 503, headers: new Headers({ 'Retry-After': '60' }) })
                        : res()
                },
            )
            await expect(responsePipeline(req())).resolves.toMatchObject({ status: 200 })

            let errorCalls = 0
            const errorPipeline = composeMiddleware(
                [
                    retry({
                        attempts: 1,
                        baseDelayMs: 0,
                        respectRetryAfter: false,
                        shouldRetry: () => true,
                    }),
                ],
                async () => {
                    errorCalls++
                    if (errorCalls === 1) throw new Error('retry me')
                    return res()
                },
            )
            await expect(errorPipeline(req())).resolves.toMatchObject({ status: 200 })
        })

        it('uses normal backoff when a retryable non-Frappe error has no server delay', async () => {
            let calls = 0
            const pipeline = composeMiddleware(
                [retry({ attempts: 1, baseDelayMs: 0, shouldRetry: () => true })],
                async () => {
                    calls++
                    if (calls === 1) throw new Error('retry me')
                    return res()
                },
            )
            await expect(pipeline(req())).resolves.toMatchObject({ status: 200 })
        })

        it('caps exponential backoff and applies optional jitter', async () => {
            vi.useFakeTimers()
            vi.spyOn(Math, 'random').mockReturnValue(0.5)
            let calls = 0
            const pipeline = composeMiddleware(
                [retry({ attempts: 1, baseDelayMs: 10_000, maxDelayMs: 1000, jitter: true })],
                async () => {
                    calls++
                    if (calls === 1) throw new TransportError({ status: 0, message: 'down' })
                    return res()
                },
            )

            const pending = pipeline(req())
            await vi.advanceTimersByTimeAsync(499)
            expect(calls).toBe(1)
            await vi.advanceTimersByTimeAsync(1)
            await expect(pending).resolves.toMatchObject({ status: 200 })
        })
    })

    describe('redaction', () => {
        it('redacts known-sensitive headers', () => {
            const redacted = redactHeaders({
                Authorization: 'token secret:value',
                'X-Custom': 'keep-me',
                Cookie: 'sid=abc',
            })
            expect(redacted.Authorization).toBe('[redacted]')
            expect(redacted.Cookie).toBe('[redacted]')
            expect(redacted['X-Custom']).toBe('keep-me')
        })

        it('redacts known-sensitive body keys without mutating the original', () => {
            const body = { api_secret: 'shh', name: 'Administrator' }
            const redacted = redactBody(body) as Record<string, unknown>
            expect(redacted.api_secret).toBe('[redacted]')
            expect(redacted.name).toBe('Administrator')
            expect(body.api_secret).toBe('shh')
        })
    })

    it('retry returns a 429/5xx after exhausting attempts, and respects shouldRetry', async () => {
        let calls = 0
        const mw = retry({ attempts: 1, baseDelayMs: 0 })
        const pipeline = composeMiddleware([mw], async () => {
            calls++
            return res({ status: 503 })
        })
        expect((await pipeline(req())).status).toBe(503)
        expect(calls).toBe(2)

        const noRetry = retry({
            attempts: 3,
            baseDelayMs: 0,
            shouldRetry: () => false,
        })
        let n = 0
        const p2 = composeMiddleware([noRetry], async () => {
            n++
            throw new Error('nope')
        })
        await expect(p2(req())).rejects.toThrow('nope')
        expect(n).toBe(1)

        const customMethods = retry({ attempts: 1, baseDelayMs: 0, methods: ['POST'] })
        let posts = 0
        const p3 = composeMiddleware([customMethods], async () => {
            posts++
            if (posts < 2) throw new TransportError({ status: 0, message: 'again' })
            return res()
        })
        await p3(req({ method: 'POST' }))
        expect(posts).toBe(2)
    })

    it('timing reports both success and failure', async () => {
        const timings: unknown[] = []
        const ok = composeMiddleware([timing({ onTiming: (i) => timings.push(i) })], async () => res())
        await ok(req())
        expect(timings[0]).toMatchObject({ status: 200, method: 'GET' })

        const fail = composeMiddleware([timing({ onTiming: (i) => timings.push(i) })], async () => {
            throw new Error('boom')
        })
        await expect(fail(req())).rejects.toThrow('boom')
        expect(timings.at(-1)).toMatchObject({ method: 'GET' })
        expect((timings.at(-1) as { status?: number }).status).toBeUndefined()
    })

    it('redactBody passes through primitives and redacts arrays of objects', () => {
        expect(redactBody(null)).toBeNull()
        expect(redactBody('x')).toBe('x')
        const copied = redactBody(['keep']) as unknown[]
        expect(copied).toEqual(['keep'])
        expect(copied).not.toBe(['keep'])
    })
})
