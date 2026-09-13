import { beforeAll, describe, expect, it } from 'vitest'

import { withExtended } from '../../src/extended'
import { cookieAuth, createFrappeClient, FrappeClient, type FrappeDoc } from '../../src/index'
import { FRAPPE_TEST_ADMIN_PASSWORD, FRAPPE_TEST_API_VERSION, FRAPPE_TEST_FRAPPE_VERSION, FRAPPE_TEST_URL } from './setup'

describe('integration: workflow transitions and report execution', () => {
    let frappe: ReturnType<typeof withExtended>

    beforeAll(async () => {
        const core: FrappeClient = createFrappeClient({ frappeVersion: FRAPPE_TEST_FRAPPE_VERSION, apiVersion: FRAPPE_TEST_API_VERSION, url: FRAPPE_TEST_URL, auth: cookieAuth() })
        await core.auth.login({ username: 'Administrator', password: FRAPPE_TEST_ADMIN_PASSWORD })
        frappe = withExtended(core)
    })

    it('runs a real query report and gets back columns and rows', async () => {
        const result = await frappe.report.run('Sales Analytics')
        expect(result).toBeDefined()
    })

    it('a document without a workflow returns no transitions', async () => {
        const todo = await frappe.db.createDoc<FrappeDoc<{ description: string }>>('ToDo', {
            doctype: 'ToDo',
            description: 'workflow test',
        })
        const transitions = await frappe.workflow.getTransitions({ doctype: 'ToDo', name: todo.name })
        expect(Array.isArray(transitions)).toBe(true)
        await frappe.db.deleteDoc('ToDo', todo.name)
    })

    it('assign/unassign a document round-trips through the real server', async () => {
        const todo = await frappe.db.createDoc<FrappeDoc<{ description: string }>>('ToDo', {
            doctype: 'ToDo',
            description: 'assignment test',
        })
        await frappe.desk.assign({ doctype: 'ToDo', name: todo.name, assignTo: 'Administrator' })
        const rows = await frappe.desk.unassign('ToDo', todo.name, 'Administrator')
        expect(Array.isArray(rows)).toBe(true)
        await frappe.db.deleteDoc('ToDo', todo.name)
    })
})
