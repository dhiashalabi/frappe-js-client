# frappe-js-client — Final Review and Improvement Plan

## Assessment: 8/10 overall

| Area | Score | Assessment |
|---|---:|---|
| Architecture | **8.5/10** | Clear adapter → executor → transport boundaries, enforced dependency rules, and separate extended/realtime entry points. Request lifecycle handling needs consolidation. |
| API design | **8/10** | Consistent request options, immutable configuration, useful generated types, and extensible authentication. Mutation overloads weaken type safety. |
| Implementation | **7.5/10** | Strong test coverage and packaging checks, with reproduced cancellation, error-mapping, codegen, and testing-helper defects remaining. |

**Recommendation:** Keep the architecture and address the findings below before the next release.

Verified during this review:

- Full `pnpm gate` passed, including builds, lint, typechecking, API checks, package validation, and isolated packed consumers.
- **339 client tests and 112 codegen tests passed.** The dedicated realtime coverage run also passed its 32 tests.
- All configured coverage thresholds passed at 100%.
- Formatting and docs typechecking passed.
- Browser tests: **6 passed; 6 failed with HTTP 502 because the required Frappe backend was unavailable.** Live compatibility remains unverified.
- No tracked files changed.

## Findings and implementation plan

### 1. P1 — Make cancellation and timeouts settle requests reliably

**Evidence:** Cancelling while an asynchronous token accessor remains pending does not reject the request. A pending `onResponse` hook also outlives the configured timeout. Upload deadlines can hang while awaiting stream cancellation.

Sources: [authentication/request handling](/home/dhiashalabi/Developer/frappe-react/frappe-js-client/packages/client/src/core/fetch.ts:195), [stream cleanup](/home/dhiashalabi/Developer/frappe-react/frappe-js-client/packages/client/src/modules/file/index.ts:87).

- Introduce a shared internal helper that races asynchronous work against cancellation and applicable timing budgets.
- Apply caller cancellation and the operation deadline during authentication preparation; apply the attempt timeout during transport execution, response hooks, and refresh.
- Preserve `CancelledError` versus `TimeoutError`, including request context.
- Reject promptly without awaiting unbounded stream cleanup; release reader locks and observe cleanup rejections.
- Prevent late completion from sending a replay after cancellation. Clean up timers/listeners on every exit.
- Preserve the current public `RequestOptions` interface and per-attempt timeout semantics.

### 2. P2 — Keep unknown server exceptions inside the error hierarchy

**Evidence:** `exc_type: "constructor"` produces a plain object; `"toString"` and `"__proto__"` trigger `TypeError`.

Source: [exception lookup](/home/dhiashalabi/Developer/frappe-react/frappe-js-client/packages/client/src/core/errors.ts:187).

- Restrict exception lookup to own properties.
- Use the existing HTTP-status fallback for unknown names.
- Preserve recognized Frappe exception precedence and response metadata.

### 3. P2 — Enforce mapped mutation payload types

**Evidence:** For a known DocType, missing required fields and invalid create/update field values compile through permissive fallback overloads.

Source: [mutation overloads](/home/dhiashalabi/Developer/frappe-react/frappe-js-client/packages/client/src/modules/db/index.ts:179).

- Bind known literal DocTypes to their mapped insert/update shapes; prevent payload inference from widening that shape.
- Prevent known literals from silently selecting the untyped fallback.
- Preserve dynamic-string and unknown-DocType usage, plus explicit generics on untyped clients.
- Apply equivalent safeguards to mapped `insertMany`.
- Update API snapshots and migration examples. As you selected, accept the typing compatibility change and release it with a major client version.

### 4. P2 — Reject generated names that shadow utility types

**Evidence:** DocTypes named `Omit`, `Partial`, `Pick`, or `Record` can generate modules that fail semantic TypeScript checking.

Source: [reserved symbols](/home/dhiashalabi/Developer/frappe-react/frappe-js-client/packages/codegen/src/generate.ts:46).

- Reserve these utility names alongside existing generated/imported symbols.
- Follow the existing collision policy: fail with a descriptive diagnostic rather than silently rename.
- Add semantic compilation checks using the TypeScript program API; syntax-only transpilation cannot detect these failures.

### 5. P2 — Fix cookie authentication in the testing helper

**Evidence:** `createTestClient({ auth: cookieAuth() })` throws `TypeError: Invalid URL` when a mocked login returns `Set-Cookie`.

Source: [mock response hook](/home/dhiashalabi/Developer/frappe-react/frappe-js-client/packages/client/src/testing/memory-transport.ts:78).

- Add optional `baseUrl` to `MemoryTransportOptions`, defaulting to `https://test.local`.
- Have `createTestClient` supply its normalized client URL.
- Resolve absolute URLs for authentication hooks while preserving existing route matching and recorded request shapes.
- Verify cookie storage and logout reset using the real cookie strategy.

### 6. P2 — Make browser validation reproducible in CI

**Evidence:** CI excludes browser/live integration suites; browser login/upload tests require a separately running Frappe site.

- Make the default browser suite self-contained with local cookie, CSRF, upload, and download fixtures.
- Retain real-server checks under a separate `test:browser:live` command requiring an explicit backend URL and a startup availability check.
- Run the self-contained suite in Chromium, Firefox, and WebKit within the existing required CI `build` job and release validation.
- Keep live results explicitly separate from simulated protocol checks.

## Acceptance tests

- Pending token lookup rejects on cancellation; pending response/refresh hooks reject on timeout; no replay occurs after cancellation.
- Upload deadline/cancellation rejects even when the stream’s `cancel()` never settles, with no retained reader lock or unhandled rejection.
- Prototype-property exception names return the appropriate `FrappeError` subclass.
- Compiler tests reject invalid mapped mutations and accept valid mapped, explicit-generic, and dynamic usage.
- Generated utility-name collisions fail clearly; representative generated modules pass semantic compilation.
- Mock cookie login populates the jar and logout clears it.
- All self-contained browser tests pass without Frappe running; the full gate, formatting, and docs typechecking remain green.

## Assumptions and boundaries

Preserve zero required runtime dependencies, the existing module boundaries, and supported REST generations. Scope includes the client, codegen, testing helpers, and validation tooling. Real Frappe v14/v15/v16 compatibility requires separate live validation before claiming complete release readiness.
