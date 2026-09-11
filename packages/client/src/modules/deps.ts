/**
 * @module modules/deps
 * @description The only two things a domain module is allowed to depend on for I/O: the adapter
 * (paths, verbs, envelopes, capabilities) and the executor (transport + unwrap). Modules may
 * import `jsonParam` from `core/url` for RPC param serialization. Enforced by dependency-cruiser:
 * `modules/**` must not import `core/fetch`, `api/v1`, or `api/v2`.
 */

import type { ApiAdapter } from '../api/adapter'
import type { Executor } from '../core/executor'

export interface ModuleDeps {
    readonly adapter: ApiAdapter
    readonly executor: Executor
}
