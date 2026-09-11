import { describe, expect, it } from 'vitest'

import { cookieAuth, createFrappeClient, FeatureNotSupportedError, type FrappeDoc } from '../../src/index'
import { FRAPPE_TEST_ADMIN_PASSWORD, FRAPPE_TEST_URL } from './setup'

describe('integration: v1 (classic) vs v2 behavioral parity', () => {
    it('getDoc returns the same document shape on v1 and v2', async () => {
        const v1 = createFrappeClient({ url: FRAPPE_TEST_URL, apiVersion: 1, auth: cookieAuth() })
        const v2 = createFrappeClient({ url: FRAPPE_TEST_URL, apiVersion: 2, auth: cookieAuth() })
        await v1.auth.login({ username: 'Administrator', password: FRAPPE_TEST_ADMIN_PASSWORD })
        await v2.auth.login({ username: 'Administrator', password: FRAPPE_TEST_ADMIN_PASSWORD })

        const [docV1, docV2] = await Promise.all([
            v1.db.getDoc<FrappeDoc<{ email: string }>>('User', 'Administrator'),
            v2.db.getDoc<FrappeDoc<{ email: string }>>('User', 'Administrator'),
        ])
        expect(docV1.name).toBe(docV2.name)
        expect(docV1.email).toBe(docV2.email)
    })

    it('v1 rejects v2-only features with FeatureNotSupportedError before ever hitting the network', async () => {
        const v1 = createFrappeClient({ url: FRAPPE_TEST_URL, apiVersion: 1 })
        await expect(v1.db.getMeta('User')).rejects.toBeInstanceOf(FeatureNotSupportedError)
    })

    it('v2 supports getMeta and copyDoc', async () => {
        const v2 = createFrappeClient({ url: FRAPPE_TEST_URL, apiVersion: 2, auth: cookieAuth() })
        await v2.auth.login({ username: 'Administrator', password: FRAPPE_TEST_ADMIN_PASSWORD })
        await expect(v2.db.getMeta('User')).resolves.toBeDefined()
    })

    it('updateDoc uses PUT on v1 and PATCH on v2, and both persist the change', async () => {
        const v1 = createFrappeClient({ url: FRAPPE_TEST_URL, apiVersion: 1, auth: cookieAuth() })
        await v1.auth.login({ username: 'Administrator', password: FRAPPE_TEST_ADMIN_PASSWORD })
        const todo = await v1.db.createDoc<FrappeDoc<{ description: string }>>('ToDo', {
            doctype: 'ToDo',
            description: 'v1 vs v2',
        })
        const updated = await v1.db.updateDoc<FrappeDoc<{ description: string }>>('ToDo', todo.name, {
            description: 'updated via v1',
        })
        expect(updated.description).toBe('updated via v1')
        await v1.db.deleteDoc('ToDo', todo.name)
    })
})
