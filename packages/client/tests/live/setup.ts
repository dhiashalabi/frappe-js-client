/** Opt-in manual run against FRAPPE_LIVE_URL. Not part of CI. */
import { beforeAll } from 'vitest'

export const FRAPPE_LIVE_URL = process.env.FRAPPE_LIVE_URL

beforeAll(() => {
    if (!FRAPPE_LIVE_URL) {
        throw new Error('Set FRAPPE_LIVE_URL to run tests/live against a real site.')
    }
})
