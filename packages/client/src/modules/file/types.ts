import type { UploadProgressEvent } from '../../core/transport'

export type FileArgs = {
    /** Private by default. */
    isPrivate?: boolean
    folder?: string
    fileUrl?: string
    doctype?: string
    /** Target document `name`. Mapped to wire `docname` so it is not confused with the File's own `name`. */
    docName?: string
    fieldName?: string
    otherData?: { [key: string]: string | Blob }
}

/**
 * Anything `upload` accepts. Deliberately excludes Node's `Buffer` — a public `.d.ts` that
 * references `Buffer` requires `@types/node` to compile, which breaks browser-only consumers.
 * Pass `Uint8Array`/`ArrayBuffer` instead (`Buffer` is itself a `Uint8Array` in Node, so
 * `myBuffer` is already assignable).
 *
 * `ReadableStream` inputs are buffered into a `Blob` before upload — true chunked upload
 * streaming from a `ReadableStream` is not currently supported by the underlying
 * `fetch`/`FormData` platform primitives without additional dependencies, so progress on those
 * inputs is best-effort rather than byte-accurate.
 */
export type FrappeUploadInput = Blob | File | Uint8Array | ArrayBuffer | ReadableStream<Uint8Array>

export interface UploadOptions {
    onProgress?: (progress: UploadProgressEvent) => void
    signal?: AbortSignal
    timeout?: number
    /** Hard wall-clock deadline, including any ReadableStream buffering before upload. */
    deadline?: number
    headers?: Record<string, string>
    requestId?: string
    /** Defaults to `upload_file`. */
    apiPath?: string
    /** Filename sent to the server. Inferred from a `File`'s `.name` when omitted. */
    filename?: string
}

/** The document Frappe's `upload_file` returns for the newly created `File` record. */
export interface FileDoc {
    name: string
    file_name: string
    file_url: string
    is_private: 0 | 1
    file_size?: number
    folder?: string
    attached_to_doctype?: string
    attached_to_name?: string
    attached_to_field?: string
}
