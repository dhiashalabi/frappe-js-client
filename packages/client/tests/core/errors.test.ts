import { describe, expect, it } from 'vitest'

import {
    AuthenticationError,
    CancelledError,
    FeatureNotSupportedError,
    FrappeError,
    mapNetworkError,
    mapServerError,
    NotFoundError,
    parseServerMessages,
    PermissionError,
    ServerError,
    serverErrorFor,
    TimeoutError,
    TransportError,
    ValidationError,
} from '../../src/core/errors'

describe('core/errors', () => {
    it('every subclass is an instanceof FrappeError', () => {
        expect(new AuthenticationError({ status: 401, message: 'x' })).toBeInstanceOf(FrappeError)
        expect(new PermissionError({ status: 403, message: 'x' })).toBeInstanceOf(FrappeError)
        expect(new NotFoundError({ status: 404, message: 'x' })).toBeInstanceOf(FrappeError)
        expect(new ValidationError({ status: 417, message: 'x' })).toBeInstanceOf(FrappeError)
        expect(new FeatureNotSupportedError('runMethod', 'requires apiVersion: 2.')).toBeInstanceOf(FrappeError)
    })

    it('serverErrorFor maps status codes to the right subclass', () => {
        expect(serverErrorFor(401)).toBe(AuthenticationError)
        expect(serverErrorFor(403)).toBe(PermissionError)
        expect(serverErrorFor(404)).toBe(NotFoundError)
        expect(serverErrorFor(417)).toBe(ValidationError)
        expect(serverErrorFor(400, 'ValidationError')).toBe(ValidationError)
        expect(serverErrorFor(500)).toBe(ServerError)
    })

    it('preserves the original failure via `cause`', () => {
        const original = new TypeError('network down')
        const error = new FrappeError({ status: 0, message: 'Request failed', cause: original })
        expect(error.cause).toBe(original)
    })

    it('preserves the raw response body even when it cannot be parsed as JSON', () => {
        const error = new FrappeError({ status: 500, message: 'Request failed', responseText: '<html>not json</html>' })
        expect(error.responseText).toBe('<html>not json</html>')
    })

    it('never surfaces headers or body on the request context — only method/url/requestId', () => {
        const error = new FrappeError({
            status: 500,
            message: 'x',
            request: { method: 'POST', url: 'https://example.com/api/method/x', requestId: 'req_1' },
        })
        expect(Object.keys(error.request!).sort()).toEqual(['method', 'requestId', 'url'])
    })

    it('FeatureNotSupportedError names the feature and the reason', () => {
        const error = new FeatureNotSupportedError('copyDoc', 'requires apiVersion: 2.')
        expect(error.message).toBe('copyDoc requires apiVersion: 2.')
    })

    it('collects extra fields under `extra`, never shadowing a named field', () => {
        const error = new FrappeError({
            status: 500,
            message: 'x',
            extra: { name: 'ignored', message: 'ignored', foo: 1, cause: 'ignored' },
        })
        expect(error.extra.foo).toBe(1)
        expect(error.message).toBe('x')
        expect(error.name).not.toBe('ignored')
        expect(Object.isFrozen(error.extra)).toBe(true)
    })

    it('parseServerMessages accepts JSON strings, arrays, and nested JSON strings', () => {
        expect(parseServerMessages(undefined)).toEqual([])
        expect(parseServerMessages({ not: 'array' })).toEqual([])
        expect(parseServerMessages('not-json')).toEqual([])
        expect(parseServerMessages('{"message":"x"}')).toEqual([])
        expect(parseServerMessages(['{"message":"a"}', { message: 'b', title: 'T' }, 'nope', 1])).toEqual([
            { message: 'a' },
            { message: 'b', title: 'T' },
        ])
        expect(parseServerMessages(JSON.stringify([{ message: 'c' }]))).toEqual([{ message: 'c' }])
    })

    it('mapServerError preserves _server_messages and extra fields (v1 envelope)', () => {
        const error = mapServerError(
            { status: 417, statusText: 'Expectation Failed' },
            {
                message: 'bad',
                exc_type: 'ValidationError',
                _server_messages: JSON.stringify([{ message: 'field required' }]),
                extra_key: 1,
            },
            'raw',
            { method: 'POST', url: 'https://example.com/x', requestId: 'r1' },
        )
        expect(error).toBeInstanceOf(ValidationError)
        expect(error.serverMessages).toEqual([{ message: 'field required' }])
        expect(error.extra.extra_key).toBe(1)
        expect(error.responseText).toBe('raw')
    })

    it('mapServerError maps the v2 { errors: [...] } envelope, with no top-level exc_type', () => {
        const error = mapServerError(
            { status: 404, statusText: 'Not Found' },
            {
                errors: [
                    {
                        type: 'DoesNotExistError',
                        message: 'User abc not found',
                        exception: 'frappe.exceptions.DoesNotExistError: User abc not found',
                    },
                ],
            },
            '{}',
            { method: 'GET', url: 'https://example.com/x' },
        )
        expect(error).toBeInstanceOf(NotFoundError)
        expect(error.frappeExceptionType).toBe('DoesNotExistError')
        expect(error.message).toBe('User abc not found')
        expect(error.errors?.[0]?.type).toBe('DoesNotExistError')
    })

    it('mapServerError falls back to the last traceback line when no message field is present', () => {
        const error = mapServerError(
            { status: 500, statusText: 'Internal Server Error' },
            {
                exception:
                    'Traceback (most recent call last):\n  File "x.py"\nfrappe.exceptions.ValidationError: Field is required',
            },
            '{}',
            { method: 'GET', url: 'https://example.com/x' },
        )
        expect(error.message).toBe('frappe.exceptions.ValidationError: Field is required')

        const whitespaceOnly = mapServerError(
            { status: 502, statusText: 'Bad Gateway' },
            { exception: '\n\n   \n' },
            '{}',
            { method: 'GET', url: 'https://example.com/x' },
        )
        expect(whitespaceOnly.message).toBe('Request failed with status 502')
    })

    it('serverErrorFor prefers exc_type over status for DuplicateEntryError / RateLimitError / CsrfError', () => {
        expect(serverErrorFor(500, 'DuplicateEntryError').name).toBe('DuplicateEntryError')
        expect(serverErrorFor(500, 'TooManyRequestsError').name).toBe('RateLimitError')
        expect(serverErrorFor(400, 'CSRFTokenError').name).toBe('CsrfError')
        expect(serverErrorFor(409).name).toBe('DuplicateEntryError')
        expect(serverErrorFor(429).name).toBe('RateLimitError')
    })

    it('mapNetworkError classifies TimeoutError by DOMException name', () => {
        const request = { method: 'GET', url: 'https://example.com/x' }
        expect(mapNetworkError(new DOMException('Timeout', 'TimeoutError'), request, 5)).toBeInstanceOf(TimeoutError)
        const aborted = new AbortController()
        aborted.abort()
        expect(mapNetworkError(new DOMException('Aborted', 'AbortError'), request, 5, aborted.signal)).toBeInstanceOf(
            TimeoutError,
        )
        expect(mapNetworkError(new DOMException('Aborted', 'AbortError'), request, 5)).toBeInstanceOf(CancelledError)
        expect(mapNetworkError(new DOMException('DataCloneError', 'DataCloneError'), request, 5)).toBeInstanceOf(
            TransportError,
        )
    })
})
