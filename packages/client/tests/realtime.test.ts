import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ConfigurationError } from '../src/core/errors'
import { bearerAuth, cookieAuth, createFrappeClient, tokenAuth } from '../src/index'
import { createRealtime } from '../src/realtime'

type Handler = (...args: unknown[]) => void

class FakeManager {
    private listeners = new Map<string, Set<Handler>>()
    on(event: string, handler: Handler): void {
        const listeners = this.listeners.get(event) ?? new Set<Handler>()
        listeners.add(handler)
        this.listeners.set(event, listeners)
    }
    off(event: string, handler: Handler): void {
        this.listeners.get(event)?.delete(handler)
    }
    fire(event: string, ...args: unknown[]): void {
        for (const handler of this.listeners.get(event) ?? []) handler(...args)
    }
}

class FakeSocket {
    readonly io = new FakeManager()
    connected = false
    autoSucceed = true
    emitted: Array<{ event: string; args: unknown[] }> = []
    private readonly listeners = new Map<string, Set<Handler>>()
    /** Maps original handler → once-wrapper so off(event, original) finds the right wrapper. */
    private readonly onceWrappers = new Map<Handler, Handler>()

    private add(event: string, handler: Handler, once: boolean): this {
        const set = this.listeners.get(event) ?? new Set()
        if (once) {
            const wrap: Handler = (...args) => {
                this.off(event, handler)
                handler(...args)
            }
            this.onceWrappers.set(handler, wrap)
            set.add(wrap)
        } else {
            set.add(handler)
        }
        this.listeners.set(event, set)
        return this
    }

    connect(): this {
        if (this.autoSucceed) {
            this.connected = true
            queueMicrotask(() => this.fire('connect'))
        }
        return this
    }

    fail(reason: unknown): this {
        queueMicrotask(() => this.fire('connect_error', reason))
        return this
    }

    disconnect(): this {
        this.connected = false
        return this
    }

    emit(event: string, ...args: unknown[]): boolean {
        this.emitted.push({ event, args })
        return true
    }

    on(event: string, handler: Handler): this {
        return this.add(event, handler, false)
    }

    off(event: string, handler?: Handler): this {
        if (!handler) {
            this.listeners.delete(event)
            return this
        }
        // Support removal by original handler (for once-wrapped handlers)
        const effective = this.onceWrappers.get(handler) ?? handler
        this.onceWrappers.delete(handler)
        this.listeners.get(event)?.delete(effective)
        return this
    }

    once(event: string, handler: Handler): this {
        return this.add(event, handler, true)
    }

    fire(event: string, ...args: unknown[]): void {
        for (const handler of [...(this.listeners.get(event) ?? [])]) handler(...args)
    }

    listenerCount(event: string): number {
        return this.listeners.get(event)?.size ?? 0
    }
}

const mock = vi.hoisted(() => {
    const state: {
        impl: ((url: string, opts: Record<string, unknown>) => FakeSocket) | undefined
        url?: string
        opts?: Record<string, unknown>
        socket?: FakeSocket
        autoSucceed: boolean
        ioExport: 'factory' | 'missing' | 'invalid'
        useDefaultExport: boolean
    } = { impl: undefined, autoSucceed: true, ioExport: 'factory', useDefaultExport: false }

    return { state }
})

vi.mock('socket.io-client', () => ({
    get io() {
        if (mock.state.useDefaultExport || mock.state.ioExport === 'missing') return undefined
        if (mock.state.ioExport === 'invalid') return { not: 'a function' }
        return (url: string, opts: Record<string, unknown>) => {
            if (!mock.state.impl) throw new Error('not installed')
            return mock.state.impl(url, opts)
        }
    },
    get default() {
        if (!mock.state.useDefaultExport) return undefined
        return (url: string, opts: Record<string, unknown>) => {
            if (!mock.state.impl) throw new Error('not installed')
            return mock.state.impl(url, opts)
        }
    },
}))

function client(auth?: ReturnType<typeof tokenAuth> | ReturnType<typeof cookieAuth>) {
    return createFrappeClient({ frappeVersion: 16, url: 'https://frappe.example.com', auth })
}

describe('createRealtime', () => {
    it('forwards reconnection lifecycle events from the Socket.IO manager', async () => {
        const rt = createRealtime(client(), { autoConnect: false })
        const seen: number[] = []
        const stop = rt.on('reconnect', (attempt) => seen.push(attempt))
        await rt.connect()
        mock.state.socket!.io.fire('reconnect', 2)
        expect(seen).toEqual([2])
        stop()
        mock.state.socket!.io.fire('reconnect', 3)
        expect(seen).toEqual([2])
        rt.close()
    })
    beforeEach(() => {
        mock.state.autoSucceed = true
        mock.state.socket = undefined
        mock.state.opts = undefined
        mock.state.ioExport = 'factory'
        mock.state.useDefaultExport = false
        mock.state.impl = (url, opts) => {
            mock.state.url = url
            mock.state.opts = opts
            const socket = new FakeSocket()
            socket.autoSucceed = mock.state.autoSucceed
            mock.state.socket = socket
            return socket
        }
    })

    it('connects and reports connected after the socket handshake', async () => {
        const rt = createRealtime(client(), { autoConnect: false })
        expect(rt.connected).toBe(false)
        await rt.connect()
        expect(rt.connected).toBe(true)
        expect(mock.state.url).toBe('https://frappe.example.com')
        expect(mock.state.opts?.path).toBe('/socket.io')
        await rt.connect()
        rt.close()
        expect(rt.connected).toBe(false)
        await expect(rt.connect()).rejects.toBeInstanceOf(ConfigurationError)
    })

    it('rejects connect() when the socket reports connect_error', async () => {
        mock.state.autoSucceed = false
        const rt = createRealtime(client(), { autoConnect: false })
        const pending = rt.connect()
        await vi.waitFor(() => expect(mock.state.socket).toBeDefined())
        mock.state.socket!.fail('boom')
        await expect(pending).rejects.toThrow(/boom/)
        rt.close()
    })

    it('does not forward client credentials to a cross-origin socket by default', async () => {
        const auth = cookieAuth()
        await auth.onResponse?.(new Headers({ 'set-cookie': 'sid=abc; Path=/' }), {
            method: 'GET',
            url: 'https://frappe.example.com/',
        })
        const rt = createRealtime(client(auth), { autoConnect: false, socketUrl: 'wss://rt.example.com' })
        await rt.connect()
        expect(mock.state.url).toBe('wss://rt.example.com')
        expect(mock.state.opts?.withCredentials).toBe(false)
        expect((mock.state.opts?.extraHeaders as Record<string, string>).Cookie).toBeUndefined()
        rt.close()
    })

    it('normalizes ws origins when deciding whether credentials are same-origin', async () => {
        const rt = createRealtime(client(tokenAuth({ apiKey: 'k', apiSecret: 's' })), {
            autoConnect: false,
            socketUrl: 'ws://frappe.example.com',
        })
        await rt.connect()
        expect((mock.state.opts?.extraHeaders as Record<string, string>).Authorization).toBeUndefined()
        rt.close()
    })

    it('forwards credentials cross-origin only with explicit opt-in', async () => {
        const auth = cookieAuth()
        await auth.onResponse?.(new Headers({ 'set-cookie': 'sid=abc; Path=/' }), {
            method: 'GET',
            url: 'https://frappe.example.com/',
        })
        const rt = createRealtime(client(auth), {
            autoConnect: false,
            socketUrl: 'wss://rt.example.com',
            allowCrossOriginCredentials: true,
        })
        await rt.connect()
        expect(mock.state.opts?.withCredentials).toBe(true)
        expect((mock.state.opts?.extraHeaders as Record<string, string>).Cookie).toContain('sid=abc')
        rt.close()

        const token = createRealtime(client(tokenAuth({ apiKey: 'k', apiSecret: 's' })), {
            autoConnect: false,
            auth: (ctx) => ({ ...ctx, site: 'x' }),
        })
        await token.connect()
        expect((mock.state.opts?.extraHeaders as Record<string, string>).Authorization).toMatch(/^token /)
        const authProvider = mock.state.opts?.auth as (callback: (payload: Record<string, unknown>) => void) => void
        const payload = await new Promise<Record<string, unknown>>((resolve) => authProvider(resolve))
        expect(payload).toMatchObject({ site: 'x', authorization: 'token k:s' })
        token.close()
    })

    it('resolves fresh authentication for every Socket.IO handshake', async () => {
        let value = 'first'
        const auth = bearerAuth({ token: () => value })
        const rt = createRealtime(createFrappeClient({ frappeVersion: 16, url: 'https://frappe.example.com', auth }), {
            autoConnect: false,
        })
        await rt.connect()
        const headers = mock.state.opts?.extraHeaders as Record<string, string>
        expect(headers.Authorization).toBe('Bearer first')
        const provider = mock.state.opts?.auth as (callback: (payload: Record<string, unknown>) => void) => void
        const first = await new Promise<Record<string, unknown>>((resolve) => provider(resolve))
        value = 'second'
        const second = await new Promise<Record<string, unknown>>((resolve) => provider(resolve))
        expect(first.authorization).toBe('Bearer first')
        expect(second.authorization).toBe('Bearer second')
        expect(headers.Authorization).toBe('Bearer second')
        rt.close()
    })

    it('invokes functional socket auth once per handshake', async () => {
        let calls = 0
        const rt = createRealtime(client(), {
            autoConnect: false,
            auth: () => {
                calls++
                return { token: `n${calls}` }
            },
        })
        await rt.connect()
        expect(calls).toBe(1)
        const provider = mock.state.opts?.auth as (callback: (payload: Record<string, unknown>) => void) => void
        const first = await new Promise<Record<string, unknown>>((resolve) => provider(resolve))
        expect(calls).toBe(1)
        expect(first).toEqual({ token: 'n1' })
        const second = await new Promise<Record<string, unknown>>((resolve) => provider(resolve))
        expect(calls).toBe(2)
        expect(second).toEqual({ token: 'n2' })
        rt.close()
    })

    it('uses an empty handshake payload if refreshed auth resolution fails', async () => {
        let calls = 0
        const rt = createRealtime(client(), {
            autoConnect: false,
            auth: () => {
                calls++
                if (calls > 1) throw new Error('token store unavailable')
                return { token: 'initial' }
            },
        })
        await rt.connect()
        const provider = mock.state.opts?.auth as (callback: (payload: Record<string, unknown>) => void) => void
        await expect(new Promise<Record<string, unknown>>((resolve) => provider(resolve))).resolves.toEqual({
            token: 'initial',
        })
        await expect(new Promise<Record<string, unknown>>((resolve) => provider(resolve))).resolves.toEqual({})
        rt.close()
    })

    it('subscribes to a document, filters events, and refcounts unsubscribe', async () => {
        const rt = createRealtime(client(), { autoConnect: false })
        await rt.connect()
        const seen: unknown[] = []
        const stop1 = rt.subscribeDoc('ToDo', 'TD-1', (e) => seen.push(e))
        const stop2 = rt.subscribeDoc('ToDo', 'TD-1', (e) => seen.push(['second', e]))
        expect(mock.state.socket!.emitted.filter((e) => e.event === 'doc_subscribe')).toHaveLength(1)

        mock.state.socket!.fire('doc_update', { doctype: 'ToDo', name: 'TD-1', status: 'Open' })
        mock.state.socket!.fire('doc_update', { doctype: 'ToDo', name: 'other' })
        expect(seen).toHaveLength(2)

        stop1()
        expect(mock.state.socket!.emitted.filter((e) => e.event === 'doc_unsubscribe')).toHaveLength(0)
        stop1()
        expect(mock.state.socket!.emitted.filter((e) => e.event === 'doc_unsubscribe')).toHaveLength(0)
        stop2()
        expect(mock.state.socket!.emitted.filter((e) => e.event === 'doc_unsubscribe')).toHaveLength(1)
        rt.close()
    })

    it('rejects subscriptions after close', () => {
        const rt = createRealtime(client(), { autoConnect: false })
        rt.close()
        expect(() => rt.subscribeDoc('ToDo', 'TD-1', () => undefined)).toThrow(ConfigurationError)
        expect(() => rt.subscribeDocType('ToDo', () => undefined)).toThrow(ConfigurationError)
        expect(() => rt.subscribeDocViewers('ToDo', 'TD-1', () => undefined)).toThrow(ConfigurationError)
    })

    it('does not create a socket when closed during async initialization', async () => {
        let release!: () => void
        const auth = {
            name: 'slow',
            apply: () =>
                new Promise<void>((resolve) => {
                    release = resolve
                }),
        }
        const rt = createRealtime(createFrappeClient({ frappeVersion: 16, url: 'https://frappe.example.com', auth }), {
            autoConnect: false,
        })
        const pending = rt.connect()
        await vi.waitFor(() => expect(release).toBeTypeOf('function'))
        rt.close()
        release()

        await expect(pending).rejects.toBeInstanceOf(ConfigurationError)
        expect(mock.state.socket).toBeUndefined()
    })

    it('rejects an in-flight connection when closed', async () => {
        mock.state.autoSucceed = false
        const rt = createRealtime(client(), { autoConnect: false })
        const pending = rt.connect()
        await vi.waitFor(() => expect(mock.state.socket).toBeDefined())
        rt.close()
        await expect(pending).rejects.toBeInstanceOf(ConfigurationError)
    })

    it('restores subscriptions after a socket reconnection', async () => {
        const rt = createRealtime(client(), { autoConnect: false })
        const stop = rt.subscribeDoc('ToDo', 'TD-1', () => undefined)
        await rt.connect()
        mock.state.socket!.emitted = []
        mock.state.socket!.connected = false
        mock.state.socket!.fire('connect')
        expect(mock.state.socket!.emitted).toContainEqual({ event: 'doc_subscribe', args: ['ToDo', 'TD-1'] })
        stop()
        rt.close()
    })

    it('preserves subscription names containing separator characters', async () => {
        const rt = createRealtime(client(), { autoConnect: false })
        await rt.connect()
        const name = 'TD-1\u241fpart'
        const stop = rt.subscribeDoc('To\u241fDo', name, () => undefined)
        expect(mock.state.socket!.emitted).toContainEqual({ event: 'doc_subscribe', args: ['To\u241fDo', name] })
        stop()
        rt.close()
    })

    it('subscribes to a doctype list and to doc_viewers', async () => {
        const rt = createRealtime(client(), { autoConnect: false })
        await rt.connect()
        const lists: unknown[] = []
        const viewers: unknown[] = []
        const stopList = rt.subscribeDocType('ToDo', (e) => lists.push(e))
        const stopViewers = rt.subscribeDocViewers('ToDo', 'TD-1', (e) => viewers.push(e))
        mock.state.socket!.fire('list_update', { doctype: 'ToDo' })
        mock.state.socket!.fire('list_update', { doctype: 'User' })
        mock.state.socket!.fire('doc_viewers', { doctype: 'ToDo', name: 'TD-1', viewers: [{ user: 'a' }] })
        mock.state.socket!.fire('doc_viewers', { doctype: 'ToDo', name: 'other', viewers: [] })
        expect(lists).toHaveLength(1)
        expect(viewers).toHaveLength(1)
        stopList()
        stopViewers()
        expect(mock.state.socket!.emitted.some((e) => e.event === 'doctype_unsubscribe')).toBe(true)
        expect(mock.state.socket!.emitted.some((e) => e.event === 'doc_unsubscribe')).toBe(true)
        rt.close()
    })

    it('forwards connection-lifecycle events through on()', async () => {
        const rt = createRealtime(client(), { autoConnect: false })
        const seen: string[] = []
        const stop = rt.on('disconnect', (reason) => seen.push(String(reason)))
        await rt.connect()
        mock.state.socket!.fire('disconnect', 'io server disconnect')
        expect(seen).toEqual(['io server disconnect'])
        stop()
        mock.state.socket!.fire('disconnect', 'ignored')
        expect(seen).toHaveLength(1)
        rt.close()
    })

    it('passes explicit socket options and static handshake auth', async () => {
        const rt = createRealtime(client(), {
            autoConnect: false,
            path: '/events',
            reconnection: false,
            reconnectionAttempts: 2,
            reconnectionDelay: 25,
            reconnectionDelayMax: 75,
            transports: ['polling'],
            auth: { tenant: 'test' },
        })
        await rt.connect()
        expect(mock.state.opts).toMatchObject({
            path: '/events',
            reconnection: false,
            reconnectionAttempts: 2,
            reconnectionDelay: 25,
            reconnectionDelayMax: 75,
            transports: ['polling'],
        })
        const provider = mock.state.opts?.auth as (callback: (payload: Record<string, unknown>) => void) => void
        await expect(new Promise<Record<string, unknown>>((resolve) => provider(resolve))).resolves.toMatchObject({
            tenant: 'test',
        })
        rt.close()
    })

    it('auto-connects by default and contains an initial connection failure', async () => {
        mock.state.autoSucceed = false
        const rt = createRealtime(client())
        await vi.waitFor(() => expect(mock.state.socket).toBeDefined())
        mock.state.socket!.fail(new Error('initial failure'))
        await new Promise((resolve) => setTimeout(resolve, 0))
        rt.close()
    })

    it('custom-auth race: no socket is created when close() is called while custom auth is awaiting', async () => {
        let release!: (value: Record<string, unknown>) => void
        let entered!: () => void
        const ready = new Promise<void>((resolve) => {
            entered = resolve
        })
        const rt = createRealtime(client(), {
            autoConnect: false,
            auth: () => {
                entered()
                return new Promise<Record<string, unknown>>((resolve) => {
                    release = resolve
                })
            },
        })
        const pending = rt.connect()
        const rejection = expect(pending).rejects.toBeInstanceOf(ConfigurationError)
        await ready
        rt.close()
        release({})
        await rejection
        // No socket should have been constructed
        expect(mock.state.socket).toBeUndefined()
    })

    it('on() throws ConfigurationError after close', () => {
        const rt = createRealtime(client(), { autoConnect: false })
        rt.close()
        expect(() => rt.on('disconnect', () => undefined)).toThrow(ConfigurationError)
    })

    it('on() unsubscribe is idempotent', async () => {
        const rt = createRealtime(client(), { autoConnect: false })
        await rt.connect()
        const seen: string[] = []
        const stop = rt.on('disconnect', () => seen.push('disc'))
        stop()
        stop() // double-call must not throw
        mock.state.socket!.fire('disconnect', 'reason')
        expect(seen).toHaveLength(0)
        rt.close()
    })

    it('repeated close() does not throw and leaves the instance stable', () => {
        const rt = createRealtime(client(), { autoConnect: false })
        rt.close()
        expect(() => rt.close()).not.toThrow()
    })

    it('close() detaches raw listeners so fired socket events do not invoke stale handlers', async () => {
        const rt = createRealtime(client(), { autoConnect: false })
        const seen: string[] = []
        rt.on('disconnect', () => seen.push('disc'))
        await rt.connect()
        rt.close()
        // After close the socket is disconnected; fire an event on it manually
        // to prove the handler was detached and won't be called.
        mock.state.socket?.fire('disconnect', 'reason')
        expect(seen).toHaveLength(0)
    })

    it('throws when socket.io-client cannot be loaded', async () => {
        mock.state.impl = undefined
        const rt = createRealtime(client(), { autoConnect: false })
        await expect(rt.connect()).rejects.toThrow(/not installed/)
        rt.close()
    })

    it('throws ConfigurationError when socket.io-client has no io factory', async () => {
        mock.state.ioExport = 'invalid'
        const rt = createRealtime(client(), { autoConnect: false })
        await expect(rt.connect()).rejects.toBeInstanceOf(ConfigurationError)
        rt.close()
    })

    it('accepts a default export from socket.io-client', async () => {
        mock.state.useDefaultExport = true
        const rt = createRealtime(client(), { autoConnect: false })
        await rt.connect()
        expect(rt.connected).toBe(true)
        rt.close()
    })

    it('ignores malformed realtime payloads', async () => {
        const rt = createRealtime(client(), { autoConnect: false })
        await rt.connect()
        const seen: unknown[] = []
        const stopDoc = rt.subscribeDoc('ToDo', 'TD-1', (e) => seen.push(e))
        const stopList = rt.subscribeDocType('ToDo', (e) => seen.push(e))
        const stopViewers = rt.subscribeDocViewers('ToDo', 'TD-1', (e) => seen.push(e))
        mock.state.socket!.fire('doc_update', undefined)
        mock.state.socket!.fire('list_update', undefined)
        mock.state.socket!.fire('doc_viewers', undefined)
        expect(seen).toHaveLength(0)
        stopDoc()
        stopList()
        stopViewers()
        rt.close()
    })

    it('unsubscribes a later listener without matching the first handler', async () => {
        const rt = createRealtime(client(), { autoConnect: false })
        await rt.connect()
        const stop1 = rt.subscribeDoc('ToDo', 'TD-1', () => undefined)
        const stop2 = rt.subscribeDoc('ToDo', 'TD-1', () => undefined)
        stop2()
        stop1()
        rt.close()
    })

    it('unsubscribe before the socket exists does not emit', () => {
        const rt = createRealtime(client(), { autoConnect: false })
        const stop = rt.subscribeDoc('ToDo', 'TD-1', () => undefined)
        expect(() => stop()).not.toThrow()
        rt.close()
    })

    it('subscribe unsubscribe is idempotent for list and viewers', async () => {
        const rt = createRealtime(client(), { autoConnect: false })
        await rt.connect()
        const stopList = rt.subscribeDocType('ToDo', () => undefined)
        const stopViewers = rt.subscribeDocViewers('ToDo', 'TD-1', () => undefined)
        stopList()
        stopList()
        stopViewers()
        stopViewers()
        rt.close()
    })

    it('unsubscribe after close is a no-op', async () => {
        const rt = createRealtime(client(), { autoConnect: false })
        await rt.connect()
        const stop = rt.subscribeDoc('ToDo', 'TD-1', () => undefined)
        rt.close()
        expect(() => stop()).not.toThrow()
    })

    it('swallows connect failure from subscribe helpers', async () => {
        mock.state.impl = undefined
        const rt = createRealtime(client(), { autoConnect: false })
        expect(() => rt.subscribeDoc('ToDo', 'TD-1', () => undefined)).not.toThrow()
        expect(() => rt.subscribeDocType('ToDo', () => undefined)).not.toThrow()
        expect(() => rt.subscribeDocViewers('ToDo', 'TD-1', () => undefined)).not.toThrow()
        await new Promise((resolve) => setTimeout(resolve, 0))
        rt.close()
    })
})
