import type { RequestOptions } from '../../core/types'
import type { ModuleDeps } from '../deps'

export interface TimeZoneResponse {
    time_zone: string
}

/** Site-level settings that are not document CRUD. */
class FrappeSiteImpl {
    private readonly adapter: ModuleDeps['adapter']
    private readonly executor: ModuleDeps['executor']

    /** @internal */
    constructor(deps: ModuleDeps) {
        this.adapter = deps.adapter
        this.executor = deps.executor
    }

    getTimeZone(options?: RequestOptions): Promise<TimeZoneResponse> {
        return this.executor.call<TimeZoneResponse>(
            { method: 'GET', url: this.adapter.method('frappe.client.get_time_zone') },
            'envelope',
            options,
        )
    }
}

export type FrappeSite = FrappeSiteImpl

/** @internal */
export function createFrappeSite(deps: ModuleDeps): FrappeSite {
    return new FrappeSiteImpl(deps)
}
