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
type SocketAuthProvider = (callback: (payload: Record<string, unknown>) => void) => void

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

function comparableOrigin(value: string): string {
    const url = new URL(value)
    if (url.protocol === 'ws:') url.protocol = 'http:'
    if (url.protocol === 'wss:') url.protocol = 'https:'
    return url.origin
}

function subscriptionKey(doctype: string, name?: string): string {
    return JSON.stringify([doctype, name ?? null])
}

interface SubscriptionState {
    readonly doctype: string
    readonly name?: string
    count: number
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
    let cancelConnecting: (() => void) | undefined
    let ensuring: Promise<MinimalSocket> | undefined
    let closed = false

    const subscriptions = new Map<string, SubscriptionState>()
    const rawListeners = new Set<{ event: string; handler: (...args: unknown[]) => void }>()
    let hasConnected = false
    let reconnectHandler: (() => void) | undefined

    function assertOpen(): void {
        if (closed) {
            throw new ConfigurationError(
                'This FrappeRealtime instance was closed with .close(). Create a new one with createRealtime().',
            )
        }
    }

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
        assertOpen()
        if (socket) return socket
        ensuring ??= (async () => {
            const io = await loadSocketIoClient()
            assertOpen()
            const socketUrl = options.socketUrl ?? client.config.baseUrl
            const includeClientCredentials =
                options.allowCrossOriginCredentials === true ||
                comparableOrigin(socketUrl) === comparableOrigin(client.config.baseUrl)
            const getAuthContext = () =>
                includeClientCredentials ? resolveAuthContext(client) : Promise.resolve({} as RealtimeAuthContext)
            const resolveHandshakeAuth = async (): Promise<Record<string, unknown>> => {
                const context = await getAuthContext()
                return typeof options.auth === 'function' ? options.auth(context) : { ...context, ...options.auth }
            }
            const authCtx = await getAuthContext()
            assertOpen()
            await resolveHandshakeAuth()
            assertOpen() // guard against close() during slow custom auth callback

            const extraHeaders: Record<string, string> = {}
            if (authCtx.cookie) extraHeaders.Cookie = authCtx.cookie
            if (authCtx.authorization) extraHeaders.Authorization = authCtx.authorization

            const authProvider: SocketAuthProvider = (callback) => {
                void resolveHandshakeAuth().then(callback, () => callback({}))
            }
            const created = io(socketUrl, {
                path: options.path ?? '/socket.io',
                withCredentials: true,
                reconnection: options.reconnection ?? true,
                reconnectionAttempts: options.reconnectionAttempts ?? Infinity,
                reconnectionDelay: options.reconnectionDelay ?? 1000,
                reconnectionDelayMax: options.reconnectionDelayMax ?? 5000,
                transports: options.transports ?? ['websocket', 'polling'],
                autoConnect: false,
                extraHeaders,
                auth: authProvider,
            })
            socket = created

            for (const { event, handler } of rawListeners) created.on(event, handler)
            for (const subscription of subscriptions.values()) emitSubscribe(created, subscription)
            reconnectHandler = () => {
                if (hasConnected) {
                    for (const subscription of subscriptions.values()) emitSubscribe(created, subscription)
                }
                hasConnected = true
            }
            created.on('connect', reconnectHandler)

            return created
        })().finally(() => {
            ensuring = undefined
        })
        return ensuring
    }

    function emitSubscribe(target: MinimalSocket, subscription: SubscriptionState): void {
        if (subscription.name !== undefined) {
            target.emit('doc_subscribe', subscription.doctype, subscription.name)
        } else {
            target.emit('doctype_subscribe', subscription.doctype)
        }
    }

    function emitUnsubscribe(target: MinimalSocket, subscription: SubscriptionState): void {
        if (subscription.name !== undefined) {
            target.emit('doc_unsubscribe', subscription.doctype, subscription.name)
        } else {
            target.emit('doctype_unsubscribe', subscription.doctype)
        }
    }

    function retain(doctype: string, name?: string): string {
        assertOpen()
        const key = subscriptionKey(doctype, name)
        const existing = subscriptions.get(key)
        if (existing) {
            existing.count++
        } else {
            const subscription = { doctype, name, count: 1 }
            subscriptions.set(key, subscription)
            if (socket) emitSubscribe(socket, subscription)
        }
        return key
    }

    function release(key: string): void {
        const subscription = subscriptions.get(key)
        if (!subscription) return
        if (subscription.count <= 1) {
            subscriptions.delete(key)
            if (socket) emitUnsubscribe(socket, subscription)
        } else {
            subscription.count--
        }
    }

    async function connect(): Promise<void> {
        const target = await ensureConnected()
        if (target.connected) return
        connecting ??= new Promise<void>((resolve, reject) => {
            const cleanup = () => {
                target.off('connect', onConnect)
                target.off('connect_error', onError)
                connecting = undefined
                cancelConnecting = undefined
            }
            const onConnect = () => {
                cleanup()
                resolve()
            }
            const onError = (error: unknown) => {
                cleanup()
                reject(error instanceof Error ? error : new Error(String(error)))
            }
            cancelConnecting = () => {
                cleanup()
                reject(
                    new ConfigurationError(
                        'This FrappeRealtime instance was closed with .close(). Create a new one with createRealtime().',
                    ),
                )
            }
            target.once('connect', onConnect)
            target.once('connect_error', onError)
            target.connect()
        })
        return connecting
    }

    function close(): void {
        closed = true
        subscriptions.clear()
        // Detach all registered raw listeners from the socket before clearing the Set,
        // so late socket events (e.g. during disconnect) don't invoke stale handlers.
        if (socket) {
            for (const { event, handler } of rawListeners) {
                socket.off(event, handler)
            }
        }
        rawListeners.clear()
        cancelConnecting?.()
        if (reconnectHandler) socket?.off('connect', reconnectHandler)
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
            const key = retain(doctype, name)
            const listener = (...args: unknown[]) => {
                const event = args[0] as DocUpdateEvent
                if (event && event.doctype === doctype && event.name === name) handler(event)
            }
            addRawListener('doc_update', listener)
            connect().catch(() => undefined)
            let active = true
            return () => {
                if (!active) return
                active = false
                removeRawListener('doc_update', listener)
                release(key)
            }
        },
        subscribeDocType(doctype, handler): Unsubscribe {
            const key = retain(doctype)
            const listener = (...args: unknown[]) => {
                const event = args[0] as ListUpdateEvent
                if (event && event.doctype === doctype) handler(event)
            }
            addRawListener('list_update', listener)
            connect().catch(() => undefined)
            let active = true
            return () => {
                if (!active) return
                active = false
                removeRawListener('list_update', listener)
                release(key)
            }
        },
        subscribeDocViewers(doctype, name, handler): Unsubscribe {
            const key = retain(doctype, name)
            const listener = (...args: unknown[]) => {
                const event = args[0] as DocViewersEvent
                if (event && event.doctype === doctype && event.name === name) handler(event)
            }
            addRawListener('doc_viewers', listener)
            connect().catch(() => undefined)
            let active = true
            return () => {
                if (!active) return
                active = false
                removeRawListener('doc_viewers', listener)
                release(key)
            }
        },
        on<K extends RealtimeEventName>(
            event: K,
            handler: (payload: RealtimeConnectionEventMap[K]) => void,
        ): Unsubscribe {
            assertOpen()
            const listener = (...args: unknown[]) => handler(args[0] as RealtimeConnectionEventMap[K])
            addRawListener(event, listener)
            let active = true
            return () => {
                if (!active) return
                active = false
                removeRawListener(event, listener)
            }
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
