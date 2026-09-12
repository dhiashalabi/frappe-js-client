import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        environment: 'node',
        include: ['tests/realtime.test.ts'],
        coverage: {
            provider: 'v8',
            include: ['src/realtime/**/*.ts'],
            exclude: ['src/realtime/types.ts'],
            reporter: ['text', 'lcov'],
            reportsDirectory: './coverage/realtime',
            thresholds: {
                lines: 100,
                functions: 100,
                statements: 100,
                branches: 100,
                perFile: true,
            },
        },
    },
})
