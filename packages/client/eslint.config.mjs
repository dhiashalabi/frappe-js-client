import { defineConfig } from 'eslint/config'
import globals from 'globals'
import pluginJs from '@eslint/js'
import tseslint from 'typescript-eslint'
import simpleImportSort from 'eslint-plugin-simple-import-sort'
import eslintConfigPrettier from 'eslint-config-prettier'

export default defineConfig(
    { ignores: ['dist/**', 'coverage/**', 'node_modules/**', 'temp/**'] },
    pluginJs.configs.recommended,
    {
        files: ['**/*.ts', '**/*.mts'],
        extends: [...tseslint.configs.recommended],
        plugins: {
            'simple-import-sort': simpleImportSort,
        },
        languageOptions: {
            parserOptions: {
                // This package now lives inside a monorepo (repo root + packages/client both
                // contain config files), so typescript-eslint can no longer infer a single
                // tsconfig root automatically. Pin it explicitly to this package's directory.
                tsconfigRootDir: import.meta.dirname,
            },
        },
        rules: {
            // REST payloads and DocType fields are dynamically typed; codegen keeps the default (error).
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
            'simple-import-sort/imports': 'error',
            'simple-import-sort/exports': 'error',
        },
    },
    {
        languageOptions: {
            globals: {
                ...globals.node,
            },
        },
    },
    eslintConfigPrettier,
)
