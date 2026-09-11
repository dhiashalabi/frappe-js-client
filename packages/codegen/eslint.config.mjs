import { defineConfig } from 'eslint/config'
import globals from 'globals'
import pluginJs from '@eslint/js'
import tseslint from 'typescript-eslint'
import simpleImportSort from 'eslint-plugin-simple-import-sort'
import eslintConfigPrettier from 'eslint-config-prettier'

export default defineConfig(
    { ignores: ['dist/**', 'coverage/**', 'node_modules/**'] },
    pluginJs.configs.recommended,
    {
        files: ['**/*.ts'],
        extends: [...tseslint.configs.recommended],
        plugins: {
            'simple-import-sort': simpleImportSort,
        },
        languageOptions: {
            parserOptions: {
                // Monorepo: multiple packages each have their own tsconfig.json, so the root
                // cannot be inferred automatically. Pin it to this package's directory.
                tsconfigRootDir: import.meta.dirname,
            },
        },
        rules: {
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
