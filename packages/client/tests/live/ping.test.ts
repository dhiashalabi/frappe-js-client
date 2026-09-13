import { describe, expect, it } from 'vitest'

import { createFrappeClient } from '../../src/index'
import { FRAPPE_LIVE_URL } from './setup'

describe('live: manual smoke test against an arbitrary site', () => {
    it('pings the configured site', async () => {
        const frappe = createFrappeClient({ frappeVersion: 16, url: FRAPPE_LIVE_URL! })
        await expect(frappe.auth.ping()).resolves.toBeTypeOf('string')
    })
})
