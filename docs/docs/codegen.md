# Codegen

[`frappe-codegen`](https://www.npmjs.com/package/frappe-codegen) reads DocType metadata from a **live Frappe site** and writes TypeScript interfaces for [`frappe-js-client`](./getting-started.md). Pass `GeneratedDocTypes` into `createFrappeClient` so `db.getDoc('ToDo', name)` infers the row instead of `FrappeDoc<object>`.

It is a separate package with its own release cycle. It depends on `frappe-js-client`; the client never depends on codegen.

Requires `apiVersion: 2` (Frappe **v15+**). Meta is `GET /api/v2/doctype/{doctype}/meta`. On v1 / missing meta the fetch is wrapped: `frappe-codegen requires Frappe v15+ REST API v2…`. There is no classic-REST fallback.

The CLI binary is `frappe-codegen`. The same package also exports a programmatic API (this page). Generated TypeDoc lives under **Codegen API** in the sidebar.

Node **20+**.

## Install

```bash
pnpm add -D frappe-codegen
```

## Config + env

Keep **non-secrets** in `frappe-codegen.config.json`. Credentials go in the environment. The CLI **rejects** a config file that contains `apiKey`, `apiSecret`, or `api-key`.

```json title="frappe-codegen.config.json"
{
    "url": "https://frappe.example.com",
    "out": "src/generated/frappe-types.ts",
    "includeHidden": true,
    "followTables": true,
    "doctypes": ["ToDo", "User"],
    "modules": ["Desk"]
}
```

Allowed file keys: `url`, `out`, `includeHidden`, `followTables`, `doctypes`, `modules`. Other keys are ignored. Non-string entries in `doctypes` / `modules` are dropped. Non-boolean `includeHidden` / `followTables` are treated as unset. The file must be a JSON object (not `null` or an array).

```bash
export FRAPPE_URL="https://frappe.example.com"   # optional if url is in the file
export FRAPPE_API_KEY="…"
export FRAPPE_API_SECRET="…"
pnpm exec frappe-codegen
```

```json title="package.json"
{
    "scripts": {
        "codegen": "frappe-codegen"
    }
}
```

### Precedence

**Flags > environment > config file.**

`--doctype` / `--module` are **unioned** with the file lists (then de-duplicated). They do not replace them.

`--include-labels`, `--include-doctype-map`, `--dry-run`, and secrets are CLI/env only.

Env: `FRAPPE_URL`, `FRAPPE_API_KEY`, `FRAPPE_API_SECRET`. Empty env values are ignored.

If both key and secret are omitted, the CLI uses **anonymous** auth (only works if Guest can read DocType meta). Supplying only one of key/secret also falls back to anonymous.

Default output path: `./frappe-types.generated.ts`. Parent directories are created.

| Situation                | Command                           |
| ------------------------ | --------------------------------- |
| Installed in the project | `pnpm exec frappe-codegen`        |
| npm                      | `npx frappe-codegen`              |
| One-off                  | `pnpm dlx frappe-codegen`         |
| Help                     | `pnpm exec frappe-codegen --help` |

## CLI reference

Required after merge: a site URL, and at least one DocType source (`--doctype`, `--module`, or config `doctypes` / `modules`).

| Flag                                                 | Default                                   | Meaning                                         |
| ---------------------------------------------------- | ----------------------------------------- | ----------------------------------------------- |
| `-u`, `--url <url>`                                  | env / config                              | Site base URL                                   |
| `-d`, `--doctype <name>`                             | —                                         | Repeatable                                      |
| `--module <name>`                                    | —                                         | Every DocType in that Frappe module. Repeatable |
| `--api-key` / `--api-secret`                         | `FRAPPE_API_KEY` / `FRAPPE_API_SECRET`    | Token auth                                      |
| `-o`, `--out <path>`                                 | `./frappe-types.generated.ts`             | Output `.ts`                                    |
| `--config <path>`                                    | `./frappe-codegen.config.json` if present | Explicit config path                            |
| `--follow-tables` / `--no-follow-tables`             | follow on                                 | Table / Table MultiSelect children              |
| `--include-hidden` / `--no-include-hidden`           | hidden on                                 | Form-hidden fields                              |
| `--include-labels` / `--no-include-labels`           | labels on                                 | `/** label */`                                  |
| `--include-doctype-map` / `--no-include-doctype-map` | map on                                    | `GeneratedDocTypes` / `GeneratedInserts`        |
| `--dry-run`                                          | off                                       | Print `name<TAB>seed\|child`, no file           |
| `-h`, `--help`                                       | —                                         |                                                 |

Boolean flags use Node `--no-*` (`allowNegative`).

`--dry-run` still fetches metadata (and children if follow is on). `seed` is a DocType you asked for; `child` came from a Table field. Progress goes to stderr; dry-run lines go to stdout.

A config path passed with `--config` is always loaded (it does not have to be the default filename). Without `--config`, `./frappe-codegen.config.json` is used only if it exists.

CLI failures print `frappe-codegen failed: …` to stderr and set `process.exitCode = 1`. `--help` writes the usage text and exits 0.

`--module Desk` paginates `DocType` with `filters: [['module', '=', 'Desk']]`. No matches after resolve throws `No DocTypes matched`.

## One-shot (no config file)

```bash
pnpm exec frappe-codegen \
  --url https://frappe.example.com \
  --api-key "$FRAPPE_API_KEY" --api-secret "$FRAPPE_API_SECRET" \
  --doctype "ToDo" --doctype "User" \
  --include-hidden \
  --out src/generated/frappe-types.ts
```

## What is emitted

Each DocType becomes:

```ts
export type ToDo = FrappeDoc<{ doctype: 'ToDo'; description: string /* … */ }>
export type ToDoInsert = FrappeInsert<ToDo>
```

If the DocType has Check fields, insert typing is `FrappeInsert<Omit<ToDo, checks> & Partial<Pick<ToDo, checks>>>` — Checks are required on read (`0 | 1`) and optional on insert.

Fields with `reqd: 1` are required on the read type. Other fields are optional (`?`), except Checks (always required on read).

When the map is on:

```ts
export interface GeneratedDocTypes {
    ToDo: ToDo
}
export interface GeneratedInserts {
    ToDo: ToDoInsert
}
```

Map keys are the exact Frappe names (`"Sales Order"`). Pass the map as `createFrappeClient<GeneratedDocTypes>(...)`.

A file header warns not to edit by hand. Each type has a short generated-from-DocType comment.

Interface names are TitleCase (`Sales Order` → `SalesOrder`; `item-price` → `ItemPrice`; `foo/bar` → `FooBar`; `Item (Variant)` → `ItemVariant`). Names that collide (`HR Settings` vs `HRSettings`) throw `frappe-codegen: interface name collision: …`. Names starting with a digit are prefixed `_` (`2FA Settings` → `_2FASettings`).

Field names that are not valid JS identifiers are quoted (`"weird name": string`).

Imports: `FrappeDoc`, `FrappeInsert` from `frappe-js-client/types`; `Link` is added if any `Link<` appears.

Labels containing `*/` are escaped so they cannot break out of the doc comment.

### Fields that are skipped

- **Virtual** (`is_virtual`)
- **Layout:** Section / Column / Tab Break, Fold, Heading, Button, HTML, Image
- **Hidden** only with `--no-include-hidden` (hidden fields are included by default because Frappe `hidden` controls form visibility, not whether the field exists on the document)
- Empty `fieldname`

Password fields get a comment that GET is usually empty or masked; use `db.getPassword`. The comment is emitted even when labels are off.

A DocType with no data fields still emits `doctype: "…"`.

### Fieldtype → TypeScript

| Frappe                                                                                                                                     | TypeScript                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Check                                                                                                                                      | `0 \| 1`                                                                                  |
| Select                                                                                                                                     | string-literal union from complete trimmed option lines; else `string`                    |
| Table / Table MultiSelect                                                                                                                  | `Child[]` if the child DocType was generated, else `FrappeDoc<Record<string, unknown>>[]` |
| Link + options                                                                                                                             | `Link<"Target">`                                                                          |
| Link without options                                                                                                                       | `string`                                                                                  |
| Int, Float, Currency, Percent, Rating, Duration                                                                                            | `number`                                                                                  |
| JSON, Geolocation                                                                                                                          | `unknown`                                                                                 |
| Data, texts, editors, Password, Date/Datetime/Time, Attach*, Barcode, Color, Signature, Phone, Icon, Autocomplete, Read Only, Dynamic Link | `string`                                                                                  |
| anything else                                                                                                                              | `unknown`                                                                                 |

Select options are split on newlines and trimmed; each complete non-empty line becomes a literal, including commas and colons. Empty/whitespace-only options yield `string`.

`--follow-tables` (default) BFS-walks Table / Table MultiSelect `options` and generates those child DocTypes too. `--no-follow-tables` leaves child rows as `FrappeDoc<Record<string, unknown>>[]` unless you listed the child yourself.

Normalized meta also keeps `istable` / `issingle` (0/1); they do not change the emitted TypeScript.

## Typed client

```ts
import { createFrappeClient } from 'frappe-js-client'
import type { GeneratedDocTypes, GeneratedInserts } from './generated/frappe-types'

const frappe = createFrappeClient<GeneratedDocTypes>({ url, auth })
const todo = await frappe.db.getDoc('ToDo', name)
await frappe.db.createDoc('ToDo', {
    description: 'Follow up',
    status: 'Open',
} satisfies GeneratedInserts['ToDo'])
```

Regenerate on DocType changes. Commit the generated file or produce it in CI — do not edit it by hand.

## CI

```yaml
- run: pnpm exec frappe-codegen --config frappe-codegen.config.json
  env:
      FRAPPE_URL: ${{ secrets.FRAPPE_URL }}
      FRAPPE_API_KEY: ${{ secrets.FRAPPE_API_KEY }}
      FRAPPE_API_SECRET: ${{ secrets.FRAPPE_API_SECRET }}
```

Point `--out` at a path your app already imports. Fail the job if codegen exits non-zero (missing DocTypes, v1 site, name collision).

## Programmatic API

Use this from a build script instead of shelling out. You can use any client auth; the CLI only supports token or anonymous.

```typescript
import { createFrappeClient, tokenAuth } from 'frappe-js-client'
import {
    DEFAULT_CONFIG_NAME,
    assertUniqueInterfaceNames,
    fetchDocTypeMeta,
    fetchDocTypeMetas,
    fetchWithOptionalFollow,
    findDefaultConfigPath,
    followChildTables,
    generateInterface,
    generateModule,
    loadConfigFile,
    mergeConfig,
    resolveDocTypes,
    toInterfaceName,
} from 'frappe-codegen'

const path = findDefaultConfigPath() // DEFAULT_CONFIG_NAME in cwd, if present
const file = path ? loadConfigFile(path) : undefined
const config = mergeConfig(file, { doctypes: ['ToDo'] })

const client = createFrappeClient({
    url: config.url!,
    apiVersion: 2,
    auth: tokenAuth({ apiKey: config.apiKey!, apiSecret: config.apiSecret! }),
})

const names = await resolveDocTypes(client, {
    doctypes: config.doctypes,
    modules: config.modules,
})
const metas = await fetchWithOptionalFollow(client, names, config.followTables)
assertUniqueInterfaceNames(metas)
const source = generateModule(metas, {
    includeHidden: config.includeHidden,
    includeLabels: config.includeLabels,
    emitDocTypeMap: config.emitDocTypeMap,
})
```

### Config

| Export                        | Role                                                       |
| ----------------------------- | ---------------------------------------------------------- |
| `DEFAULT_CONFIG_NAME`         | `'frappe-codegen.config.json'`                             |
| `findDefaultConfigPath(cwd?)` | Path if the default file exists                            |
| `loadConfigFile(path)`        | Reads JSON; rejects secrets                                |
| `mergeConfig(file, overlay)`  | File, then env, then overlay. Union `doctypes` / `modules` |
| `CodegenFileConfig`           | File shape                                                 |
| `CliOverlay`                  | Overlay shape (CLI flags / script)                         |
| `ResolvedCodegenConfig`       | Merged result (`out`, booleans, `dryRun`, secrets, …)      |

`mergeConfig` defaults: `out: './frappe-types.generated.ts'`, `includeHidden: true`, `followTables: true`, `dryRun: false`, `emitDocTypeMap: true`, `includeLabels: true`.

### Meta

| Export                                | Role                                                                                              |
| ------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `DocField`                            | `fieldname`, `fieldtype`, `label?`, `options?`, `reqd?`, `hidden?`, `description?`, `is_virtual?` |
| `DocTypeMeta`                         | `name`, `fields`, `istable?`, `issingle?`                                                         |
| `fetchDocTypeMeta(client, doctype)`   | One DocType via `db.getMeta`                                                                      |
| `fetchDocTypeMetas(client, doctypes)` | Pool of **4** concurrent fetches                                                                  |

`FeatureNotSupportedError` / `NotFoundError` from `getMeta` are rethrown as `Error` with the v15+ / v2 message and `{ cause }`. Other errors propagate unchanged.

### Resolve

| Export                                           | Role                                                 |
| ------------------------------------------------ | ---------------------------------------------------- |
| `resolveDocTypes(client, { doctypes, modules })` | Union of explicit names + DocTypes in listed modules |
| `followChildTables(client, seeds)`               | BFS Table / Table MultiSelect children               |
| `fetchWithOptionalFollow(client, names, follow)` | Fetch seeds, then optionally follow                  |

`listDocTypesInModule` and `childTableDoctypes` are internal (not on the package barrel).

### Generate

| Export                                      | Role                                                                       |
| ------------------------------------------- | -------------------------------------------------------------------------- |
| `toInterfaceName(doctype)`                  | `Sales Order` → `SalesOrder`                                               |
| `assertUniqueInterfaceNames(metas)`         | Throws on collision                                                        |
| `generateInterface(meta, allMetas?, opts?)` | One read type + insert alias                                               |
| `generateModule(metas, opts?)`              | Full `.ts` module (calls `assertUniqueInterfaceNames`)                     |
| `GenerateOptions`                           | `includeHidden?`, `includeLabels?`, `emitDocTypeMap?` (all default as CLI) |

`mapFieldType`, `selectLiterals`, `LAYOUT_FIELD_TYPES`, and `isTableFieldType` are internal.

The CLI (`parseCliArgs`, `main`, `boot`) is the `frappe-codegen` binary, not a library export.
