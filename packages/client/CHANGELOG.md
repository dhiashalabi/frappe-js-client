# frappe-js-client

## 3.4.0

### Minor Changes

- [#9](https://github.com/dhiashalabi/frappe-js-client/pull/9) [`4b74ef2`](https://github.com/dhiashalabi/frappe-js-client/commit/4b74ef24606c0f9dbba359becc21b03594e8e017) Thanks [@dhiashalabi](https://github.com/dhiashalabi)! - Add request option validation, timezone-aware date formatting, richer error handling, and tighter list pagination. Default codegen to include hidden fields. Add browser tests and packed-consumer checks.

## 3.3.0

### Minor Changes

- Harden the 1.0 client: fail closed on non-2xx middleware responses, unify XHR/fetch error mapping, honor `hasNextPage` in `paginate()`, reject upload progress combined with middleware, throw `ConfigurationError` instead of plain `Error`, default generics to `unknown`, hide `unsafeTransport()`, and export previously leaked types. Codegen reports a clear v2-only meta error and adds golden-file output tests.
