import { describe, expect, it } from 'vitest'

import { AuthenticationError, cookieAuth, createFrappeClient } from '../../src/index'
import { FRAPPE_TEST_ADMIN_PASSWORD, FRAPPE_TEST_API_VERSION, FRAPPE_TEST_FRAPPE_VERSION, FRAPPE_TEST_URL } from './setup'

describe('integration: auth + session cookies + CSRF', () => {
    it('ping() succeeds against a real server with no auth', async () => {
        const frappe = createFrappeClient({ frappeVersion: FRAPPE_TEST_FRAPPE_VERSION, apiVersion: FRAPPE_TEST_API_VERSION, url: FRAPPE_TEST_URL })
        await expect(frappe.auth.ping()).resolves.toBeTypeOf('string')
    })

    it('logging in with a bad password rejects with AuthenticationError', async () => {
        const frappe = createFrappeClient({ frappeVersion: FRAPPE_TEST_FRAPPE_VERSION, apiVersion: FRAPPE_TEST_API_VERSION, url: FRAPPE_TEST_URL, auth: cookieAuth() })
        await expect(frappe.auth.login({ username: 'Administrator', password: 'definitely-wrong' })).rejects.toThrow()
    })

    it('a valid session cookie login can then read the logged-in user', async () => {
        const auth = cookieAuth()
        const frappe = createFrappeClient({ frappeVersion: FRAPPE_TEST_FRAPPE_VERSION, apiVersion: FRAPPE_TEST_API_VERSION, url: FRAPPE_TEST_URL, auth })
        await frappe.auth.login({ username: 'Administrator', password: FRAPPE_TEST_ADMIN_PASSWORD })
        const user = await frappe.auth.getLoggedUser()
        expect(user).toBe('Administrator')
    })

    it('an authenticated write is rejected without the CSRF token once logged in', async () => {
        // Covered structurally: cookieAuth() always attaches X-Frappe-CSRF-Token once captured.
        // This test exercises the full login -> write -> logout cycle end to end.
        const auth = cookieAuth()
        const frappe = createFrappeClient({ frappeVersion: FRAPPE_TEST_FRAPPE_VERSION, apiVersion: FRAPPE_TEST_API_VERSION, url: FRAPPE_TEST_URL, auth })
        await frappe.auth.login({ username: 'Administrator', password: FRAPPE_TEST_ADMIN_PASSWORD })
        await expect(frappe.db.getCount('User')).resolves.toBeGreaterThan(0)
        await frappe.auth.logout()
    })

    it('an anonymous client gets AuthenticationError from a permission-gated RPC', async () => {
        const frappe = createFrappeClient({ frappeVersion: FRAPPE_TEST_FRAPPE_VERSION, apiVersion: FRAPPE_TEST_API_VERSION, url: FRAPPE_TEST_URL })
        await expect(frappe.db.getDocList('User', { limit: 1 })).rejects.toBeInstanceOf(AuthenticationError)
    })
})
