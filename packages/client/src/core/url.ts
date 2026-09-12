/**
 * @module core/url
 * @description The single URL builder. Every path used anywhere in the client is constructed
 * here. Domain modules must not import `api/v1.ts` or `api/v2.ts`, and should not concatenate
 * URL strings by hand.
 */

import { ConfigurationError } from './errors'
import type { ApiVersion } from './types'

function assertSafeSegment(value: string, kind = 'path segment'): string {
    const v = String(value)
    if (!v || v === '.' || v === '..' || v.includes('\0') || /[/\\]/.test(v)) {
        throw new ConfigurationError(`Invalid ${kind}: ${JSON.stringify(value)}`)
    }
    return encodeURIComponent(v)
}

function assertSafeDocumentName(value: string): string {
    const name = String(value)
    if (!name || name.includes('\0') || name.includes('\\')) {
        throw new ConfigurationError(`Invalid document name: ${JSON.stringify(value)}`)
    }
    return name
        .split('/')
        .map((part) => assertSafeSegment(part, 'document name'))
        .join('/')
}

function decodeOnce(value: string): string {
    try {
        return decodeURIComponent(value)
    } catch {
        return value
    }
}

function assertSafeMethodPath(path: string): string {
    const trimmed = path.replace(/^\//, '')
    if (!trimmed) {
        throw new ConfigurationError('Invalid method path')
    }
    return trimmed
        .split('/')
        .map((part) => assertSafeSegment(decodeOnce(part), 'method path'))
        .join('/')
}

/** Classic unversioned RPC — works on Frappe v14, v15, and v16. Never uses `/api/v1`. */
export function classicMethodPath(path: string): string {
    return `/api/method/${assertSafeMethodPath(path)}`
}

export function methodPath(apiVersion: ApiVersion, path: string): string {
    const trimmed = assertSafeMethodPath(path)
    return apiVersion === 2 ? `/api/v2/method/${trimmed}` : classicMethodPath(trimmed)
}

export function resourcePath(apiVersion: ApiVersion, doctype: string, name?: string | null): string {
    const dt = assertSafeSegment(doctype, 'doctype')
    if (name) {
        const n = assertSafeDocumentName(name)
        return apiVersion === 2 ? `/api/v2/document/${dt}/${n}` : `/api/resource/${dt}/${n}`
    }
    return apiVersion === 2 ? `/api/v2/document/${dt}` : `/api/resource/${dt}`
}

export function doctypePath(doctype: string, action: 'meta' | 'count'): string {
    return `/api/v2/doctype/${assertSafeSegment(doctype, 'doctype')}/${action}`
}

export function documentMethodPath(doctype: string, name: string, method: string): string {
    return `/api/v2/document/${assertSafeSegment(doctype, 'doctype')}/${assertSafeDocumentName(name)}/method/${assertSafeSegment(method, 'method')}`
}

/** Encode a v2 `{Doctype}/{method}` controller path. Dotted RPC names are not encoded here. */
export function doctypeMethodPath(doctype: string, method: string): string {
    return `${assertSafeSegment(doctype, 'doctype')}/${assertSafeSegment(method, 'method')}`
}

export function documentCopyPath(doctype: string, name: string): string {
    return `/api/v2/document/${assertSafeSegment(doctype, 'doctype')}/${assertSafeDocumentName(name)}/copy`
}

/** JSON-stringify objects/arrays; pass strings through; drop `null`/`undefined`. */
export function jsonParam(value: unknown): string | undefined {
    if (value === null || value === undefined) {
        return undefined
    }
    if (typeof value === 'string') {
        return value
    }
    return JSON.stringify(value)
}

/**
 * Resolve a `path` (absolute `/api/...` or a full URL) against `baseUrl`, guaranteeing the
 * result never accidentally becomes `https://host/://host/...` (a "double URL"): if `path` is
 * already an absolute URL, it is returned as-is rather than concatenated.
 */
export function buildUrl(baseUrl: string, path: string): string {
    if (/^https?:\/\//i.test(path)) {
        return new URL(path).href
    }
    const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
    const rel = path.startsWith('/') ? path.slice(1) : path
    return new URL(rel, base).href
}

export function toSearchParams(params?: Record<string, unknown>): URLSearchParams {
    const encoded = new URLSearchParams()
    if (!params) {
        return encoded
    }
    Object.entries(params).forEach(([key, value]) => {
        if (value === null || value === undefined) {
            return
        }
        if (typeof value === 'boolean') {
            // Frappe's `sbool`/`cint` param coercion expects `'1'`/`'0'`, not `'true'`/`'false'`.
            encoded.set(key, value ? '1' : '0')
            return
        }
        encoded.set(key, typeof value === 'object' ? JSON.stringify(value) : String(value))
    })
    return encoded
}
