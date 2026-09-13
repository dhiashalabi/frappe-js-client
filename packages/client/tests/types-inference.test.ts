import { describe, expectTypeOf, it } from 'vitest'

import { createFrappeClient, type FrappeClient } from '../src/client'
import type { FrappeDoc, FrappeInsert, Link } from '../src/core/types'

type Reminder = FrappeDoc<{
    doctype: 'Reminder'
    user: Link<'User'>
    remind_at: string
    notified: 0 | 1
}>

interface GeneratedDocTypes {
    Reminder: Reminder
}

interface GeneratedInserts {
    Reminder: { user: string; remind_at: string; notified?: 0 | 1 }
}

describe('generated DocType map inference', () => {
    it('rejects invalid payloads for known doctypes while allowing dynamic names', () => {
        const client = createFrappeClient<GeneratedDocTypes>({ url: 'https://frappe.example.com', frappeVersion: 16 })
        if (process.env.FRAPPE_TYPECHECK_ONLY === '1') {
            // @ts-expect-error known DocType requires user and remind_at
            void client.db.createDoc('Reminder', {})
            // @ts-expect-error known field must have a valid type
            void client.db.updateDoc('Reminder', 'REM-1', { notified: 'yes' })
            // @ts-expect-error known DocType bulk inserts require its fields
            void client.db.insertMany([{ doctype: 'Reminder', notified: 2 }])
            // @ts-expect-error known DocType bulk inserts cannot omit required fields
            void client.db.insertMany([{ doctype: 'Reminder', notified: 1 }])
            const dynamic: string = 'Custom'
            void client.db.createDoc(dynamic, { custom: 1 })
        }
    })

    it('uses a generated insert map without weakening the read type', () => {
        const client = createFrappeClient<GeneratedDocTypes, GeneratedInserts>({
            url: 'https://frappe.example.com',
            frappeVersion: 16,
        })
        if (process.env.FRAPPE_TYPECHECK_ONLY === '1') {
            void client.db.createDoc('Reminder', { user: 'Administrator', remind_at: '2026-01-01' })
            // @ts-expect-error required generated field is absent
            void client.db.createDoc('Reminder', { notified: 1 })
            // @ts-expect-error known bulk insert needs required generated fields
            void client.db.insertMany([{ doctype: 'Reminder', notified: 1 }])
            void client.db.insertMany([{ doctype: 'Reminder', user: 'Administrator', remind_at: '2026-01-01' }])
        }
        expectTypeOf<Awaited<ReturnType<typeof client.db.getDoc>>>().toMatchTypeOf<Reminder | FrappeDoc<object>>()
    })
    it('infers getDoc from GeneratedDocTypes', () => {
        const frappe = createFrappeClient<GeneratedDocTypes>({
            frappeVersion: 16,
            url: 'https://frappe.example.com',
        })
        expectTypeOf(frappe.db.getDoc).toBeCallableWith('Reminder', 'x')
        expectTypeOf<Awaited<ReturnType<FrappeClient<GeneratedDocTypes>['db']['getDoc']>>>().toMatchTypeOf<
            Reminder | FrappeDoc<object>
        >()

        type Insert = FrappeInsert<Reminder>
        expectTypeOf<Insert>().toMatchTypeOf<{
            user: string
            remind_at: string
            notified: 0 | 1
        }>()
        expectTypeOf(frappe.db.insertMany).toBeCallableWith([
            {
                doctype: 'Reminder',
                user: 'Administrator',
                remind_at: '2026-01-01 09:00:00',
                notified: 0,
            },
        ])
    })

    it('untyped getDoc returns a generic FrappeDoc', () => {
        const _frappe = createFrappeClient({ frappeVersion: 16, url: 'https://frappe.example.com' })
        type UntypedGetDoc = typeof _frappe.db.getDoc
        expectTypeOf<UntypedGetDoc>().toBeFunction()
        expectTypeOf<Awaited<ReturnType<UntypedGetDoc>>>().toEqualTypeOf<FrappeDoc<object>>()
    })
})
