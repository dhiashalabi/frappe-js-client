/**
 * @module realtime/types
 * @description Public types for `frappe-js-client/realtime`. This subpath is the only place in
 * the package that depends on `socket.io-client` — it is an optional peer dependency, loaded
 * lazily (`import('socket.io-client')`) so the core client stays zero-dependency.
 */

/** A `frappe.publish_realtime` / `doc_update` payload for a single document. */
export interface DocUpdateEvent {
    doctype: string
    name: string
    /** The rest of the changed-doc payload the server sent alongside `doctype`/`name`. */
    [key: string]: unknown
}

/** A `list_update` payload — a doctype-level change notification (no single document). */
export interface ListUpdateEvent {
    doctype: string
    /** The rest of the payload the server sent alongside `doctype`. */
    [key: string]: unknown
}

/** Someone else has this document open (`doc_viewers`). */
export interface DocViewersEvent {
    doctype: string
    name: string
    viewers: Array<{ user: string; [key: string]: unknown }>
}

/** Emitted by the server when it evicts a client (session ended, kicked, etc.). */
export interface EvictionEvent {
    userId?: string
    [key: string]: unknown
}

/** Events the underlying socket connection itself can emit. */
export interface RealtimeConnectionEventMap {
    connect: void
    disconnect: string
    reconnect: number
    reconnect_attempt: number
    reconnect_error: Error
    reconnect_failed: void
    connect_error: Error
}

export type RealtimeEventName = keyof RealtimeConnectionEventMap

/** Unsubscribe handle returned by every `subscribe*`/`on` method. Call it to stop listening. */
export type Unsubscribe = () => void

export interface RealtimeAuthContext {
    /** `Cookie` header value, when the client uses `cookieAuth()` outside a browser. */
    cookie?: string
    /** `Authorization` header value, when the client uses token/bearer/oauth auth. */
    authorization?: string
}

export interface RealtimeOptions {
    /**
     * Socket.IO server URL. Defaults to the `FrappeClient`'s `config.baseUrl` — correct for
     * setups that proxy `/socket.io` on the same origin as the site (the default Frappe
     * bench/nginx layout). Override for a dedicated realtime host/port.
     */
    socketUrl?: string
    /** Socket.IO path. Default `/socket.io`. */
    path?: string
    /** Default `true`. */
    reconnection?: boolean
    /** Default `Infinity` — matches Frappe's own `socketio_client.js`. */
    reconnectionAttempts?: number
    /** Default `1000` ms. */
    reconnectionDelay?: number
    /** Default `5000` ms. */
    reconnectionDelayMax?: number
    /**
     * Extra `socket.handshake.auth` payload, merged over the client's derived auth context
     * (`{ cookie, authorization }`). Use this for setups with a custom realtime auth scheme.
     */
    auth?:
        | Record<string, unknown>
        | ((ctx: RealtimeAuthContext) => Record<string, unknown> | Promise<Record<string, unknown>>)
    /** Transports to try, in order. Default `['websocket', 'polling']`. */
    transports?: string[]
    /** Connect immediately on creation. Default `true`. Set `false` to call `.connect()` yourself. */
    autoConnect?: boolean
}

/**
 * @stable
 */
export interface FrappeRealtime {
    /** Whether the underlying socket is currently connected. */
    readonly connected: boolean

    /** Connects, if not already connecting/connected. Resolves once the socket has connected (or rejects on `connect_error`). */
    connect(): Promise<void>

    /** Disconnects and releases all subscriptions and listeners. Safe to call more than once. */
    close(): void

    /** Subscribes to `doc_update` events for one document. Returns an unsubscribe function. */
    subscribeDoc(doctype: string, name: string, handler: (event: DocUpdateEvent) => void): Unsubscribe

    /** Subscribes to `list_update` events for a doctype (any document of that type changing). Returns an unsubscribe function. */
    subscribeDocType(doctype: string, handler: (event: ListUpdateEvent) => void): Unsubscribe

    /** Subscribes to `doc_viewers` presence events for one document. Returns an unsubscribe function. */
    subscribeDocViewers(doctype: string, name: string, handler: (event: DocViewersEvent) => void): Unsubscribe

    /** Subscribes to a raw connection-lifecycle event (`connect`, `disconnect`, `reconnect`, ...). Returns an unsubscribe function. */
    on<K extends RealtimeEventName>(event: K, handler: (payload: RealtimeConnectionEventMap[K]) => void): Unsubscribe
}
