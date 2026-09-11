/**
 * @module realtime
 * @description Thin wrapper around `socket.io-client` for Frappe's realtime events
 * (`doc_update`, `list_update`, `doc_viewers`). `socket.io-client` is an optional peer
 * dependency, imported lazily so `frappe-js-client`'s core stays zero-dependency — importing
 * `frappe-js-client/realtime` without `socket.io-client` installed throws a clear
 * `ConfigurationError` only when `connect()` is actually called, not at module-load time.
 */

import type { FrappeClient } from '../client'
import { ConfigurationError } from '../core/errors'
import type {
    DocUpdateEvent,
    DocViewersEvent,
    FrappeRealtime,
    ListUpdateEvent,
    RealtimeAuthContext,
    RealtimeConnectionEventMap,
    RealtimeEventName,
    RealtimeOptions,
    Unsubscribe,
} from './types'

// Structural subset of the `socket.io-client` `Socket`/`io` surface this module relies on —
// avoids a hard type-level dependency while keeping this file fully typed.
interface MinimalSocket {
    readonly connected: boolean
    connect(): MinimalSocket
    disconnect(): MinimalSocket
    emit(event: string, ...args: unknown[]): unknown
    on(event: string, handler: (...args: unknown[]) => void): unknown
    off(event: string, handler?: (...args: unknown[]) => void): unknown
    once(event: string, handler: (...args: unknown[]) => void): unknown
}
type IoFactory = (url: string, opts: Record<string, unknown>) => MinimalSocket

async function loadSocketIoClient(): Promise<IoFactory> {
    try {
        const mod: unknown = await import('socket.io-client')
        const io = (mod as { io?: IoFactory }).io ?? (mod as { default?: IoFactory }).default
        if (typeof io !== 'function') {
            throw new Error('module did not export an `io` factory')
        }
        return io
    } catch (cause) {
        throw new ConfigurationError(
            'frappe-js-client/realtime requires the optional peer dependency `socket.io-client` to be installed. ' +
                'Run `npm install socket.io-client` (or your package manager\u2019s equivalent) and try again.',
            { cause },
        )
    }
}

async function resolveAuthContext(client: FrappeClient): Promise<RealtimeAuthContext> {
    const headers: Record<string, string> = {}
    await client.config.auth.apply(headers, { method: 'GET', url: client.config.baseUrl })
    return { cookie: headers.Cookie, authorization: headers.Authorization }
}

function refcountKey(doctype: string, name?: string): string {
    return name === undefined ? `dt:${doctype}` : `doc:${doctype}\u241f${name}`
}

/**
 * Wraps a `FrappeClient` with a `socket.io-client` connection to the site's realtime server.
 * Reconnection (with backoff) is delegated entirely to `socket.io-client`'s own
 * `reconnection*` options — this module does not reimplement backoff.
 *
 * @stable
 * @example
 * ```ts
 * const realtime = createRealtime(frappe)
 * const stop = realtime.subscribeDoc('ToDo', 'TD-0001', (event) => console.log(event))
 * // later
 * stop()
 * realtime.close()
 * ```
 */
export function createRealtime(client: FrappeClient, options: RealtimeOptions = {}): FrappeRealtime {
    let socket: MinimalSocket | undefined
    let connecting: Promise<void> | undefined
    let ensuring: Promise<MinimalSocket> | undefined
    let closed = false

    const refcounts = new Map<string, number>()
    const rawListeners = new Set<{ event: string; handler: (...args: unknown[]) => void }>()

    function addRawListener(event: string, handler: (...args: unknown[]) => void): void {
        rawListeners.add({ event, handler })
        socket?.on(event, handler)
    }

    function removeRawListener(event: string, handler: (...args: unknown[]) => void): void {
        for (const entry of rawListeners) {
            if (entry.event === event && entry.handler === handler) {
                rawListeners.delete(entry)
                break
            }
        }
        socket?.off(event, handler)
    }

    async function ensureConnected(): Promise<MinimalSocket> {
        if (closed) {
            throw new ConfigurationError(
                'This FrappeRealtime instance was closed with .close(). Create a new one with createRealtime().',
            )
        }
        if (socket) return socket
        ensuring ??= (async () => {
            const io = await loadSocketIoClient()
            const authCtx = await resolveAuthContext(client)
            const authPayload =
                typeof options.auth === 'function' ? await options.auth(authCtx) : { ...authCtx, ...options.auth }

            const extraHeaders: Record<string, string> = {}
            if (authCtx.cookie) extraHeaders.Cookie = authCtx.cookie
            if (authCtx.authorization) extraHeaders.Authorization = authCtx.authorization

            const created = io(options.socketUrl ?? client.config.baseUrl, {
                path: options.path ?? '/socket.io',
                withCredentials: true,
                reconnection: options.reconnection ?? true,
                reconnectionAttempts: options.reconnectionAttempts ?? Infinity,
                reconnectionDelay: options.reconnectionDelay ?? 1000,
                reconnectionDelayMax: options.reconnectionDelayMax ?? 5000,
                transports: options.transports ?? ['websocket', 'polling'],
                autoConnect: false,
                extraHeaders,
                auth: authPayload,
            })
            socket = created

            for (const { event, handler } of rawListeners) created.on(event, handler)
            for (const key of refcounts.keys()) emitSubscribe(created, key)

            return created
        })().finally(() => {
            ensuring = undefined
        })
        return ensuring
    }

    function emitSubscribe(target: MinimalSocket, key: string): void {
        if (key.startsWith('doc:')) {
            const [doctype, name] = key.slice(4).split('\u241f')
            target.emit('doc_subscribe', doctype, name)
        } else {
            target.emit('doctype_subscribe', key.slice(3))
        }
    }

    function emitUnsubscribe(target: MinimalSocket, key: string): void {
        if (key.startsWith('doc:')) {
            const [doctype, name] = key.slice(4).split('\u241f')
            target.emit('doc_unsubscribe', doctype, name)
        } else {
            target.emit('doctype_unsubscribe', key.slice(3))
        }
    }

    function retain(key: string): void {
        const count = refcounts.get(key) ?? 0
        refcounts.set(key, count + 1)
        if (count === 0 && socket) emitSubscribe(socket, key)
    }

    function release(key: string): void {
        const count = refcounts.get(key) ?? 0
        if (count <= 1) {
            refcounts.delete(key)
            if (socket) emitUnsubscribe(socket, key)
        } else {
            refcounts.set(key, count - 1)
        }
    }

    async function connect(): Promise<void> {
        const target = await ensureConnected()
        if (target.connected) return
        connecting ??= new Promise<void>((resolve, reject) => {
            const onConnect = () => {
                target.off('connect_error', onError)
                connecting = undefined
                resolve()
            }
            const onError = (error: unknown) => {
                target.off('connect', onConnect)
                connecting = undefined
                reject(error instanceof Error ? error : new Error(String(error)))
            }
            target.once('connect', onConnect)
            target.once('connect_error', onError)
            target.connect()
        })
        return connecting
    }

    function close(): void {
        closed = true
        refcounts.clear()
        rawListeners.clear()
        socket?.disconnect()
        socket = undefined
    }

    if (options.autoConnect ?? true) {
        connect().catch(() => {
            /* surfaced to callers via subsequent .connect() calls or `connect_error` listeners */
        })
    }

    return {
        get connected() {
            return socket?.connected ?? false
        },
        connect,
        close,
        subscribeDoc(doctype, name, handler): Unsubscribe {
            const key = refcountKey(doctype, name)
            const listener = (...args: unknown[]) => {
                const event = args[0] as DocUpdateEvent
                if (event && event.doctype === doctype && event.name === name) handler(event)
            }
            retain(key)
            addRawListener('doc_update', listener)
            connect().catch(() => undefined)
            return () => {
                removeRawListener('doc_update', listener)
                release(key)
            }
        },
        subscribeDocType(doctype, handler): Unsubscribe {
            const key = refcountKey(doctype)
            const listener = (...args: unknown[]) => {
                const event = args[0] as ListUpdateEvent
                if (event && event.doctype === doctype) handler(event)
            }
            retain(key)
            addRawListener('list_update', listener)
            connect().catch(() => undefined)
            return () => {
                removeRawListener('list_update', listener)
                release(key)
            }
        },
        subscribeDocViewers(doctype, name, handler): Unsubscribe {
            const key = refcountKey(doctype, name)
            const listener = (...args: unknown[]) => {
                const event = args[0] as DocViewersEvent
                if (event && event.doctype === doctype && event.name === name) handler(event)
            }
            retain(key)
            addRawListener('doc_viewers', listener)
            connect().catch(() => undefined)
            return () => {
                removeRawListener('doc_viewers', listener)
                release(key)
            }
        },
        on<K extends RealtimeEventName>(
            event: K,
            handler: (payload: RealtimeConnectionEventMap[K]) => void,
        ): Unsubscribe {
            const listener = (...args: unknown[]) => handler(args[0] as RealtimeConnectionEventMap[K])
            addRawListener(event, listener)
            return () => removeRawListener(event, listener)
        },
    }
}

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
} from './types'
