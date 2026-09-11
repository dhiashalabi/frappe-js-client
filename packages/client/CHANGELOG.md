# frappe-js-client

## 3.3.0

### Minor Changes

- [`d758a5b`](https://github.com/dhiashalabi/frappe-js-client/commit/d758a5b4fa15da2ed8ffe19d3fbc4f36505f3738) Thanks [@dhiashalabi](https://github.com/dhiashalabi)! - Harden the 1.0 client: fail closed on non-2xx middleware responses, unify XHR/fetch error mapping, honor `hasNextPage` in `paginate()`, reject upload progress combined with middleware, throw `ConfigurationError` instead of plain `Error`, default generics to `unknown`, hide `unsafeTransport()`, and export previously leaked types. Codegen reports a clear v2-only meta error and adds golden-file output tests.
