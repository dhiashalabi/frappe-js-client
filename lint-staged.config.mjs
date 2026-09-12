import path from 'node:path'

function quote(file) {
    return `'${file.replaceAll("'", "'\\''")}'`
}

function eslintIn(pkg) {
    return (files) => {
        const args = files.map((file) => quote(path.relative(pkg, file))).join(' ')
        return `pnpm --dir ${pkg} exec eslint --fix -- ${args}`
    }
}

export default {
    'packages/client/**/*.{js,cjs,mjs,ts,mts}': eslintIn('packages/client'),
    'packages/codegen/**/*.{js,cjs,mjs,ts,mts}': eslintIn('packages/codegen'),
    '**/*.{js,cjs,mjs,ts,mts,json,md,yml,yaml,css}': 'prettier --write',
}
