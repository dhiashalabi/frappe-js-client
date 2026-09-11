# Codegen

[`@frappe-js-client/codegen`](https://www.npmjs.com/package/@frappe-js-client/codegen) reads DocType metadata from a **live Frappe site** and writes TypeScript interfaces for [`frappe-js-client`](./getting-started.md). Pass `GeneratedDocTypes` into `createFrappeClient` so `db.getDoc('ToDo', name)` infers the row instead of `FrappeDoc<object>`.

It is a separate package with its own release cycle. It depends on `frappe-js-client`; the client never depends on codegen.

Requires `apiVersion: 2` (Frappe **v15+**). Meta is `GET /api/v2/doctype/{doctype}/meta`. On v1 / missing meta the fetch is wrapped: `frappe-codegen requires Frappe v15+ REST API v2…`.

The CLI binary is `frappe-codegen`.

## Install

```bash
pnpm add -D @frappe-js-client/codegen
```

## Config + env

Keep **non-secrets** in `frappe-codegen.config.json`. Credentials go in the environment. The CLI **rejects** a config file that contains `apiKey`, `apiSecret`, or `api-key`.

```json title="frappe-codegen.config.json"
{
    "url": "https://frappe.example.com",
    "out": "src/generated/frappe-types.ts",
    "includeHidden": false,
    "followTables": true,
    "doctypes": ["ToDo", "User"],
    "modules": ["Desk"]
}
```

Allowed file keys: `url`, `out`, `includeHidden`, `followTables`, `doctypes`, `modules`. Other keys are ignored. Non-string entries in `doctypes` / `modules` are dropped.

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

Env: `FRAPPE_URL`, `FRAPPE_API_KEY`, `FRAPPE_API_SECRET`.

If both key and secret are omitted, the CLI uses **anonymous** auth (only works if Guest can read DocType meta).

Default output path: `./frappe-types.generated.ts`. Parent directories are created.

| Situation                | Command                              |
| ------------------------ | ------------------------------------ |
| Installed in the project | `pnpm exec frappe-codegen`           |
| npm                      | `npx frappe-codegen`                 |
| One-off                  | `pnpm dlx @frappe-js-client/codegen` |
| Help                     | `pnpm exec frappe-codegen --help`    |

## CLI reference

Required after merge: a site URL, and at least one DocType source (`--doctype`, `--module`, or config `doctypes` / `modules`).

| Flag                                                 | Default                                   | Meaning                                         |
| ---------------------------------------------------- | ----------------------------------------- | ----------------------------------------------- |
| `-u`, `--url <url>`                                  | env / config                              | Site base URL                                   |
| `-d`, `--doctype <name>`                             | —                                         | Repeatable                                      |
| `--module <name>`                                    | —                                         | Every DocType in that Frappe module. Repeatable |
| `--api-key` / `--api-secret`                         | `FRAPPE_API_KEY` / `FRAPPE_API_SECRET`    | Token auth                                      |
| `-o`, `--out <path>`                                 | `./frappe-types.generated.ts`             | Output `.ts`                                    |
| `--config <path>`                                    | `./frappe-codegen.config.json` if present |                                                 |
| `--follow-tables` / `--no-follow-tables`             | follow on                                 | Table / Table MultiSelect children              |
| `--include-hidden`                                   | off                                       | Form-hidden fields                              |
| `--include-labels` / `--no-include-labels`           | labels on                                 | `/** label */`                                  |
| `--include-doctype-map` / `--no-include-doctype-map` | map on                                    | `GeneratedDocTypes` / `GeneratedInserts`        |
| `--dry-run`                                          | off                                       | Print `name<TAB>seed\|child`, no file           |
| `-h`, `--help`                                       | —                                         |                                                 |

Boolean flags use Node `--no-*` (`allowNegative`).

`--dry-run` still fetches metadata (and children if follow is on). `seed` is a DocType you asked for; `child` came from a Table field.

## What is emitted

Each DocType becomes:

```ts
export type ToDo = FrappeDoc<{ doctype: 'ToDo'; description: string /* … */ }>
export type ToDoInsert = FrappeInsert<ToDo>
```

If the DocType has Check fields, insert typing is `FrappeInsert<Omit<ToDo, checks> & Partial<Pick<ToDo, checks>>>` — Checks are required on read (`0 | 1`) and optional on insert.

When the map is on:

```ts
export interface GeneratedDocTypes {
    ToDo: ToDo
}
export interface GeneratedInserts {
    ToDo: ToDoInsert
}
```

Interface names are TitleCase (`Sales Order` → `SalesOrder`). Names that collide (`Sales Order` vs `Sales-Order`) throw `frappe-codegen: interface name collision: …`. Names starting with a digit are prefixed `_`.

Imports: `FrappeDoc`, `FrappeInsert` from `frappe-js-client/types`; `Link` is added if any `Link<` appears.

### Fields that are skipped

- **Virtual** (`is_virtual`)
- **Layout:** Section / Column / Tab Break, Fold, Heading, Button, HTML, Image
- **Hidden** unless `--include-hidden` (Reminder `user` / `notified` need this — Frappe `hidden` is form visibility, not “absent from the document”)
- Empty `fieldname`

Password fields get a comment that GET is usually empty or masked; use `db.getPassword`.

### Fieldtype → TypeScript

| Frappe                                                                                                                                     | TypeScript                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Check                                                                                                                                      | `0 \| 1`                                                                                  |
| Select                                                                                                                                     | string-literal union from options (`value: Label`, `value,Label`, or bare); else `string` |
| Table / Table MultiSelect                                                                                                                  | `Child[]` if the child DocType was generated, else `FrappeDoc<Record<string, unknown>>[]` |
| Link + options                                                                                                                             | `Link<"Target">`                                                                          |
| Link without options                                                                                                                       | `string`                                                                                  |
| Int, Float, Currency, Percent, Rating, Duration                                                                                            | `number`                                                                                  |
| JSON, Geolocation                                                                                                                          | `unknown`                                                                                 |
| Data, texts, editors, Password, Date/Datetime/Time, Attach*, Barcode, Color, Signature, Phone, Icon, Autocomplete, Read Only, Dynamic Link | `string`                                                                                  |
| anything else                                                                                                                              | `unknown`                                                                                 |

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
} from '@frappe-js-client/codegen'

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

| Export                                                                             | Role                                                 |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `loadConfigFile` / `findDefaultConfigPath` / `mergeConfig` / `DEFAULT_CONFIG_NAME` | Config                                               |
| `resolveDocTypes`                                                                  | Union of explicit names + DocTypes in listed modules |
| `fetchDocTypeMeta` / `fetchDocTypeMetas`                                           | Meta fetch (pool of 4)                               |
| `followChildTables` / `fetchWithOptionalFollow`                                    | Child Table BFS                                      |
| `toInterfaceName` / `assertUniqueInterfaceNames`                                   | Naming                                               |
| `generateInterface` / `generateModule`                                             | Source text                                          |

`listDocTypesInModule`, `childTableDoctypes`, and `mapFieldType` are internal (not on the package barrel).
