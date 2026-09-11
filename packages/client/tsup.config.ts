import { defineConfig } from 'tsup'

export default defineConfig({
    entry: {
        index: 'src/index.ts',
        extended: 'src/extended.ts',
        errors: 'src/errors.ts',
        middleware: 'src/middleware.ts',
        types: 'src/types.ts',
        testing: 'src/testing.ts',
        realtime: 'src/realtime.ts',
    },
    format: ['cjs', 'esm'],
    dts: {
        compilerOptions: {
            ignoreDeprecations: '6.0',
        },
    },
    sourcemap: true,
    clean: true,
    splitting: true,
    treeshake: true,
    target: 'es2022',
    platform: 'neutral',
    // Zero required runtime dependencies. `socket.io-client` is an optional peer dependency
    // used only by the `realtime` entry (dynamically imported there) — never bundled.
    external: ['socket.io-client'],
})
