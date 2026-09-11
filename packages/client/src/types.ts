/**
 * frappe-js-client/types — type-only entry point. Safe to import in code that must not pull in
 * any runtime (e.g. shared type packages, codegen output).
 *
 * @packageDocumentation
 */
export type {
    AdapterRequest,
    ApiAdapter,
    Capabilities,
    FrappeVersion,
    ListParams,
    ListResult,
    Unwrap,
} from './api/adapter'
export type { FrappeClient } from './client'
export type { AuthStrategy, CookieRecord, FrappeRequestInfo } from './core/auth'
export type { FrappeClientConfig, FrappeClientOptions } from './core/config'
export type { FrappeErrorInit, FrappeRequestContext, FrappeV2ErrorEntry, ServerMessage } from './core/errors'
export type { FrappeRequest, FrappeResponse, Middleware, NextFn } from './core/middleware'
export type {
    ApiVersion,
    DocFromMap,
    FrappeDoc,
    FrappeDocMetaKeys,
    FrappeInsert,
    Link,
    RequestOptions,
} from './core/types'
export type { ExtendedFrappeClient } from './extended'
export type { FrappeAuth } from './modules/auth'
export type { AuthCredentials, AuthResponse, OTPCredentials, UserPassCredentials } from './modules/auth/types'
export type { FrappeCall } from './modules/call'
export type { ApiArgs } from './modules/call/types'
export type { FrappeDB } from './modules/db'
export type { Filter, GetDocListArgs, MultiValueFilter, RowFor, SingleValueFilter, Value } from './modules/db/types'
export type { FrappeDesk, FrappeShare } from './modules/desk'
export type { FrappeFile } from './modules/file'
export type { FileDoc, FrappeUploadInput } from './modules/file/types'
export type { FrappePermission } from './modules/permission'
export type { FrappeReport } from './modules/report'
export type { FrappeSearch } from './modules/search'
export type { LinkSearchResult } from './modules/search/types'
export type { FrappeSite } from './modules/site'
export type { FrappeWorkflow } from './modules/workflow'
