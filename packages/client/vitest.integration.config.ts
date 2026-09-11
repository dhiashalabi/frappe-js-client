import { defineConfig } from 'vitest/config'

/**
 * Opt-in run against a real Frappe instance. Not run in CI.
 * Set FRAPPE_TEST_URL (and optionally FRAPPE_TEST_ADMIN_PASSWORD,
 * FRAPPE_TEST_API_KEY, FRAPPE_TEST_API_SECRET). See tests/integration/setup.ts.
 */
export default defineConfig({
    test: {
        environment: 'node',
        include: ['tests/integration/**/*.test.ts'],
        testTimeout: 30_000,
        hookTimeout: 60_000,
        fileParallelism: false,
        sequence: { concurrent: false },
        setupFiles: ['tests/integration/setup.ts'],
    },
})
