/** One prepared HTTP attempt. Policy and serialization belong to RequestPipeline. */
export type ResponseType = 'json' | 'text' | 'blob' | 'arraybuffer'

export interface UploadProgressEvent {
    loaded: number
    total?: number
}

export interface TransportRequest {
    method: string
    /** Absolute HTTP(S) URL. */
    url: string
    headers: Record<string, string>
    body?: BodyInit
    credentials: RequestCredentials
    responseType?: ResponseType
    signal?: AbortSignal
    onUploadProgress?: (event: UploadProgressEvent) => void
}

export interface TransportResponse<T> {
    data: T
    status: number
    statusText: string
    headers: Headers
    /** Original decoded text, when available, for server error mapping. */
    responseText?: string
}

/** A transport performs exactly one HTTP attempt and returns its response, including non-2xx responses. */
export interface Transport {
    request<T>(req: TransportRequest): Promise<TransportResponse<T>>
}
