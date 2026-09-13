# Stable Release Plan — frappe-js-client 4.0.0 and frappe-codegen 2.0.0

## 1. Goal and scoring criteria

Deliver a stable release covering **core, extended modules, realtime, testing helpers, and codegen**, with documented compatibility and enforceable API guarantees.

This replaces the previous plan and retains all its findings. **10/10 is the target assessment after implementation and verification—not a guarantee of defect-free software.** The current scores remain unchanged until reassessment.

| Area | Current | Target | Required evidence |
|---|---:|---:|---|
| Architecture | 8.5 | **10/10** | Clear ownership, consistent behavior across transports, enforced dependency boundaries, no unresolved architectural findings. |
| API design | 8 | **10/10** | Predictable version behavior, sound mapped types, consistent options/errors, complete public API checks and migration documentation. |
| Implementation | 7.5 | **10/10** | Reproduced defects fixed, meaningful regression tests, real browser/realtime/Frappe validation, verified release artifacts. |

Approved decisions:

- All shipped APIs are included in the stability commitment.
- Focused breaking changes are allowed.
- `frappeVersion` becomes required.
- Zero required runtime dependencies remain a constraint; Socket.IO stays an optional peer.

## 2. Architecture work

### A. Establish one request pipeline

Keep the existing domain modules and version adapters. Introduce one shared pipeline between the executor and transport.

Responsibilities:

- **Adapters:** endpoint paths, verbs, parameter names, capabilities, and envelope strategy.
- **Executor:** execute adapter requests and unwrap successful results.
- **Pipeline:** URL/header preparation, authentication, middleware, retries, cancellation, timing, error mapping, and logging.
- **Transports:** perform one HTTP attempt and return its response.

Fetch, XHR, and the memory transport must use the same pipeline. Custom transports must inherit client authentication, headers, middleware, deadlines, and error behavior.

**Public transport change:** retain `Transport.request()` and the response structure, but make requests describe prepared HTTP operations: absolute URL, method, headers, serialized `body`, credentials, response type, progress callback, and cancellation signal. Remove transport responsibility for configuration, parameter serialization, authentication, retries, and timing budgets.

This also removes the current incompatibility between upload progress and middleware.

### B. Centralize operation lifecycle management

Implement one internal lifecycle helper shared by request execution and upload preparation.

- Caller cancellation and absolute deadlines cover preparation, authentication, middleware, retries, response processing, and uploads.
- Per-attempt timeouts cover authentication and response hooks associated with that attempt, including its single authentication replay.
- Check cancellation before invoking hooks or starting network activity.
- Settle promptly when hooks or stream cleanup never resolve.
- Release stream locks and clear timers/listeners on every exit.
- Observe late rejections and prevent late authentication completion from sending cancelled requests.
- Preserve distinct `CancelledError` and `TimeoutError` outcomes with request context.

### C. Enforce the boundaries

Extend dependency checks to prevent domain modules from importing transport implementations, transports from owning authentication policy, and production entry points from importing testing code.

Document the request flow, extension contracts, authentication-session ownership, and immutable client derivation. Add conformance tests proving `withAuth`, `withHeaders`, and `withMiddleware` behave consistently with every transport.

## 3. Public API and correctness work

### A. Make version behavior explicit

- Require `frappeVersion: 14 | 15 | 16`.
- Default `apiVersion` to `1` for Frappe 14 and `2` for Frappe 15/16.
- Reject Frappe 14 with API v2 during configuration.
- Preserve explicit API v1 on Frappe 15/16.
- Reject unsupported feature options before network activity; remove silent option ignoring.
- Keep version-dependent routing in adapters/capabilities.
- Require Frappe 15 or 16 in codegen configuration; add equivalent CLI and environment settings.
- Give testing helpers a documented Frappe 16 default.

### B. Complete mapped type safety

- Prevent invalid known-DocType mutations from escaping through permissive overloads.
- Bind create/update payloads to the selected DocType without inference widening.
- Apply the same safeguards to bulk inserts.
- Preserve unknown-DocType and dynamic-string usage with explicitly documented weaker guarantees.
- Preserve field-selection inference across lists, pagination, and extended-client derivation.
- Add an optional second insert-map generic so consumers can use `createFrappeClient<GeneratedDocTypes, GeneratedInserts>`.
- Generate child-table insert payloads using child insert types, excluding server-assigned metadata and allowing documented defaults such as optional Check fields.

### C. Fix error and codegen defects

- Restrict exception-class lookup to own properties. Names such as `constructor`, `toString`, and `__proto__` must fall back to the appropriate `FrappeError` subclass.
- Validate malformed standard response envelopes before treating them as successful typed results.
- Keep arbitrary RPC results caller-typed; do not introduce a general schema-validation dependency.
- Reserve `Omit`, `Partial`, `Pick`, and `Record` in codegen’s collision detection.
- Validate generated modules semantically, including child tables, required fields, Check defaults, and generated insert maps.

### D. Correct testing and realtime behavior

- Route memory responses through the shared pipeline, fixing mocked cookie login’s relative-URL failure.
- Remove authentication ownership from `MemoryTransport`; authentication hooks receive the prepared absolute URL from the pipeline.
- Make mocked HTTP errors and response metadata match production behavior.
- Forward Socket.IO reconnection events from the **Manager**, and connection/disconnection events from the **Socket**.
- Test real connection failures, reconnects, room resubscription, refreshed credentials, reference-counted subscriptions, and idempotent cleanup.
- Keep cross-origin credential forwarding opt-in.

### E. Freeze the supported public surface

Add API reports for every exported client subpath and codegen, including type-only exports. Remove accidentally exposed internal adapter/wiring types before the major release.

Document every stable method’s input, result, errors, cancellation behavior, supported Frappe versions, and runtime limitations. Public API changes after this release must follow semantic versioning.

## 4. Validation and acceptance

### Automated regression and conformance tests

Add tests for:

- Cancellation during token loading, refresh, response hooks, retry delay, and stream preparation.
- Never-settling cleanup, late rejection, timeout/cancellation races, and prevention of cancelled replays.
- Fetch/XHR/memory/custom transport parity for authentication, headers, errors, middleware, and derived clients.
- Invalid mapped mutations rejected by TypeScript; valid mapped, generated-insert, explicit-generic, and dynamic usage accepted.
- Generated-symbol collisions and semantic compilation of representative metadata.
- Mock cookie login/logout and real Socket.IO lifecycle events.
- Malformed server responses, unusual document names, and pagination boundaries.

Maintain existing coverage thresholds; coverage alone does not satisfy acceptance.

### Browser and compatibility gates

- Make default Chromium, Firefox, and WebKit tests self-contained, including cookie/CSRF handling, cancellation, XHR progress, upload, and download.
- Keep live browser tests separate and require explicit backend configuration.
- Require live compatibility results for **Frappe 14/API1, 15/API1, 15/API2, 16/API1, and 16/API2**.
- Use disposable test sites and deterministic fixtures for CRUD, child tables, search, permissions, workflow, reports, files, and realtime.
- Validate codegen against Frappe 15 and 16.
- Record exact server versions and fixture revisions. Missing infrastructure is a failed release prerequisite, not a passing skipped suite.

### Consumer and release-artifact checks

- Validate runtime behavior on Node 20, 22, and 24.
- Validate consumer types with TypeScript 5.9 and 6.0.
- Test packed ESM/CJS consumers and browser bundling across every entry point.
- Verify core works without Socket.IO installed.
- Run the sibling `frappe-react-query` checks against the candidate package to identify migration requirements.
- Require the full package gate, formatting, docs typecheck/build, API reports, and browser checks in CI.

## 5. Release sequence and sign-off

1. **Fix the reproduced defects first**, with regression tests.
2. **Implement pipeline and API changes**, preserving those tests throughout the refactor.
3. **Complete compatibility, consumer, and public-surface checks.**
4. **Prepare 4.0 and 2.0 migration guides**, covering required versions, strict mutation types, insert maps, transports, testing helpers, and removed internal exports.
5. **Publish release candidates under `next`** through the release workflow when publication is authorized.
6. **Validate the exact candidate artifacts** against the complete compatibility matrix.
7. **Perform an independent final review** and reassess architecture, API design, and implementation against the criteria above.
8. **Promote to stable only after every mandatory gate passes**, with no unresolved reproducible correctness defects or API-contract ambiguities.

Any candidate change invalidates affected validation results and requires a new candidate. A previous stable version remains available for rollback; the release documentation must explain how consumers can pin it.

The deliverable is a stable, tested compatibility contract backed by evidence. The final scores are assigned from that evidence.
