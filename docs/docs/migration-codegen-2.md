# Migrate to frappe-codegen 2.0

Specify the Frappe server release (`15` or `16`) in config, the CLI, or the environment. Codegen requires API v2 and does not support Frappe 14.

```json
{ "url": "https://frappe.example.com", "frappeVersion": 16, "doctypes": ["ToDo"] }
```

The equivalents are `--frappe-version 16` and `FRAPPE_VERSION=16`. Flags override the environment, which overrides the config file. Missing or unsupported versions fail before any metadata request.

Regenerate output after upgrading. Child tables now reference child insert types rather than stored-document types, excluding server-assigned `name`, `owner`, and timestamp fields from nested payloads. Check fields remain `0 | 1` on reads and are optional on inserts. Use both maps with the client:

```ts
const client = createFrappeClient<GeneratedDocTypes, GeneratedInserts>({ url, frappeVersion: 16 })
```

DocType names that would collide with generated symbols or TypeScript utility names (`Omit`, `Partial`, `Pick`, `Record`) now fail generation with a collision diagnostic. Rename or exclude the conflicting DocType in your generation inputs. Keep the previous stable codegen available with `pnpm add -D frappe-codegen@1.1.0` while migrating.
