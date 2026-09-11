import type { RequestOptions } from '../../core/types'
import type { ModuleDeps } from '../deps'
import type { FileArgs, FileDoc, FrappeUploadInput, UploadOptions } from './types'

function toBlob(data: unknown): Blob {
    if (data instanceof Blob) return data
    if (data instanceof Uint8Array) {
        const copy = new Uint8Array(data.byteLength)
        copy.set(data)
        return new Blob([copy])
    }
    if (data instanceof ArrayBuffer) return new Blob([data])
    if (typeof data === 'string') return new Blob([data])
    return new Blob([])
}

async function toUploadBlob(file: FrappeUploadInput): Promise<{ blob: Blob; filename?: string }> {
    if (typeof File !== 'undefined' && file instanceof File) {
        return { blob: file, filename: file.name }
    }
    if (typeof Blob !== 'undefined' && file instanceof Blob) {
        return { blob: file }
    }
    if (file instanceof Uint8Array) {
        return { blob: new Blob([Uint8Array.from(file)]) }
    }
    if (file instanceof ArrayBuffer) {
        return { blob: new Blob([file]) }
    }
    if (typeof ReadableStream !== 'undefined' && file instanceof ReadableStream) {
        const chunks: Uint8Array[] = []
        const reader = file.getReader()

        while (true) {
            const { done, value } = await reader.read()
            if (done) break
            if (value) chunks.push(value)
        }
        return { blob: new Blob(chunks as BlobPart[]) }
    }
    throw new TypeError(
        'upload: unsupported `file` input. Expected Blob, File, Uint8Array, ArrayBuffer, or ReadableStream.',
    )
}

class FrappeFileImpl {
    private readonly adapter: ModuleDeps['adapter']
    private readonly executor: ModuleDeps['executor']

    /** @internal */
    constructor(deps: ModuleDeps) {
        this.adapter = deps.adapter
        this.executor = deps.executor
    }

    /**
     * Browser upload progress uses XHR when no middleware is configured.
     * Combining `onProgress` with client middleware throws `ConfigurationError` — XHR cannot
     * run the middleware pipeline.
     */
    async upload<T = FileDoc>(file: FrappeUploadInput, args: FileArgs, options?: UploadOptions): Promise<T> {
        const { blob, filename: inferredFilename } = await toUploadBlob(file)
        const filename = options?.filename ?? inferredFilename ?? 'upload.bin'

        const formData = new FormData()
        formData.append('file', blob, filename)

        const { isPrivate, folder, fileUrl, doctype, docName, fieldName, otherData } = args
        if (folder) formData.append('folder', folder)
        if (fileUrl) formData.append('file_url', fileUrl)
        if (doctype && docName) {
            formData.append('doctype', doctype)
            formData.append('docname', docName)
            if (fieldName) formData.append('fieldname', fieldName)
        }
        if (otherData) {
            for (const key of Object.keys(otherData)) {
                if (key.toLowerCase() === 'is_private') continue
                formData.append(key, otherData[key])
            }
        }
        formData.append('is_private', isPrivate === false ? '0' : '1')

        return this.executor.call<T>(
            {
                method: 'POST',
                url: this.adapter.classicMethod(options?.apiPath ?? 'upload_file'),
                data: formData,
                onUploadProgress: options?.onProgress,
            },
            'message',
            {
                headers: options?.headers,
                signal: options?.signal,
                timeout: options?.timeout,
                requestId: options?.requestId,
            },
        )
    }

    async download(fileURL: string, options?: RequestOptions): Promise<Blob> {
        const data = await this.executor.call<unknown>(
            {
                method: 'GET',
                url: this.adapter.classicMethod('download_file'),
                params: { file_url: fileURL },
                responseType: 'arraybuffer',
            },
            'none',
            options,
        )
        return toBlob(data)
    }
}

export type FrappeFile = FrappeFileImpl

/** @internal */
export function createFrappeFile(deps: ModuleDeps): FrappeFile {
    return new FrappeFileImpl(deps)
}

export * from './types'
