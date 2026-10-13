# Eight-week delivery tracker

This is an evidence tracker, not a claim that the roadmap is finished.
“Implemented” means code and automated checks exist. Real-service verification
remains separate. No production deployment or database mutation is authorized
by this document.

## Phase 0 — Safety boundaries

Implemented:

- Active Clerk organization required for interactive workspace access; a default
  organization is reserved for explicitly authenticated maintenance.
- Organization predicates on order/inventory CRUD and promotion analytics.
- Central permission checks, opaque public tracking tokens, authenticated Gmail
  notification handling, and regression tests for these boundaries.
- Authenticated order creation requires an intent-bound idempotency key and
  atomic order/coupon/audit/event writes. No non-transactional fallback.
- Catalog pricing rejects unknown/ambiguous products and corrupt prices instead
  of manufacturing revenue.
- Database-index readiness fails closed.
- Recursive Gmail MIME/attachment body extraction, retryable body-fetch failures,
  and fail-closed ingestion lock acquisition.
- Atomic bounded workspace migration with empty-target preflight, reserved-global
  protection, outbox-drain checks and projection invalidation.
- Primary-branch trained email classifier and draft/review workflows reconciled
  with strict workspace/permission checks and authenticated Gmail ingestion.
- Administrator-only Google OAuth with expiring browser/user/workspace-bound,
  single-use state and workspace-bound encrypted refresh credentials; watch and
  ingestion use the configured workspace's credential.

Still required:

- Exhaustive route and AI tool permission matrix, schema validation everywhere,
  and adversarial integration tests against real MongoDB.
- Large-tenant resumable migration rehearsal, Gmail history expiry recovery,
  issuance checkpoint/reconciliation and live Google integration certification.
- Existing deployment index migration and removal of all unsupported claims.

## Phase 1 — Operational source of truth

Implemented:

- Order line product IDs and minor-unit price snapshots for new API orders.
- Controlled forward status transitions, cancellation reasons, stale-write
  detection, and transactional append-only order-event records.
- Order detail timeline and visible workflow errors.
- Validated IST business dates/times with UTC instants; impossible dates fail
  rather than silently becoming the current time.
- Durable order-created outbox, leased workers, bounded retries, and transactional
  rollup consumer receipts.
- Audited stock movements, per-order reservations, derived quantity-aware
  fulfillment, atomic cancellation releases, guarded returns and stock-ledger UI.
  Metadata updates are version-fenced and cannot mutate stock balances.

Still required:

- Automatic allocation, shipment documents/carriers, return authorization and
  inspection, partial cancellation, financial credits and coupon reconciliation.
- All creation channels and mutations on shared transactional commands/events.
- Scheduler provisioning, queue monitoring/recovery UI, rebuild coordination.
- Role-specific exception dashboard and onboarding.

## Phase 2 — Trustworthy intelligence

Implemented:

- Organization-scoped analytics/retrieval foundations and deterministic memory
  chunk IDs.
- Category charts describe on-hand stock rather than calling stock “sales.”
- Outage states do not appear as valid zero inventory/dealer data.
- Model initialization recovers from transient rejection while preserving
  single-flight loading. EWMA anomaly limits use prior observations, with
  prefix-invariance tests preventing look-ahead leakage.

Still required:

- Snapshot-based historical revenue across all reports and consistent demand
  semantics, materialized read models, provenance/freshness.
- Forecast walk-forward backtesting, calibrated intervals, drift monitoring.
- Authorized AI tools, conversation retention/deletion, source versioning,
  grounded-answer checks and golden/adversarial evaluation fixtures.
- A deployment-tested, long-lived model execution plane with admission control,
  readiness, cancellation, pinned artifacts and load certification.

## Phase 3 — Production operations and integrations

Implemented:

- Responsive mobile navigation drawer, keyboard focus containment/restoration,
  accessible command palette, and reduced-motion support.
- Compatible Next.js 16.4.0 / Axios 1.20.0 upgrades remove the reported critical
  Next.js advisory. Fifty dependency findings remain (40 high, 10 moderate).
- Root-level application layout, ignored local/generated artifacts, secret-free
  environment template, contributor/release guidance and GitHub verification
  workflow. Lint is explicitly advisory while its debt remains.

Still required:

- Cursor pagination/search indexes throughout the application.
- Versioned deployment migrations, safe recovery runbooks.
- Structured observability/OpenTelemetry, error capture, SLOs and alerting.
- Backup/restore drill, retention enforcement, realistic load tests.
- ERP/WMS adapter framework and reconciliation.
- Physical-device/browser layout checks and accessibility fixes for remaining
  page-specific overlays.
- Dependency vulnerability remediation with compatibility checks.

## Verification boundaries

The repository can be typechecked, unit/component tested, and production-built
with a synthetic Clerk publishable key. This does not validate sign-in, real
MongoDB transactions/indexes, Gmail, Atlas retrieval, model packaging under the
deployment resource ceiling, or scheduler behavior.

Live end-user certification requires a disposable replica-set database and
working test Clerk organizations/users. Never claim browser/live-service checks
when only source review or mocks were used. Four pre-existing skipped test
placeholders are not acceptance evidence.

Latest local gate: 36 suites, 212 tests passing; the real ONNX classifier passes
8/8 smoke cases. TypeScript, production build and
`git diff --check` passing. The build used a synthetic publishable Clerk key,
not live service credentials.
Repository-wide lint reports 240 problems (217 errors, 23 warnings). GitHub CI
has not been run for these unpublished changes.

## Integration status

The primary checkout's `main` and this thread's `main` diverged independently.
Their independent root-directory relocations were reconciled against their
common application baseline, preserving both histories. The candidate retains
primary trained email classification, drafts/reviews and visual navigation
alongside transactional/security and accessibility work. Final remote landing
and CI results are reported in the thread, not inferred from this document.

The independent final review was unavailable due to provider usage limits.
Manual integration review and the execution gates above were performed; that
does not certify live-service behavior or all eight-week implementation phases.

Subsequent Google and inventory slices received read-only QA in the existing
shared checkout (no new branches/worktrees). The primary local checkout was
fast-forwarded to the reconciled main; its untracked documents were preserved.

Current real-service blocker: no MongoDB/Clerk/Google credentials are configured.
Docker's client is installed, but the Docker Desktop Linux engine is unavailable
(the named pipe does not exist). No disposable replica-set rollback/concurrency
or authenticated browser certification is claimed.
