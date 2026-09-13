/**
 * frappe-js-client/testing — test your own Frappe code without a running server.
 *
 * @example
 * ```ts
 * import { createTestClient } from 'frappe-js-client/testing'
 *
 * const { client, transport } = createTestClient()
 * transport.mock({ method: 'GET', path: '/api/v2/document/User/Administrator', body: fixtureUser })
 * const user = await client.db.getDoc('User', 'Administrator')
 * ```
 *
 * @packageDocumentation
 */

import { createFrappeClient, type FrappeClient } from './client'
import type { FrappeClientOptions } from './core/config'
import { type ExtendedFrappeClient, withExtended } from './extended'
import { MemoryTransport } from './testing/memory-transport'

export * from './testing/fixtures'
export type { MemoryRoute } from './testing/memory-transport'
export { MemoryTransport } from './testing/memory-transport'

/**
 * Builds a core-tier client backed by a `MemoryTransport` instead of the network. The returned
 * `client` is a real `FrappeClient` — assignable anywhere a production client is, and produced
 * by the exact same `createFrappeClient` wiring.
 */
export function createTestClient<Docs extends object = object, Inserts extends object = object>(
    options: Partial<FrappeClientOptions> = {},
): { client: FrappeClient<Docs, Inserts>; transport: MemoryTransport } {
    const url = options.url ?? 'https://test.local'
    const transport = new MemoryTransport()
    const client = createFrappeClient<Docs, Inserts>({
        url,
        ...options,
        frappeVersion: options.frappeVersion ?? 16,
        transport,
    })
    return { client, transport }
}

/** Builds a core + extended tier client backed by a `MemoryTransport` instead of the network. */
export function createExtendedTestClient<Docs extends object = object, Inserts extends object = object>(
    options: Partial<FrappeClientOptions> = {},
): { client: ExtendedFrappeClient<Docs, Inserts>; transport: MemoryTransport } {
    const { client, transport } = createTestClient<Docs, Inserts>(options)
    return { client: withExtended(client), transport }
}
