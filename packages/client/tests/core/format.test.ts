import { describe, expect, it } from 'vitest'

import { formatFrappeDate, formatFrappeDatetime } from '../../src/core/format'

describe('core/format', () => {
    it('formatFrappeDate pads to YYYY-MM-DD in local time', () => {
        const date = new Date(2024, 0, 5) // Jan 5, 2024, local time
        expect(formatFrappeDate(date)).toBe('2024-01-05')
    })

    it('formatFrappeDatetime pads to YYYY-MM-DD HH:mm:ss in local time', () => {
        const date = new Date(2024, 0, 5, 9, 2, 7)
        expect(formatFrappeDatetime(date)).toBe('2024-01-05 09:02:07')
    })
})
