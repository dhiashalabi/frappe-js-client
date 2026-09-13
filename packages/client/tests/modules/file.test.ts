import { describe, expect, it } from 'vitest'

import { createTestClient } from '../../src/testing'

describe('FrappeFile', () => {
    it('does not wait forever for stream cleanup after an upload deadline', async () => {
        const { client } = createTestClient()
        const stream = new ReadableStream<Uint8Array>({
            pull: () => new Promise<void>(() => undefined),
            cancel: () => new Promise<void>(() => undefined),
        })
        const outcome = await Promise.race([
            client.file.upload(stream, {}, { deadline: Date.now() + 5 }).then(
                () => 'resolved',
                (error: Error) => error.name,
            ),
            new Promise<string>((resolve) => setTimeout(() => resolve('pending'), 50)),
        ])
        expect(outcome).toBe('TimeoutError')
        expect(stream.locked).toBe(false)
    })
    it('upload sends multipart/form-data to /api/method/upload_file', async () => {
        const { client, transport } = createTestClient()
        transport.mock({
            method: 'POST',
            path: '/api/method/upload_file',
            body: { message: { file_url: '/files/x.txt', name: 'x.txt' } },
        })

        const result = await client.file.upload<{ file_url: string }>(new Blob(['hello']), { isPrivate: true })
        expect(result.file_url).toBe('/files/x.txt')
        expect(transport.requests[0]?.body).toBeInstanceOf(FormData)
    })

    it('accepts a Uint8Array input', async () => {
        const { client, transport } = createTestClient()
        transport.mock({ method: 'POST', path: '/api/method/upload_file', body: { message: {} } })
        await client.file.upload(new Uint8Array([1, 2, 3]), {})
        expect(transport.requests[0]?.body).toBeInstanceOf(FormData)
    })

    it('reports best-effort progress around the upload', async () => {
        const { client, transport } = createTestClient()
        transport.mock({ method: 'POST', path: '/api/method/upload_file', body: { message: {} } })
        const events: { loaded: number; total?: number }[] = []
        await client.file.upload(new Blob(['hello']), {}, { onProgress: (e) => events.push(e) })
        // MemoryTransport does not itself emit progress; this documents the option is threaded
        // through to the transport call. Real progress is covered by fetch.test.ts against a
        // stubbed global fetch/XHR.
        expect(transport.requests[0]?.onUploadProgress).toBeTypeOf('function')
    })

    it('download returns a Blob', async () => {
        const { client, transport } = createTestClient()
        transport.mock({ method: 'GET', path: '/api/method/download_file', body: 'file contents' })
        const blob = await client.file.download('/files/x.txt')
        expect(blob).toBeInstanceOf(Blob)
    })

    it('accepts File, ArrayBuffer, string, ReadableStream, and attachment args', async () => {
        const { client, transport } = createTestClient()
        transport.mock({ method: 'POST', path: '/api/method/upload_file', body: { message: {} } })

        await client.file.upload(new File(['hi'], 'a.txt'), {
            isPrivate: false,
            folder: 'Home',
            fileUrl: '/files/a.txt',
            doctype: 'ToDo',
            docName: 'x',
            otherData: { foo: 'bar', is_private: 'skip' },
        })
        const form = transport.requests.at(-1)?.body as FormData
        expect(form.get('doctype')).toBe('ToDo')
        expect(form.get('docname')).toBe('x')
        expect(form.has('fieldname')).toBe(false)

        await client.file.upload(
            new File(['hi'], 'a.txt'),
            {
                isPrivate: false,
                folder: 'Home',
                fileUrl: '/files/a.txt',
                doctype: 'ToDo',
                docName: 'x',
                fieldName: 'attach',
                otherData: { foo: 'bar', is_private: 'skip' },
            },
            { filename: 'custom.txt', apiPath: 'upload_file' },
        )

        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(new Uint8Array([1]))
                controller.enqueue(undefined as any)
                controller.close()
            },
        })
        await client.file.upload(stream, {})

        await client.file.upload(new ArrayBuffer(4), {})

        await expect(client.file.upload(123 as any, {})).rejects.toThrow(/unsupported/)
    })

    it('cancels a ReadableStream while it is being buffered', async () => {
        const { client } = createTestClient()
        const abort = new AbortController()
        let streamCancelled = false
        const stream = new ReadableStream<Uint8Array>({
            pull() {
                return new Promise<void>(() => undefined)
            },
            cancel() {
                streamCancelled = true
            },
        })

        const pending = client.file.upload(stream, {}, { signal: abort.signal })
        await Promise.resolve()
        abort.abort()

        await expect(pending).rejects.toMatchObject({ name: 'CancelledError' })
        expect(streamCancelled).toBe(true)
    })

    it('enforces a deadline while a ReadableStream is being buffered', async () => {
        const { client } = createTestClient()
        let streamCancelled = false
        const stream = new ReadableStream<Uint8Array>({
            pull() {
                return new Promise<void>(() => undefined)
            },
            cancel() {
                streamCancelled = true
            },
        })

        await expect(client.file.upload(stream, {}, { deadline: Date.now() + 5 })).rejects.toMatchObject({
            name: 'TimeoutError',
        })
        expect(streamCancelled).toBe(true)
    })

    it('validates timeout before buffering a ReadableStream', async () => {
        const { client } = createTestClient()
        const stream = new ReadableStream<Uint8Array>({
            start(controller) {
                controller.enqueue(new Uint8Array([1]))
                controller.close()
            },
        })

        await expect(client.file.upload(stream, {}, { timeout: -1 })).rejects.toMatchObject({
            name: 'ConfigurationError',
        })
        const { done, value } = await stream.getReader().read()
        expect(done).toBe(false)
        expect(value).toEqual(new Uint8Array([1]))
    })

    it('rejects an already-expired deadline before buffering a ReadableStream', async () => {
        const { client } = createTestClient()
        const stream = new ReadableStream<Uint8Array>({
            start(controller) {
                controller.enqueue(new Uint8Array([1, 2, 3]))
                controller.close()
            },
        })

        await expect(client.file.upload(stream, {}, { deadline: Date.now() - 1 })).rejects.toMatchObject({
            name: 'TimeoutError',
        })
        const { done, value } = await stream.getReader().read()
        expect(done).toBe(false)
        expect(value).toEqual(new Uint8Array([1, 2, 3]))
    })

    it('propagates stream read failures and handles an already-aborted signal', async () => {
        const { client } = createTestClient()
        const failed = new ReadableStream<Uint8Array>({
            pull(controller) {
                controller.error(new Error('stream failed'))
            },
        })
        await expect(client.file.upload(failed, {})).rejects.toThrow('stream failed')

        const abort = new AbortController()
        abort.abort()
        const neverRead = new ReadableStream<Uint8Array>({
            pull() {
                return new Promise<void>(() => undefined)
            },
        })
        await expect(client.file.upload(neverRead, {}, { signal: abort.signal })).rejects.toMatchObject({
            name: 'CancelledError',
        })
    })

    it('download wraps ArrayBuffer, Blob, and other bodies', async () => {
        const { client, transport } = createTestClient()
        transport.mock({ method: 'GET', path: '/api/method/download_file', body: new ArrayBuffer(2), once: true })
        expect(await client.file.download('/a')).toBeInstanceOf(Blob)
        transport.mock({ method: 'GET', path: '/api/method/download_file', body: new Blob(['x']), once: true })
        expect(await client.file.download('/b')).toBeInstanceOf(Blob)
        transport.mock({ method: 'GET', path: '/api/method/download_file', body: 'plain text', once: true })
        expect(await client.file.download('/d')).toBeInstanceOf(Blob)
        transport.mock({ method: 'GET', path: '/api/method/download_file', body: { not: 'bytes' }, once: true })
        await expect(client.file.download('/c')).rejects.toMatchObject({ name: 'ResponseError' })
        transport.mock({ method: 'GET', path: '/api/method/download_file', body: new Uint8Array([9, 8]), once: true })
        expect(await client.file.download('/e')).toBeInstanceOf(Blob)
    })
})
