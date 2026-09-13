/**
 * @module client
 * @description `createFrappeClient` — the one public factory. Returns an immutable client:
 * `withAuth`/`withMiddleware`/`withHeaders` derive a new client rather than mutating this one.
 */

import type { ApiAdapter } from './api/adapter'
import { V1Adapter } from './api/v1'
import { V2Adapter } from './api/v2'
import type { AuthStrategy } from './core/auth'
import { deriveConfig, type FrappeClientConfig, type FrappeClientOptions, normalizeConfig } from './core/config'
import { ConfigurationError } from './core/errors'
import { Executor } from './core/executor'
import { FetchTransport } from './core/fetch'
import type { Middleware } from './core/middleware'
import { RequestPipeline } from './core/pipeline'
import type { Transport } from './core/transport'
import { createFrappeAuth, type FrappeAuth } from './modules/auth'
import { createFrappeCall, type FrappeCall } from './modules/call'
import { createFrappeDB, type FrappeDB } from './modules/db'
import type { ModuleDeps } from './modules/deps'
import { createFrappeFile, type FrappeFile } from './modules/file'
import { createFrappeSearch, type FrappeSearch } from './modules/search'

/** Internal wiring exposed only so `frappe-js-client/extended` can attach extended modules onto the same transport. Not part of the stable API. @internal */
export interface FrappeClientInternal {
    readonly deps: ModuleDeps
    readonly transport: Transport
    readonly config: FrappeClientConfig
}

/**
 * @stable
 */
export interface FrappeClient<Docs extends object = object, Inserts extends object = object> {
    readonly config: FrappeClientConfig
    readonly auth: FrappeAuth
    readonly db: FrappeDB<Docs, Inserts>
    readonly file: FrappeFile
    readonly call: FrappeCall
    readonly search: FrappeSearch

    withAuth(auth: AuthStrategy): FrappeClient<Docs, Inserts>
    withMiddleware(...middleware: Middleware[]): FrappeClient<Docs, Inserts>
    withHeaders(headers: Record<string, string>): FrappeClient<Docs, Inserts>
}

const INTERNAL_SYMBOL = Symbol('FrappeClientInternal')

/** @internal Used by `frappe-js-client/extended`. Not part of the stable API. */
export function getClientInternal(client: object): FrappeClientInternal {
    const internal = (client as any)[INTERNAL_SYMBOL]
    if (!internal) {
        throw new ConfigurationError('getClientInternal: client was not created by createFrappeClient')
    }
    return internal
}

/** @internal Copies transport wiring onto a derived client object (e.g. `withExtended`). */
export function copyClientInternal(from: object, to: object): void {
    Object.defineProperty(to, INTERNAL_SYMBOL, {
        value: getClientInternal(from),
        enumerable: false,
        configurable: false,
        writable: false,
    })
}

function buildAdapter(config: FrappeClientConfig): ApiAdapter {
    return config.apiVersion === 2 ? new V2Adapter(config.frappeVersion) : new V1Adapter(config.frappeVersion)
}

/** Builds the module set shared by `createFrappeClient` and `frappe-js-client/testing`'s `createTestClient`. */
export function buildCoreModules<Docs extends object = object, Inserts extends object = object>(
    deps: ModuleDeps,
    auth: AuthStrategy,
): Pick<FrappeClient<Docs, Inserts>, 'auth' | 'db' | 'file' | 'call' | 'search'> {
    return {
        auth: createFrappeAuth(deps, auth),
        db: createFrappeDB<Docs, Inserts>(deps),
        file: createFrappeFile(deps),
        call: createFrappeCall(deps),
        search: createFrappeSearch(deps),
    }
}

function buildClient<Docs extends object = object, Inserts extends object = object>(
    config: FrappeClientConfig,
): FrappeClient<Docs, Inserts> {
    const adapter = buildAdapter(config)
    const transport = config.transport ?? new FetchTransport(config.fetch)
    const executor = new Executor(new RequestPipeline(config, transport), adapter.version)
    const deps: ModuleDeps = { adapter, executor }

    const client: FrappeClient<Docs, Inserts> = {
        config,
        ...buildCoreModules<Docs, Inserts>(deps, config.auth),
        withAuth: (auth) => buildClient<Docs, Inserts>(deriveConfig(config, { auth })),
        withMiddleware: (...middleware) =>
            buildClient<Docs, Inserts>(deriveConfig(config, { middleware: [...config.middleware, ...middleware] })),
        withHeaders: (headers) => buildClient<Docs, Inserts>(deriveConfig(config, { headers })),
    }
    Object.defineProperty(client, INTERNAL_SYMBOL, {
        value: { deps, transport, config },
        enumerable: false,
        configurable: false,
        writable: false,
    })
    return client
}

/**
 * Creates a client for a single Frappe site.
 *
 * @stable
 * @example
 * ```ts
 * const frappe = createFrappeClient({
 *   url: 'https://frappe.example.com',
 *   frappeVersion: 16,
 *   auth: tokenAuth({ apiKey, apiSecret }),
 * })
 * const users = await frappe.db.getDocList('User', { fields: ['name', 'email'], limit: 20 })
 * ```
 */
export function createFrappeClient<Docs extends object = object, Inserts extends object = object>(
    options: FrappeClientOptions,
): FrappeClient<Docs, Inserts> {
    return buildClient<Docs, Inserts>(normalizeConfig(options))
}
