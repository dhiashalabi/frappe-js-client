import { beforeAll, describe, expect, it } from 'vitest'

import {
    cookieAuth,
    createFrappeClient,
    FrappeClient,
    type FrappeDoc,
    NotFoundError,
    PermissionError,
} from '../../src/index'
import { FRAPPE_TEST_ADMIN_PASSWORD, FRAPPE_TEST_API_VERSION, FRAPPE_TEST_FRAPPE_VERSION, FRAPPE_TEST_URL } from './setup'

describe('integration: db CRUD against a real Frappe (v2)', () => {
    let frappe: FrappeClient

    beforeAll(async () => {
        frappe = createFrappeClient({ frappeVersion: FRAPPE_TEST_FRAPPE_VERSION, apiVersion: FRAPPE_TEST_API_VERSION, url: FRAPPE_TEST_URL, auth: cookieAuth() })
        await frappe.auth.login({ username: 'Administrator', password: FRAPPE_TEST_ADMIN_PASSWORD })
    })

    it('creates, reads, updates, and deletes a ToDo document', async () => {
        const created = await frappe.db.createDoc<FrappeDoc<{ description: string }>>('ToDo', {
            doctype: 'ToDo',
            description: 'frappe-js-client integration test',
        })
        expect(created.name).toBeTruthy()

        const fetched = await frappe.db.getDoc<FrappeDoc<{ description: string }>>('ToDo', created.name)
        expect(fetched.description).toBe('frappe-js-client integration test')

        const updated = await frappe.db.updateDoc<FrappeDoc<{ description: string }>>('ToDo', created.name, {
            description: 'updated by integration test',
        })
        expect(updated.description).toBe('updated by integration test')

        await frappe.db.deleteDoc('ToDo', created.name)
        await expect(frappe.db.getDoc('ToDo', created.name)).rejects.toBeInstanceOf(NotFoundError)
    })

    it('getDocList defaults to a bounded 20-row page against a real dataset', async () => {
        const list = await frappe.db.getDocList('DocType', { fields: ['name'] })
        expect(list.length).toBeLessThanOrEqual(20)
    })

    it('paginate() walks a real multi-page listing to completion', async () => {
        const seen = new Set<string>()
        for await (const doc of frappe.db.paginate('DocType', { fields: ['name'], limit: 25 })) {
            seen.add(doc.name)
        }
        expect(seen.size).toBeGreaterThan(25)
    })

    it('a read on a permission-denied doctype raises PermissionError, not a generic error', async () => {
        const guest = createFrappeClient({ frappeVersion: FRAPPE_TEST_FRAPPE_VERSION, apiVersion: FRAPPE_TEST_API_VERSION, url: FRAPPE_TEST_URL })
        await expect(guest.db.getDoc('User', 'Administrator')).rejects.toBeInstanceOf(PermissionError)
    })

    it('exists() reflects real server state', async () => {
        expect(await frappe.db.exists('User', 'Administrator')).toBe(true)
        expect(await frappe.db.exists('User', 'does-not-exist@example.com')).toBe(false)
    })
})
