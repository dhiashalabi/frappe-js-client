import { describe, expect, it } from 'vitest'

import { cookieAuth } from '../../src/core/auth'
import { createTestClient } from '../../src/testing'

async function captureCookie(auth: ReturnType<typeof cookieAuth>, setCookie: string, host: string): Promise<void> {
    await auth.onResponse?.(new Headers({ 'set-cookie': setCookie }), { method: 'GET', url: `https://${host}/` })
}

describe('FrappeAuth', () => {
    it('login posts credentials to /api/method/login', async () => {
        const { client, transport } = createTestClient()
        transport.mock({
            method: 'POST',
            path: '/api/method/login',
            body: { message: 'Logged In', full_name: 'Administrator' },
        })
        const res = await client.auth.login({ username: 'Administrator', password: 'admin' })
        expect(res.full_name).toBe('Administrator')
        expect(transport.requests[0]?.data).toMatchObject({ usr: 'Administrator', pwd: 'admin' })
    })

    it('getLoggedUser unwraps the RPC envelope', async () => {
        const { client, transport } = createTestClient()
        transport.mock({
            method: 'GET',
            path: '/api/v2/method/frappe.auth.get_logged_user',
            body: { data: 'Administrator' },
        })
        await expect(client.auth.getLoggedUser()).resolves.toBe('Administrator')
    })

    it('logout() resets the auth strategy even if the request fails', async () => {
        const auth = cookieAuth()
        await captureCookie(auth, 'sid=abc; Path=/', 'test.local')
        const { client, transport } = createTestClient({ auth })
        transport.mock({ method: 'POST', path: '/api/method/logout', status: 500, body: { message: 'boom' } })
        await expect(client.auth.logout()).rejects.toThrow()
        expect(auth.jar.size).toBe(0)
    })

    it('forgetPassword resolves to undefined regardless of the response shape', async () => {
        const { client, transport } = createTestClient()
        transport.mock({
            method: 'POST',
            path: '/api/method/frappe.core.doctype.user.user.reset_password',
            body: { message: 'ok' },
        })
        await expect(client.auth.forgetPassword('a@b.com')).resolves.toBeUndefined()
    })

    it('ping() uses the classic path on v1 and the v2 path on v2', async () => {
        const v2 = createTestClient()
        v2.transport.mock({ method: 'GET', path: '/api/v2/method/ping', body: { data: 'pong' } })
        await expect(v2.client.auth.ping()).resolves.toBe('pong')

        const v1 = createTestClient({ apiVersion: 1 })
        v1.transport.mock({ method: 'GET', path: '/api/method/frappe.ping', body: { message: 'pong' } })
        await expect(v1.client.auth.ping()).resolves.toBe('pong')
    })

    it('login supports OTP fields and logout succeeds then resets', async () => {
        const auth = cookieAuth()
        await captureCookie(auth, 'sid=abc; Path=/', 'test.local')
        const { client, transport } = createTestClient({ auth })
        transport.mock({
            method: 'POST',
            path: '/api/method/login',
            body: { message: 'Logged In' },
        })
        transport.mock({ method: 'POST', path: '/api/method/logout', body: {} })
        await client.auth.login({
            username: 'u',
            password: 'p',
            otp: '123',
            tmpId: 'tmp',
            device: 'desktop',
        })
        expect(transport.requests[0]?.data).toMatchObject({ otp: '123', tmp_id: 'tmp', device: 'desktop' })
        await client.auth.logout()
        expect(auth.jar.size).toBe(0)
    })
})
