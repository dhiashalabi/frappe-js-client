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

describe('generated DocType map inference', () => {
    it('infers getDoc from GeneratedDocTypes', () => {
        const frappe = createFrappeClient<GeneratedDocTypes>({
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
    })

    it('untyped getDoc returns a generic FrappeDoc', () => {
        const _frappe = createFrappeClient({ url: 'https://frappe.example.com' })
        type UntypedGetDoc = typeof _frappe.db.getDoc
        expectTypeOf<UntypedGetDoc>().toBeFunction()
        expectTypeOf<Awaited<ReturnType<UntypedGetDoc>>>().toEqualTypeOf<FrappeDoc<object>>()
    })
})
