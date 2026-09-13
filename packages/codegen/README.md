# frappe-codegen

Reads DocType metadata from a **live Frappe site** and emits typed TypeScript interfaces for
[`frappe-js-client`](https://www.npmjs.com/package/frappe-js-client), so
`createFrappeClient<GeneratedDocTypes>(...)` infers `db.getDoc('ToDo', name)` instead of
`Record<string, unknown>`.

Full guide: [Codegen docs](https://dhiashalabi.github.io/frappe-js-client/docs/codegen)

This package has its own release cycle. It depends on `frappe-js-client`; the client never depends
on codegen.

Requires **Frappe v15+** (`apiVersion: 2`). Meta comes from `GET /api/v2/doctype/{doctype}/meta`.

## Install

```bash
pnpm add -D frappe-codegen
```

The binary is `frappe-codegen`.

## Recommended: config + env

Put **non-secrets** in `frappe-codegen.config.json`. Put credentials in the environment. Then run
the binary with no flags (or a `package.json` script).

`frappe-codegen.config.json`:

```json
{
    "url": "https://frappe.example.com",
    "frappeVersion": 16,
    "out": "src/generated/frappe-types.ts",
    "includeHidden": true,
    "followTables": true,
    "doctypes": ["ToDo", "User"],
    "modules": ["Desk"]
}
```

```bash
export FRAPPE_VERSION=16
export FRAPPE_URL="https://frappe.example.com"   # optional if `url` is in the file
export FRAPPE_API_KEY="…"
export FRAPPE_API_SECRET="…"

pnpm exec frappe-codegen
```

`package.json`:

```json
{
    "scripts": {
        "codegen": "frappe-codegen"
    }
}
```

Then `pnpm codegen`.

**Do not** put `apiKey`, `apiSecret`, or `api-key` in the JSON file. The CLI rejects that.

### Precedence

Flags override env, env overrides the config file.

`--doctype` / `--module` are **merged** with `doctypes` / `modules` from the file (union, not
replace).

Config file keys: `url`, `frappeVersion` (`15` or `16`), `out`, `includeHidden`, `followTables`, `doctypes`, `modules`. Labels,
the DocType map, and `--dry-run` are CLI-only.

### Other ways to run

| When                                   | Command                                           |
| -------------------------------------- | ------------------------------------------------- |
| Installed in the project (recommended) | `pnpm exec frappe-codegen`                        |
| npm / yarn                             | `npx frappe-codegen`                              |
| One-off, no install                    | `pnpm dlx frappe-codegen` or `npx frappe-codegen` |
| Help                                   | `pnpm exec frappe-codegen --help`                 |

## One-shot (no config file)

```bash
pnpm exec frappe-codegen \
  --url https://frappe.example.com \
  --frappe-version 16 \
  --api-key "$FRAPPE_API_KEY" --api-secret "$FRAPPE_API_SECRET" \
  --doctype "ToDo" --doctype "User" \
  --include-hidden \
  --out src/generated/frappe-types.ts
```

Omit `--api-key` / `--api-secret` (and the env vars) for **anonymous** meta reads if Guest can
access DocType metadata.

## CLI reference

Required after merge: a site URL, and at least one DocType source (`--doctype`, `--module`, or
config `doctypes` / `modules`).

| Flag                                                 | Default                                     | Meaning                                          |
| ---------------------------------------------------- | ------------------------------------------- | ------------------------------------------------ |
| `-u`, `--url <url>`                                  | `FRAPPE_URL` or config `url`                | Frappe site base URL                             |
| `--frappe-version <15|16>`                           | `FRAPPE_VERSION` or config `frappeVersion` | Required site release                            |
| `-d`, `--doctype <name>`                             | —                                           | DocType to generate. Repeatable                  |
| `--module <name>`                                    | —                                           | All DocTypes in that Frappe module. Repeatable   |
| `--api-key <key>`                                    | `FRAPPE_API_KEY`                            | API key (token auth)                             |
| `--api-secret <secret>`                              | `FRAPPE_API_SECRET`                         | API secret                                       |
| `-o`, `--out <path>`                                 | `./frappe-types.generated.ts`               | Output `.ts` file. Parent dirs are created       |
| `--config <path>`                                    | `./frappe-codegen.config.json` if it exists | Config file path                                 |
| `--follow-tables` / `--no-follow-tables`             | follow (on)                                 | Also generate Table / Table MultiSelect children |
| `--include-hidden` / `--no-include-hidden`           | hidden on                                   | Emit form-hidden fields                          |
| `--include-labels` / `--no-include-labels`           | labels on                                   | `/** label */` above each field                  |
| `--include-doctype-map` / `--no-include-doctype-map` | map on                                      | Emit `GeneratedDocTypes` / `GeneratedInserts`    |
| `--dry-run`                                          | off                                         | Print `name<TAB>seed\|child` and exit (no file)  |
| `-h`, `--help`                                       | —                                           | Print help                                       |

Frappe `hidden` is **form visibility**, not “missing on the document”, so hidden fields are
included by default. Use `--no-include-hidden` when you intentionally want to omit them.

Virtual fields (`is_virtual`) and layout fieldtypes (`Section Break`, `Image`, `Button`, …) are
never emitted.

`--dry-run` still fetches metadata (including children if follow is on) so you can see seed vs
child names.

## Typed client

```ts
import { createFrappeClient } from 'frappe-js-client'
import type { GeneratedDocTypes, GeneratedInserts } from './generated/frappe-types'

const frappe = createFrappeClient<GeneratedDocTypes, GeneratedInserts>({ url, frappeVersion: 16, auth })
const todo = await frappe.db.getDoc('ToDo', name)
```

## What gets generated

Each DocType becomes a read type (`FrappeDoc<{ doctype: "…", … }>`) plus `SomethingInsert`
(`FrappeInsert<…>`). Check fields are required on the read type (`0 | 1`) and optional on insert.
`GeneratedDocTypes` / `GeneratedInserts` map Frappe names to those types.

Link fields with a target become `Link<"Customer">`. Table children are generated when follow is
on (default) or when you list the child DocType yourself.

Select options become string literals from each complete trimmed line. Colons and commas remain
part of the stored option value.

## Programmatic API

```ts
import { createFrappeClient } from 'frappe-js-client'
import { fetchWithOptionalFollow, generateModule, loadConfigFile, mergeConfig, resolveDocTypes } from 'frappe-codegen'

const client = createFrappeClient({ url, frappeVersion: 16, apiVersion: 2, auth })
const names = await resolveDocTypes(client, {
    doctypes: ['ToDo'],
    modules: [],
})
const metas = await fetchWithOptionalFollow(client, names, true)
const source = generateModule(metas, { includeHidden: true })
```

Library exports: config (`loadConfigFile`, `mergeConfig`, …), meta (`fetchDocTypeMeta` / `fetchDocTypeMetas`), resolve (`resolveDocTypes`, `followChildTables`, `fetchWithOptionalFollow`), generate (`generateModule`, `generateInterface`, `toInterfaceName`, `assertUniqueInterfaceNames`).

Full signatures: [Codegen docs](https://dhiashalabi.github.io/frappe-js-client/docs/codegen).
