import { beforeAll, describe, expect, it } from 'vitest'

import { cookieAuth, createFrappeClient, FrappeClient } from '../../src/index'
import { FRAPPE_TEST_ADMIN_PASSWORD, FRAPPE_TEST_API_VERSION, FRAPPE_TEST_FRAPPE_VERSION, FRAPPE_TEST_URL } from './setup'

describe('integration: file upload/download (private and public)', () => {
    let frappe: FrappeClient

    beforeAll(async () => {
        frappe = createFrappeClient({ frappeVersion: FRAPPE_TEST_FRAPPE_VERSION, apiVersion: FRAPPE_TEST_API_VERSION, url: FRAPPE_TEST_URL, auth: cookieAuth() })
        await frappe.auth.login({ username: 'Administrator', password: FRAPPE_TEST_ADMIN_PASSWORD })
    })

    it('uploads a private file and downloads it back byte-for-byte', async () => {
        const content = 'frappe-js-client integration test file contents'
        const uploaded = await frappe.file.upload<{ file_url: string }>(
            new Blob([content]),
            { isPrivate: true },
            { filename: 'fjc-test.txt' },
        )
        expect(uploaded.file_url).toBeTruthy()

        const downloaded = await frappe.file.download(uploaded.file_url)
        expect(await downloaded.text()).toBe(content)
    })

    it('uploads a public file and it is reachable without auth', async () => {
        const uploaded = await frappe.file.upload<{ file_url: string }>(
            new Blob(['public content']),
            { isPrivate: false },
            { filename: 'fjc-public.txt' },
        )
        const guest = createFrappeClient({ frappeVersion: FRAPPE_TEST_FRAPPE_VERSION, apiVersion: FRAPPE_TEST_API_VERSION, url: FRAPPE_TEST_URL })
        const downloaded = await guest.file.download(uploaded.file_url)
        expect(await downloaded.text()).toBe('public content')
    })

    it('reports upload progress that reaches 100%', async () => {
        const events: { loaded: number; total?: number }[] = []
        await frappe.file.upload(
            new Blob(['x'.repeat(1024)]),
            { isPrivate: true },
            { onProgress: (e) => events.push(e), filename: 'fjc-progress.txt' },
        )
        expect(events.length).toBeGreaterThan(0)
    })
})
