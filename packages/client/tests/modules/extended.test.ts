import { describe, expect, it } from 'vitest'

import { createExtendedTestClient } from '../../src/testing'

describe('frappe-js-client/extended modules', () => {
    describe('FrappePermission', () => {
        it('has', async () => {
            const { client, transport } = createExtendedTestClient()
            transport.mock({
                method: 'GET',
                path: '/api/v2/method/frappe.client.has_permission',
                body: { data: { has_permission: true } },
            })
            await expect(client.permission.has('User', 'Administrator')).resolves.toEqual({
                has_permission: true,
            })
        })

        it('getForDoc unwraps a `{ permissions }` envelope', async () => {
            const { client, transport } = createExtendedTestClient()
            transport.mock({
                method: 'GET',
                path: '/api/v2/method/frappe.client.get_doc_permissions',
                body: { data: { permissions: { read: 1, write: 0 } } },
            })
            await expect(client.permission.getForDoc('User', 'Administrator')).resolves.toEqual({
                read: 1,
                write: 0,
            })
        })

        it('getForDoc accepts a bare permissions object too', async () => {
            const { client, transport } = createExtendedTestClient()
            transport.mock({
                method: 'GET',
                path: '/api/v2/method/frappe.client.get_doc_permissions',
                body: { data: { read: 1 } },
            })
            await expect(client.permission.getForDoc('User', 'Administrator')).resolves.toEqual({ read: 1 })
        })
    })

    describe('FrappeWorkflow', () => {
        it('getTransitions / apply / canCancelDocument / bulkApproval / getCommonTransitionActions', async () => {
            const { client, transport } = createExtendedTestClient()
            transport.mock({
                method: 'POST',
                path: '/api/v2/method/frappe.model.workflow.get_transitions',
                body: { data: [] },
            })
            transport.mock({
                method: 'POST',
                path: '/api/v2/method/frappe.model.workflow.apply_workflow',
                body: { data: {} },
            })
            transport.mock({
                method: 'GET',
                path: '/api/v2/method/frappe.model.workflow.can_cancel_document',
                body: { data: true },
            })
            transport.mock({
                method: 'POST',
                path: '/api/v2/method/frappe.model.workflow.bulk_workflow_approval',
                body: { data: {} },
            })
            transport.mock({
                method: 'POST',
                path: '/api/v2/method/frappe.model.workflow.get_common_transition_actions',
                body: { data: ['Approve'] },
            })

            await client.workflow.getTransitions({ doctype: 'ToDo', name: 'x' })
            await client.workflow.apply({ doctype: 'ToDo', name: 'x' }, 'Approve')
            await expect(client.workflow.canCancelDocument('ToDo')).resolves.toBe(true)
            await client.workflow.bulkApproval(['x'], 'ToDo', 'Approve')
            await expect(
                client.workflow.getCommonTransitionActions([{ doctype: 'ToDo', name: 'x' }], 'ToDo'),
            ).resolves.toEqual(['Approve'])
        })
    })

    describe('FrappeReport', () => {
        it('get / getList / countRows / run / getScript', async () => {
            const { client, transport } = createExtendedTestClient()
            transport.mock({
                method: 'GET',
                path: '/api/v2/method/frappe.desk.reportview.get',
                body: { data: { keys: [], values: [] } },
            })
            transport.mock({
                method: 'GET',
                path: '/api/v2/method/frappe.desk.reportview.get_list',
                body: { data: [] },
            })
            transport.mock({
                method: 'GET',
                path: '/api/v2/method/frappe.desk.reportview.get_count',
                body: { data: 3 },
            })
            transport.mock({
                method: 'POST',
                path: '/api/v2/method/frappe.desk.query_report.run',
                body: { data: { result: [] } },
            })
            transport.mock({
                method: 'GET',
                path: '/api/v2/method/frappe.desk.query_report.get_script',
                body: { data: {} },
            })

            await client.report.get({ doctype: 'ToDo' })
            await client.report.getList({ doctype: 'ToDo' })
            await expect(client.report.countRows({ doctype: 'ToDo' })).resolves.toBe(3)
            await client.report.run('My Report', { status: 'Open' })
            await client.report.getScript('My Report')
        })

        it('prepare / getQueued / stop / download', async () => {
            const { client, transport } = createExtendedTestClient()
            transport.mock({
                method: 'POST',
                path: '/api/v2/method/frappe.core.doctype.prepared_report.prepared_report.make_prepared_report',
                body: { data: { name: 'PR-0001' } },
            })
            transport.mock({
                method: 'GET',
                path: '/api/v2/method/frappe.core.doctype.prepared_report.prepared_report.get_reports_in_queued_state',
                body: { data: [] },
            })
            transport.mock({
                method: 'POST',
                path: '/api/v2/method/frappe.core.doctype.prepared_report.prepared_report.delete_prepared_reports',
                body: { data: {} },
            })
            transport.mock({
                method: 'GET',
                path: '/api/v2/method/frappe.core.doctype.prepared_report.prepared_report.download_attachment',
                body: 'report bytes',
            })

            await client.report.prepare('My Report')
            await client.report.getQueued('My Report', {})
            await client.report.stop('PR-0001')
            const stopReq = transport.requests.find((r) => String(r.url).includes('delete_prepared_reports'))
            expect(JSON.parse(String((stopReq?.data as { reports: string }).reports))).toEqual([{ name: 'PR-0001' }])
            const blob = await client.report.download('PR-0001')
            expect(blob).toBeInstanceOf(Blob)
        })

        it('report view params, run extras, and download body shapes', async () => {
            const { client, transport } = createExtendedTestClient()
            transport.mock({
                method: 'GET',
                path: '/api/v2/method/frappe.desk.reportview.get',
                body: { data: {} },
            })
            await client.report.get({
                doctype: 'ToDo',
                fields: ['name'],
                filters: [],
                orFilters: [],
                orderBy: 'name asc',
                start: 0,
                pageLength: 20,
                groupBy: 'status',
            })
            transport.mock({
                method: 'POST',
                path: '/api/v2/method/frappe.desk.query_report.run',
                body: { data: {} },
            })
            await client.report.run(
                'R',
                {},
                {
                    user: 'Administrator',
                    ignorePreparedReport: true,
                    customColumns: [],
                    isTree: true,
                    parentField: 'p',
                    areDefaultFilters: false,
                    jsFilters: [],
                },
            )
            transport.mock({
                method: 'GET',
                path: '/api/v2/method/frappe.core.doctype.prepared_report.prepared_report.download_attachment',
                body: new ArrayBuffer(2),
                once: true,
            })
            expect(await client.report.download('a')).toBeInstanceOf(Blob)
            transport.mock({
                method: 'GET',
                path: '/api/v2/method/frappe.core.doctype.prepared_report.prepared_report.download_attachment',
                body: new Blob(['x']),
                once: true,
            })
            expect(await client.report.download('b')).toBeInstanceOf(Blob)
            transport.mock({
                method: 'GET',
                path: '/api/v2/method/frappe.core.doctype.prepared_report.prepared_report.download_attachment',
                body: { nope: true },
                once: true,
            })
            await expect(client.report.download('c')).rejects.toMatchObject({ name: 'ResponseError' })
        })
    })

    describe('FrappeDesk', () => {
        it('addComment / updateComment / getComments', async () => {
            const { client, transport } = createExtendedTestClient()
            transport.mock({
                method: 'POST',
                path: '/api/v2/method/frappe.desk.form.utils.add_comment',
                body: { data: {} },
            })
            transport.mock({
                method: 'POST',
                path: '/api/v2/method/frappe.desk.form.utils.update_comment',
                body: { data: {} },
            })
            transport.mock({ method: 'GET', path: '/api/v2/document/Comment', body: { data: [] } })

            await client.desk.addComment({
                referenceDoctype: 'ToDo',
                referenceName: 'x',
                content: 'hi',
                commentEmail: 'a@b.com',
                commentBy: 'a@b.com',
            })
            await client.desk.updateComment('c1', 'edited')
            await client.desk.getComments('ToDo', 'x')
        })

        it('assign / assignMultiple / unassign / closeAssignment', async () => {
            const { client, transport } = createExtendedTestClient()
            transport.mock({
                method: 'POST',
                path: '/api/v2/method/frappe.desk.form.assign_to.add',
                body: { data: [] },
            })
            transport.mock({
                method: 'POST',
                path: '/api/v2/method/frappe.desk.form.assign_to.add_multiple',
                body: { data: {} },
            })
            transport.mock({
                method: 'POST',
                path: '/api/v2/method/frappe.desk.form.assign_to.remove',
                body: { data: [] },
            })
            transport.mock({
                method: 'POST',
                path: '/api/v2/method/frappe.desk.form.assign_to.close',
                body: { data: [] },
            })

            await client.desk.assign({ doctype: 'ToDo', name: 'x', assignTo: 'Administrator' })
            await client.desk.assignMultiple({ doctype: 'ToDo', assignTo: 'Administrator', names: ['x', 'y'] })
            await client.desk.unassign('ToDo', 'x', 'Administrator')
            await client.desk.closeAssignment('ToDo', 'x', 'Administrator')
        })

        it('tags: addTag / removeTag / getTags / getTaggedDocs', async () => {
            const { client, transport } = createExtendedTestClient()
            transport.mock({
                method: 'POST',
                path: '/api/v2/method/frappe.desk.doctype.tag.tag.add_tag',
                body: { data: '#tag' },
            })
            transport.mock({
                method: 'POST',
                path: '/api/v2/method/frappe.desk.doctype.tag.tag.remove_tag',
                body: { data: {} },
            })
            transport.mock({
                method: 'GET',
                path: '/api/v2/method/frappe.desk.doctype.tag.tag.get_tags',
                body: { data: [] },
            })
            transport.mock({
                method: 'GET',
                path: '/api/v2/method/frappe.desk.doctype.tag.tag.get_tagged_docs',
                body: { data: [] },
            })

            await client.desk.addTag('tag', 'ToDo', 'x')
            await client.desk.removeTag('tag', 'ToDo', 'x')
            await client.desk.getTags('ToDo')
            await client.desk.getTaggedDocs('ToDo', 'tag')
        })

        it('share: add / setPermission / getUsers', async () => {
            const { client, transport } = createExtendedTestClient()
            transport.mock({ method: 'POST', path: '/api/v2/method/frappe.share.add', body: { data: {} } })
            transport.mock({ method: 'POST', path: '/api/v2/method/frappe.share.set_permission', body: { data: {} } })
            transport.mock({ method: 'GET', path: '/api/v2/method/frappe.share.get_users', body: { data: [] } })
            transport.mock({
                method: 'POST',
                path: '/api/v2/method/frappe.desk.form.assign_to.add',
                body: { data: [] },
            })
            transport.mock({
                method: 'GET',
                path: '/api/v2/method/frappe.desk.doctype.tag.tag.get_tags',
                body: { data: [] },
            })

            await client.desk.share.add({ doctype: 'ToDo', name: 'x', user: 'a@b.com' })
            await client.desk.share.add({
                doctype: 'ToDo',
                name: 'x',
                user: 'a@b.com',
                read: 0,
                write: 1,
                submit: false,
                share: true,
                everyone: 0,
                notify: 1,
            })
            await client.desk.share.setPermission({
                doctype: 'ToDo',
                name: 'x',
                permissionTo: 'write',
                value: 0,
                everyone: 1,
            })
            await client.desk.share.getUsers('ToDo', 'x')
            await client.desk.assign({ doctype: 'ToDo', name: 'x', assignTo: ['a', 'b'] })
            await client.desk.getTags('ToDo', 'foo')
        })
    })

    describe('db bulk helpers and FrappeSite', () => {
        it('insertMany / updateMany / getPassword / isDocumentAmended / getTimeZone', async () => {
            const { client, transport } = createExtendedTestClient()
            transport.mock({ method: 'POST', path: '/api/v2/method/frappe.client.insert_many', body: { data: [] } })
            transport.mock({
                method: 'POST',
                path: '/api/v2/method/frappe.client.bulk_update',
                body: { data: { failed_docs: [] } },
            })
            transport.mock({
                method: 'POST',
                path: '/api/v2/method/frappe.client.get_password',
                body: { data: 'secret' },
            })
            transport.mock({
                method: 'GET',
                path: '/api/v2/method/frappe.client.is_document_amended',
                body: { data: false },
            })
            transport.mock({
                method: 'GET',
                path: '/api/v2/method/frappe.client.get_time_zone',
                body: { data: { time_zone: 'UTC' } },
            })

            await client.db.insertMany([{ doctype: 'ToDo', description: 'x' } as any])
            await expect(client.db.updateMany([{ doctype: 'ToDo', name: 'TD-1' } as any])).resolves.toEqual({
                failed_docs: [],
            })
            const bulk = transport.requests.find((r) => String(r.url).includes('bulk_update'))
            expect(JSON.parse(String((bulk?.data as { docs: string }).docs))).toEqual([
                { doctype: 'ToDo', name: 'TD-1', docname: 'TD-1' },
            ])
            await expect(client.db.getPassword('User', 'a@b.com', 'password')).resolves.toBe('secret')
            await expect(client.db.isDocumentAmended('ToDo', 'x')).resolves.toBe(false)
            await expect(client.site.getTimeZone()).resolves.toEqual({ time_zone: 'UTC' })
        })

        it('validateLink always uses validate_link on v2 (works on every Frappe release)', async () => {
            const { client, transport } = createExtendedTestClient()
            transport.mock({
                method: 'GET',
                path: '/api/v2/method/frappe.client.validate_link',
                body: { data: { name: 'Administrator' } },
            })

            await expect(client.db.validateLink('User', 'Administrator')).resolves.toEqual({
                name: 'Administrator',
            })
        })

        it('validateLink uses validate_link on v1', async () => {
            const { client, transport } = createExtendedTestClient({ apiVersion: 1 })
            transport.mock({
                method: 'GET',
                path: '/api/method/frappe.client.validate_link',
                body: { message: { name: 'Administrator' } },
            })
            await expect(client.db.validateLink('User', 'Administrator')).resolves.toEqual({
                name: 'Administrator',
            })
        })

        it('validateLinkAndFetch rejects with FeatureNotSupportedError when frappeVersion is not 16', async () => {
            const { client } = createExtendedTestClient()
            await expect(client.db.validateLinkAndFetch('User', 'Administrator', ['name'])).rejects.toThrow(/Frappe 16/)
        })

        it('validateLinkAndFetch calls validate_link_and_fetch when frappeVersion: 16', async () => {
            const { client, transport } = createExtendedTestClient({ frappeVersion: 16 })
            transport.mock({
                method: 'GET',
                path: '/api/v2/method/frappe.client.validate_link_and_fetch',
                body: { data: { name: 'Administrator' } },
            })
            await expect(client.db.validateLinkAndFetch('User', 'Administrator', ['name'])).resolves.toEqual({
                name: 'Administrator',
            })
        })
    })
})
