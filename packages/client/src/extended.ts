/**
 * frappe-js-client/extended — higher-level, more application-specific modules: `permission`,
 * `workflow`, `report`, `desk`, and `site`. Kept out of the root entry point so a CRUD-only
 * consumer does not pay for this code.
 *
 * @example
 * ```ts
 * import { createFrappeClient } from 'frappe-js-client'
 * import { withExtended } from 'frappe-js-client/extended'
 *
 * const frappe = withExtended(createFrappeClient({ url: 'https://frappe.example.com' }))
 * await frappe.workflow.apply(doc, 'Approve')
 * ```
 *
 * @packageDocumentation
 */

import { copyClientInternal, type FrappeClient, getClientInternal } from './client'
import type { AuthStrategy } from './core/auth'
import type { Middleware } from './core/middleware'
import { createFrappeDesk, type FrappeDesk } from './modules/desk'
import { createFrappePermission, type FrappePermission } from './modules/permission'
import { createFrappeReport, type FrappeReport } from './modules/report'
import { createFrappeSite, type FrappeSite } from './modules/site'
import { createFrappeWorkflow, type FrappeWorkflow } from './modules/workflow'

export interface ExtendedFrappeClient<Docs extends object = object> extends FrappeClient<Docs> {
    readonly permission: FrappePermission
    readonly workflow: FrappeWorkflow
    readonly report: FrappeReport
    readonly desk: FrappeDesk
    readonly site: FrappeSite
    withAuth(auth: AuthStrategy): ExtendedFrappeClient<Docs>
    withMiddleware(...middleware: Middleware[]): ExtendedFrappeClient<Docs>
    withHeaders(headers: Record<string, string>): ExtendedFrappeClient<Docs>
}

/**
 * Attaches the extended tier onto an existing core `FrappeClient`, sharing the same transport,
 * auth, and config — no second network client is created.
 *
 * @stable
 */
export function withExtended<Docs extends object = object>(client: FrappeClient<Docs>): ExtendedFrappeClient<Docs> {
    const { deps } = getClientInternal(client)
    const extended: ExtendedFrappeClient<Docs> = {
        ...client,
        permission: createFrappePermission(deps),
        workflow: createFrappeWorkflow(deps),
        report: createFrappeReport(deps),
        desk: createFrappeDesk(deps),
        site: createFrappeSite(deps),
        withAuth: (auth) => withExtended(client.withAuth(auth)),
        withMiddleware: (...middleware) => withExtended(client.withMiddleware(...middleware)),
        withHeaders: (headers) => withExtended(client.withHeaders(headers)),
    }
    copyClientInternal(client, extended)
    return extended
}

export type { FrappeDesk, FrappeShare } from './modules/desk'
export * from './modules/desk/types'
export type { FrappePermission } from './modules/permission'
export * from './modules/permission/types'
export type { FrappeReport } from './modules/report'
export * from './modules/report/types'
export type { FrappeSite, TimeZoneResponse } from './modules/site'
export type { FrappeWorkflow } from './modules/workflow'
export * from './modules/workflow/types'
