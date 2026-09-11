/**
 * @module realtime
 * @description `frappe-js-client/realtime` entry point. Requires the optional peer dependency
 * `socket.io-client` (only when `connect()` is actually called — see `realtime/index.ts`).
 */
export { createRealtime } from './realtime/index'
export type {
    DocUpdateEvent,
    DocViewersEvent,
    EvictionEvent,
    FrappeRealtime,
    ListUpdateEvent,
    RealtimeAuthContext,
    RealtimeConnectionEventMap,
    RealtimeEventName,
    RealtimeOptions,
    Unsubscribe,
} from './realtime/types'
