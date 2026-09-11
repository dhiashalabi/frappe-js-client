/**
 * @module resolve
 * @description Collect DocType names from flags/config/modules and follow Table children.
 */

import { FrappeClient } from 'frappe-js-client'

import { isTableFieldType } from './field-types'
import { DocTypeMeta, fetchDocTypeMetas } from './metadata'

export async function listDocTypesInModule(client: FrappeClient, moduleName: string): Promise<string[]> {
    const names: string[] = []
    for await (const row of client.db.paginate('DocType', {
        filters: [['module', '=', moduleName]],
        fields: ['name'],
        limit: 100,
    })) {
        if (typeof row.name === 'string') {
            names.push(row.name)
        }
    }
    return names
}

export async function resolveDocTypes(
    client: FrappeClient,
    seeds: { doctypes: readonly string[]; modules: readonly string[] },
): Promise<string[]> {
    const names = new Set<string>(seeds.doctypes)
    for (const moduleName of seeds.modules) {
        for (const name of await listDocTypesInModule(client, moduleName)) {
            names.add(name)
        }
    }
    return [...names]
}

export function childTableDoctypes(meta: DocTypeMeta): string[] {
    const children: string[] = []
    for (const field of meta.fields) {
        if (isTableFieldType(field.fieldtype) && field.options) {
            children.push(field.options)
        }
    }
    return children
}

/** Fetch seed metas, then recursively fetch Table / Table MultiSelect children. */
export async function followChildTables(client: FrappeClient, seeds: readonly DocTypeMeta[]): Promise<DocTypeMeta[]> {
    const byName = new Map<string, DocTypeMeta>()
    for (const meta of seeds) {
        byName.set(meta.name, meta)
    }
    const pending = new Set<string>()
    for (const meta of seeds) {
        for (const child of childTableDoctypes(meta)) {
            if (!byName.has(child)) pending.add(child)
        }
    }

    while (pending.size > 0) {
        const batch = [...pending]
        pending.clear()
        const fetched = await fetchDocTypeMetas(client, batch)
        for (const meta of fetched) {
            byName.set(meta.name, meta)
            for (const child of childTableDoctypes(meta)) {
                if (!byName.has(child)) pending.add(child)
            }
        }
    }

    return [...byName.values()]
}

export async function fetchWithOptionalFollow(
    client: FrappeClient,
    doctypes: readonly string[],
    followTables: boolean,
): Promise<DocTypeMeta[]> {
    const seeds = await fetchDocTypeMetas(client, doctypes)
    if (!followTables) return seeds
    return followChildTables(client, seeds)
}
