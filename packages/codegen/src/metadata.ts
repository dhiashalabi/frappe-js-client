/**
 * @module metadata
 * @description Fetches DocType metadata from a live Frappe site via `frappe-js-client`'s
 * `db.getMeta()` (v2-only — `GET /api/v2/doctype/{doctype}/meta`) and normalizes it into the
 * small shape `generate.ts` needs.
 */

import { FrappeClient } from 'frappe-js-client'

export interface DocField {
    fieldname: string
    fieldtype: string
    label?: string
    options?: string
    reqd?: 0 | 1
    hidden?: 0 | 1
    description?: string
    is_virtual?: 0 | 1
}

export interface DocTypeMeta {
    name: string
    fields: DocField[]
    istable?: 0 | 1
    /** True for the small set of built-in single-instance DocTypes (e.g. `System Settings`). */
    issingle?: 0 | 1
}

/** Raw shape returned by `GET /api/v2/doctype/{doctype}/meta`. Only the fields we use are typed. */
interface RawDocTypeMeta {
    name?: string
    fields?: DocField[]
    istable?: 0 | 1
    issingle?: 0 | 1
    [key: string]: unknown
}

/** Fetches and normalizes the metadata for one DocType. Requires a v2 client. */
export async function fetchDocTypeMeta(client: FrappeClient, doctype: string): Promise<DocTypeMeta> {
    try {
        const raw = await client.db.getMeta<RawDocTypeMeta>(doctype)
        return {
            name: raw.name ?? doctype,
            fields: raw.fields ?? [],
            istable: raw.istable,
            issingle: raw.issingle,
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        const name = error instanceof Error ? error.name : ''
        if (name === 'FeatureNotSupportedError' || name === 'NotFoundError') {
            throw new Error(
                `frappe-codegen requires Frappe v15+ REST API v2 (GET /api/v2/doctype/{doctype}/meta). ` +
                    `Could not fetch metadata for ${JSON.stringify(doctype)}: ${message}`,
                { cause: error },
            )
        }
        throw error
    }
}

const FETCH_CONCURRENCY = 4

async function mapPool<T, R>(items: readonly T[], concurrency: number, mapper: (item: T) => Promise<R>): Promise<R[]> {
    if (items.length === 0) return []
    const results: R[] = new Array(items.length)
    let next = 0
    async function worker(): Promise<void> {
        while (next < items.length) {
            const index = next
            next += 1
            results[index] = await mapper(items[index]!)
        }
    }
    const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
    await Promise.all(workers)
    return results
}

/** Fetches metadata for several DocTypes with a small concurrency pool. */
export async function fetchDocTypeMetas(client: FrappeClient, doctypes: readonly string[]): Promise<DocTypeMeta[]> {
    return mapPool(doctypes, FETCH_CONCURRENCY, (doctype) => fetchDocTypeMeta(client, doctype))
}
