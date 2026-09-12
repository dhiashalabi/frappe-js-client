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

    it('formats dates in an explicit Frappe site timezone', () => {
        const instant = new Date('2026-01-01T21:30:05Z')
        expect(formatFrappeDate(instant, 'Asia/Riyadh')).toBe('2026-01-02')
        expect(formatFrappeDatetime(instant, 'Asia/Riyadh')).toBe('2026-01-02 00:30:05')
    })
})
