# Contributing

## Setup

Requires [Node.js](https://nodejs.org/) 20+ and [pnpm](https://pnpm.io/) 11. CI and `.nvmrc` pin Node 22.

```bash
git clone https://github.com/dhiashalabi/frappe-js-client.git
cd frappe-js-client
pnpm install
```

This is a pnpm workspace. Work from the repo root, not `packages/client` alone.

| Path               | Package                     |
| ------------------ | --------------------------- |
| `packages/client`  | `frappe-js-client`          |
| `packages/codegen` | `@frappe-js-client/codegen` |
| `docs`             | Docusaurus site             |

## Before opening a PR

Run the full gate:

```bash
pnpm gate
```

That typechecks, lints, runs unit tests, builds, and checks the public API snapshot (`api:check`) and package publishing constraints. The same quality gate (plus `pnpm format:check`) runs in PR CI and again in the release workflow before publish. Mergify auto-merge waits on the `build` and `docs` check names from `.github/workflows/ci.yml`.

Source changes under `packages/` need a [changeset](https://github.com/changesets/changesets):

```bash
pnpm changeset
```

## Tests

```bash
pnpm test
```

Integration tests (local Frappe site, not in CI):

```bash
# copy .env.example → .env and fill values, or export:
FRAPPE_TEST_URL=http://127.0.0.1:8000 pnpm test:integration
```

Live tests:

```bash
FRAPPE_LIVE_URL=http://127.0.0.1:8001 pnpm test:live
```

Do not commit credentials. `.env` is gitignored; `.env.example` is the template.

## Coding standards

- TypeScript strict mode; match existing file style (Prettier is enforced via lint-staged and `pnpm format:check` in CI).
- Domain modules must not import `api/v1.ts`, `api/v2.ts`, or `core/fetch` (`pnpm lint:deps`). `jsonParam` from `core/url` is allowed.
- Keep secrets out of logs, fixtures, and config files.
