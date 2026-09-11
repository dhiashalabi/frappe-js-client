# Changelog

## 1.0.0

### Patch Changes

- Harden the 1.0 client: fail closed on non-2xx middleware responses, unify XHR/fetch error mapping, honor `hasNextPage` in `paginate()`, reject upload progress combined with middleware, throw `ConfigurationError` instead of plain `Error`, default generics to `unknown`, hide `unsafeTransport()`, and export previously leaked types. Codegen reports a clear v2-only meta error and adds golden-file output tests.
- Updated dependencies:
    - frappe-js-client@3.3.0

All notable changes to `@frappe-js-client/codegen` will be documented in this file.

See [changesets](https://github.com/changesets/changesets). Entries are generated on version.
