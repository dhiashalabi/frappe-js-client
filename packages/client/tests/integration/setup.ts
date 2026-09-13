/**
 * Shared setup for the opt-in integration suite against a real Frappe site.
 */
import { beforeAll } from 'vitest'

export const FRAPPE_TEST_URL = process.env.FRAPPE_TEST_URL ?? 'http://localhost:8000'
const parsedFrappeVersion = Number(process.env.FRAPPE_TEST_FRAPPE_VERSION ?? 16)
if (![14, 15, 16].includes(parsedFrappeVersion)) throw new Error('FRAPPE_TEST_FRAPPE_VERSION must be 14, 15, or 16.')
export const FRAPPE_TEST_FRAPPE_VERSION = parsedFrappeVersion as 14 | 15 | 16
const parsedApiVersion = Number(process.env.FRAPPE_TEST_API_VERSION ?? (FRAPPE_TEST_FRAPPE_VERSION === 14 ? 1 : 2))
if (![1, 2].includes(parsedApiVersion)) throw new Error('FRAPPE_TEST_API_VERSION must be 1 or 2.')
export const FRAPPE_TEST_API_VERSION = parsedApiVersion as 1 | 2
export const FRAPPE_TEST_API_KEY = process.env.FRAPPE_TEST_API_KEY ?? ''
export const FRAPPE_TEST_API_SECRET = process.env.FRAPPE_TEST_API_SECRET ?? ''
export const FRAPPE_TEST_ADMIN_PASSWORD = process.env.FRAPPE_TEST_ADMIN_PASSWORD ?? 'admin'

beforeAll(() => {
    if (!process.env.FRAPPE_TEST_URL) {
        console.warn(
            '[integration] FRAPPE_TEST_URL is not set — defaulting to http://localhost:8000. ' +
                'Point it at a running Frappe site, or these tests will fail with connection errors.',
        )
    }
})
