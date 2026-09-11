import { defineConfig } from 'tsup'

export default defineConfig([
    {
        entry: { index: 'src/index.ts' },
        format: ['cjs', 'esm'],
        dts: {
            entry: { index: 'src/index.ts' },
            compilerOptions: {
                ignoreDeprecations: '6.0',
            },
        },
        sourcemap: true,
        clean: false,
        splitting: false,
        treeshake: true,
        target: 'es2022',
        platform: 'node',
    },
    {
        entry: { cli: 'src/cli.ts' },
        format: ['cjs'],
        dts: false,
        sourcemap: true,
        clean: false,
        splitting: false,
        treeshake: true,
        target: 'es2022',
        platform: 'node',
    },
])
