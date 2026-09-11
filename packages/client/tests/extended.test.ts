import { describe, expect, it } from 'vitest'

import { getClientInternal } from '../src/client'
import { tokenAuth } from '../src/core/auth'
import { withExtended } from '../src/extended'
import { createFrappeClient } from '../src/index'

describe('frappe-js-client/extended', () => {
    it('withExtended attaches the extended tier onto the same transport/config', () => {
        const core = createFrappeClient({ url: 'https://example.com' })
        const extended = withExtended(core)

        expect(extended.permission).toBeDefined()
        expect(extended.site).toBeDefined()
        expect(extended.workflow).toBeDefined()
        expect(extended.report).toBeDefined()
        expect(extended.desk).toBeDefined()
        expect(extended.db).toBe(core.db)
        expect(getClientInternal(extended).transport).toBe(getClientInternal(core).transport)
    })

    it('withAuth / withMiddleware / withHeaders keep the extended tier', () => {
        const extended = withExtended(createFrappeClient({ url: 'https://example.com' }))
        const derived = extended.withAuth(tokenAuth({ apiKey: 'k', apiSecret: 's' }))
        expect(derived.report).toBeDefined()
        expect(derived.permission).toBeDefined()
        expect(derived.config.auth.name).toBe('token')
        expect(extended.config.auth.name).not.toBe('token')
        expect(derived.withMiddleware(async (req, next) => next(req)).report).toBeDefined()
        expect(derived.withHeaders({ 'X-A': '1' }).report).toBeDefined()
    })
})
