# Changelog

## 1.1.0

### Minor Changes

- [#9](https://github.com/dhiashalabi/frappe-js-client/pull/9) [`4b74ef2`](https://github.com/dhiashalabi/frappe-js-client/commit/4b74ef24606c0f9dbba359becc21b03594e8e017) Thanks [@dhiashalabi](https://github.com/dhiashalabi)! - Add request option validation, timezone-aware date formatting, richer error handling, and tighter list pagination. Default codegen to include hidden fields. Add browser tests and packed-consumer checks.

### Patch Changes

- Updated dependencies [[`4b74ef2`](https://github.com/dhiashalabi/frappe-js-client/commit/4b74ef24606c0f9dbba359becc21b03594e8e017)]:
    - frappe-js-client@3.4.0

## 1.0.0

### Patch Changes

- Harden the 1.0 client: fail closed on non-2xx middleware responses, unify XHR/fetch error mapping, honor `hasNextPage` in `paginate()`, reject upload progress combined with middleware, throw `ConfigurationError` instead of plain `Error`, default generics to `unknown`, hide `unsafeTransport()`, and export previously leaked types. Codegen reports a clear v2-only meta error and adds golden-file output tests.
- Updated dependencies:
    - frappe-js-client@3.3.0

All notable changes to `@frappe-js-client/codegen` will be documented in this file.

See [changesets](https://github.com/changesets/changesets). Entries are generated on version.
