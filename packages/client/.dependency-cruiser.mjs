/**
 * dependency-cruiser rules for frappe-js-client.
 *
 *   - no circular dependencies anywhere in src/
 *   - domain modules (src/modules/**) must stay version-agnostic: they may only reach the
 *     v1/v2 API differences through api/adapter.ts, never by importing api/v1.ts or api/v2.ts
 *     directly.
 *   - only client.ts and testing.ts are allowed to import api/v1.ts or api/v2.ts directly
 *     (they pick one based on config.apiVersion); everywhere else must go through the
 *     version-agnostic ApiAdapter interface.
 *   - src/testing/** (the in-memory transport used by ./testing) must never be imported from
 *     production code paths (core/api/modules/client), only from testing.ts and tests/.
 *
 * Run with `pnpm lint:deps`.
 */
export default {
    forbidden: [
        {
            name: 'no-circular',
            severity: 'error',
            comment: 'Circular imports make the module graph impossible to reason about and can break tree-shaking.',
            from: {},
            to: { circular: true },
        },
        {
            name: 'no-orphans',
            severity: 'warn',
            comment:
                'A module that nothing imports and that imports nothing else is probably dead code or a forgotten export.',
            from: { orphan: true, pathNot: ['\\.d\\.ts$', 'env\\.d\\.ts$'] },
            to: {},
        },
        {
            name: 'only-client-may-import-both-adapters',
            severity: 'error',
            comment:
                'api/v1.ts and api/v2.ts should only be selected-between (based on config.apiVersion) in client.ts and testing.ts (which builds the same kind of client backed by MemoryTransport for tests) — everywhere else should go through the version-agnostic ApiAdapter interface.',
            from: { path: '^src/(?!client\\.ts$|testing\\.ts$)' },
            to: { path: '^src/api/(v1|v2)\\.ts$' },
        },
        {
            name: 'modules-must-not-import-fetch-or-adapter-impl',
            severity: 'error',
            comment:
                'Domain modules talk to the server only through api/adapter + core/executor. They must not import core/fetch, api/v1, or api/v2. `jsonParam` from core/url is allowed for RPC param serialization.',
            from: { path: '^src/modules/' },
            to: { path: '^src/(core/fetch\\.ts$|api/v1\\.ts$|api/v2\\.ts$)' },
        },
        {
            name: 'testing-transport-is-test-only',
            severity: 'error',
            comment:
                'src/testing/** (MemoryTransport, fixtures) backs the ./testing entry point and unit tests only — it must never be reachable from core/api/modules/client, or it would ship in every consumer bundle.',
            from: { path: '^src/(core|api|modules|client\\.ts)' },
            to: { path: '^src/testing' },
        },
        {
            name: 'no-deprecated-core',
            severity: 'error',
            comment: 'Do not depend on Node.js core modules that are deprecated or unsafe by default.',
            from: {},
            to: { dependencyTypes: ['core'], path: '^(punycode|domain|sys)$' },
        },
    ],
    options: {
        doNotFollow: { path: 'node_modules' },
        exclude: { path: '(^|/)(dist|coverage|tests)($|/)' },
        tsPreCompilationDeps: true,
        tsConfig: { fileName: 'tsconfig.json' },
        enhancedResolveOptions: {
            exportsFields: ['exports'],
            conditionNames: ['import', 'require', 'types'],
        },
        reporterOptions: {
            text: { highlightFocused: true },
        },
    },
}
