import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        environment: 'node',
        include: ['tests/**/*.test.ts'],
        exclude: ['tests/live/**', 'tests/integration/**'],
        coverage: {
            provider: 'v8',
            include: ['src/**/*.ts'],
            // Type-only modules and `export { x } from` barrels have no instrumentable
            // statements (V8 reports them as 0/0). They are exercised by tests/barrels.test.ts.
            exclude: [
                'src/**/*.d.ts',
                'src/**/types.ts',
                'src/types.ts',
                'src/index.ts',
                'src/errors.ts',
                'src/middleware.ts',
                'src/realtime.ts',
                'src/realtime/**',
                'src/core/transport.ts',
                'src/modules/deps.ts',
            ],
            reporter: ['text', 'lcov'],
            thresholds: {
                lines: 98,
                functions: 98,
                statements: 98,
                branches: 98,
                perFile: true,
            },
        },
    },
})
