---
'frappe-js-client': minor
---

Route `db.validateLink` to `frappe.client.validate_link_and_fetch` on Frappe 16 (`fields` → `fields_to_fetch`). `validate_link` was removed in Frappe 16 — pass `frappeVersion: 16`. Normalize `search.searchWidget` for the Frappe 14 `{ values }` envelope. Throw `FeatureNotSupportedError` when `getDocList` `expand` is used with `frappeVersion: 14`.
