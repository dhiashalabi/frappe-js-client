import { defineConfig } from 'vitest/config'

/**
 * Opt-in run against an already-running Frappe site (staging, a personal bench, etc.).
 * Requires FRAPPE_LIVE_URL. Not run in CI.
 */
export default defineConfig({
    test: {
        environment: 'node',
        include: ['tests/live/**/*.test.ts'],
        testTimeout: 30_000,
        hookTimeout: 30_000,
        fileParallelism: false,
        sequence: { concurrent: false },
        setupFiles: ['tests/live/setup.ts'],
    },
})
