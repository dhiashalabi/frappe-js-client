/**
 * frappe-js-client — a zero-dependency, fetch-native TypeScript client for Frappe Framework
 * REST APIs (v14, v15, v16).
 *
 * This entry point is the **core tier**: client creation, auth, db, file, call, search. For
 * `permission`, `workflow`, `report`, `desk`, and `site`, import from
 * `frappe-js-client/extended`.
 *
 * @example
 * ```ts
 * import { createFrappeClient, tokenAuth } from 'frappe-js-client'
 *
 * const frappe = createFrappeClient({
 *   url: 'https://frappe.example.com',
 *   auth: tokenAuth({ apiKey: '...', apiSecret: '...' }),
 * })
 *
 * const users = await frappe.db.getDocList('User', { fields: ['name', 'email'], limit: 20 })
 * ```
 *
 * @packageDocumentation
 */

export type { Capabilities, FrappeVersion } from './api/adapter'
export type { FrappeClient } from './client'
export { createFrappeClient } from './client'
export type {
    AuthStrategy,
    BearerAuthOptions,
    CookieRecord,
    FrappeRequestInfo,
    OAuthAuthOptions,
    TokenAuthOptions,
} from './core/auth'
export { anonymousAuth, bearerAuth, cookieAuth, oauthAuth, tokenAuth } from './core/auth'
export type { FrappeClientConfig, FrappeClientOptions } from './core/config'
export * from './core/errors'
export { formatFrappeDate, formatFrappeDatetime } from './core/format'
export type { FrappeLogEvent, FrappeLogger } from './core/logger'
export { consoleLogger } from './core/logger'
export type { FrappeRequest, FrappeResponse, Middleware, NextFn } from './core/middleware'
export type {
    ResponseType,
    Transport,
    TransportRequest,
    TransportResponse,
    UploadProgressEvent,
} from './core/transport'
export type {
    ApiVersion,
    DocFromMap,
    FrappeDoc,
    FrappeDocMetaKeys,
    FrappeInsert,
    Link,
    RequestOptions,
} from './core/types'
export type { FrappeAuth } from './modules/auth'
export * from './modules/auth/types'
export type { FrappeCall } from './modules/call'
export * from './modules/call/types'
export type { FrappeDB } from './modules/db'
export * from './modules/db/types'
export type { FrappeFile } from './modules/file'
export * from './modules/file/types'
export type { FrappeSearch } from './modules/search'
export * from './modules/search/types'
