# Production implementation backlog

This is the authoritative **remaining-work** list after the current feature is
landed. An unchecked item is not implemented or not sufficiently verified.
Code passing unit tests/build/CI is not live-service or production certification.

## Current implementation — do not duplicate

- Active Clerk organization access, normalized role permissions, opaque public
  tracking, authenticated Gmail notifications and admin-only OAuth.
- Workspace-bound encrypted Gmail credentials and one-time OAuth state.
- Canonical order persistence shared by web, Gmail and reviewed drafts:
  catalog SKU/money snapshots, transactional audit events and durable outbox.
- Stock movement/reservation ledger, derived per-line fulfillment, atomic
  cancellation release and optimistic metadata updates.
- Manual carrier/tracking shipment records and delivery proof.
- Two-person return authorization, partial inspection receipts, damaged-stock
  quarantine and exact cumulative discounted credit **memos**. These are not
  external payment refunds.
- Snapshot-based overview/net booked-value reporting and explicit coverage.
- Chronological forecast selection/calibration/held-out evaluation, empirical
  horizon intervals, bounded catalog pages and honest unavailable metrics.
- AI tool policy, sensitive-text redaction, deterministic operational facts,
  guarded citations, bounded local generation, cancellation/deadlines, pinned
  model revisions and provenance. Private vector memory is opt-in with retention.
- Mobile workspace/navigation/command-palette accessibility and verified CI.

## Operating constraints

- Continue on `main`; do not create a branch/worktree unless explicitly requested.
- Do not use Docker. Use Node-based fixtures and approved test services.
- Secrets belong in private environment/secret-manager configuration, never Git,
  logs, test fixtures derived from real accounts, or this document.
- Do not mutate the existing remote database without identifying its target and
  obtaining approval. No production dataset is a test fixture.
- Every money/stock/integration feature needs negative, concurrency and
  retry/fault tests, not only a successful request.
- Live checks requiring keys are pending; mocked tests must be labeled as such.

## P0 — Release-blocking correctness and security

### 1. Legacy catalog/order reconciliation and deployment migration

- [ ] Add a versioned, resumable migration framework, not a sequence of
  untracked `updateMany` calls.
  - Reuse `lib/migrations/workspace.ts`; add migration records/checkpoints,
    source/target versions, dry-run plan, expected counts and verification.
  - Backfill canonical SKU IDs only for exact, unique **tenant-scoped** matches.
    Ambiguous, renamed or missing SKUs must become an operator exception.
  - Never recreate historical prices from today's inventory price or a ₹50
    fallback. Finance must confirm original invoice snapshots with a supporting
    reference and audit event where evidence is missing.
  - Preserve original placement instants and separate delivery dates; normalize
    business dates consistently to `Asia/Kolkata`.
  - Inventory legacy opening entries remain `legacy_snapshot`, not fabricated
    historical audit completeness.
  - Larger-than-10,000-record workspace moves need staged, resumable migration
    and cutover, collision/reference checks, and projection re-key/rebuild.
  - Encrypted integration credentials require re-encryption/reconnection; never
    merely change their `orgId`.
  - **Acceptance:** interruption/resume, duplicate target names/keys, missing
    foreign references, legacy keyed orders without hashes, and repeated dry
    runs are tested. A failed rehearsal cannot partially move a tenant.

### 2. Durable outbox completion, demand semantics and projection rebuild

- [ ] Provision and implement a long-running non-Docker worker/scheduler.
  - Extend `lib/orders/outbox.ts` with graceful shutdown, bounded batches,
    lease renewal/fencing, attempt limits and explicit exhausted-event recovery.
  - A worker must check whether its fenced completion update actually matched.
    A lost lease is not a successfully processed event.
  - Separate rollup, customer-signal and AI-memory outcomes so a model outage
    cannot silently stall essential financial/operational projections.
  - Add admin-only queue depth/age/error/history and audited retry UI/API.
  - Add immutable before/after event snapshots for amendments/cancellation,
    not projections based on an arbitrarily mutated current order.
  - Define forecasting demand as accepted ordered units, cancellations excluded;
    returns must not silently rewrite originally observed demand.
  - Coordinate `lib/analytics/rollup.ts` rebuilds with consumer receipts and
    in-flight events. Current `$merge` backfill must not retain stale target-only
    rows or double count an event already included in the rebuild.
  - **Acceptance:** crashes before/after each side effect, lease expiry, duplicate
    deliveries, retries after ambiguous commits, cancellation before projection,
    and rebuild during ingestion produce the same reconciled totals.

### 3. Gmail history recovery, channel ownership and ingestion bounds

- [ ] Complete `app/api/webhook/gmail/route.ts` recovery for expired history.
  - Handle Gmail history 404 as a reconciliation requirement; do not retry the
    same unusable cursor forever or jump past unprocessed messages.
  - Use bounded, checkpointed resync with durable per-message deduplication,
    incident metadata and operator-visible progress.
  - Renew the ingestion lease while processing pages; stop advancing the cursor
    after loss of ownership.
  - Bound pages/messages/time and hand off remaining work to a durable job.
  - Bind incoming mailbox identity and topic/channel configuration to the
    connected workspace. Add multi-tenant channel setup instead of one global
    `GMAIL_ORG_ID` when that product scope is enabled.
  - Persist malformed/empty/MIME-unresolvable messages as explicit review cases;
    do not silently classify missing evidence as successful ingestion.
  - Provide credential disconnect/revocation and key-rotation/reconnection UX.
  - **Acceptance:** nested MIME, attachment failures, stale/expired/out-of-order
    history, partial page failures, concurrent notifications and forged mailbox
    identity cannot lose or duplicate an order.

### 4. Coupon issuance/reversal recovery and promotion consistency

- [ ] Replace synchronous issuance in `app/api/admin/schemes/issue/route.ts`
  with a resumable leased job.
  - Persist eligibility version, customer checkpoint and per-batch outcome.
  - Coupon issuance, counters and batch checkpoint must commit consistently.
    Existing coupons cannot cause lost counters after a retry.
  - Generate collision-resistant holdout codes; email prefixes are not unique.
  - Add job progress/history/resume/cancel and failed-job reconciliation UI.
  - Specify cancellation/return coupon policy: lifetime usage, benefit reversal,
    global/per-customer caps, expiration and reissue eligibility.
  - Record audit reversals without accidentally granting reusable discounts.
  - **Acceptance:** failures at each batch boundary and counter update, overlapping
    jobs, repeated customers and canceled/returned orders reconcile exactly.

### 5. Complete authorization and request/response schemas

- [ ] Audit every route, server action, job and AI tool against one capability
  matrix in `lib/authorization.ts`.
  - Separate contact-level/customer PII from aggregate dashboard access.
  - Enforce ownership and permissions inside reusable command boundaries as well
    as routes; no client-controlled user/org/role substitution.
  - Define permitted service actors for imports and integrations explicitly.
  - Validate JSON shape, types, safe money/quantity ranges, maximum sizes,
    allowed fields, IDs, enums and dates before database/network operations.
  - Finish CSRF/origin/content-type policy for all interactive mutations.
  - Bound all query execution and return sanitized error classes/messages.
  - Add role-aware controls backed by server capabilities, not merely hidden UI.
  - **Acceptance:** multi-tenant/wrong-role matrix includes every route/tool and
    denial happens before reads/writes; malformed inputs never become writes.

## P1 — Complete operational workflows

### 6. Automatic allocation, shortages and partial cancellation

- [ ] Add atomic allocation commands for all canonical order lines.
  - Reserve no more than available stock or remaining ordered units.
  - Record shortages/backorders and deterministic allocation policy.
  - Implement cancellation of **unfulfilled remaining** line quantities on
    partially fulfilled orders without reversing shipped units.
  - Preserve original line snapshots; track canceled/fulfilled/returned quantities
    separately, with immutable before/after events.
  - Release reservations and reconcile promotional/financial effects in the same
    transaction. Never mutate order labels independently of the ledger.
  - **Acceptance:** competing orders for the final unit, allocation vs cancellation,
    partial cancellation vs dispatch, duplicate intent and stale versions.

### 7. Carrier integration, delivery and customer notification

- [ ] Extend current manual shipment workflow in `lib/orders/operations.ts`.
  - Add validated private delivery addresses, parcel/weight/unit metadata,
    label creation, carrier references, tracking events and delivery exceptions.
  - External label/provider calls belong outside the Mongo transaction, using
    durable idempotent jobs and provider request keys.
  - Validate signed carrier webhooks and prevent out-of-order status regression.
  - Add order/customer notification jobs with consent, templates and retries;
    do not widen Gmail read scope merely to send messages.
  - Add audited tracking-link issuance/rotation for inbound/reviewed orders.
    Persist only token hashes; expose the bearer URL only to an authorized
    requester and never logs. Generating a hash without delivering the raw
    token does not create a usable customer tracking link.
  - Distinguish dispatched/fulfilled quantities from delivered shipment state.
  - **Acceptance:** provider timeout after successful label creation, duplicate
    webhook, failed delivery, partial shipments and retried notification.

### 8. Return disposition, financial settlement and archival

- [ ] Finish lifecycle around current return authorization/credit memos.
  - Add quarantine release/scrap/rework commands with inspection authority and
    explicit audit provenance; quarantined goods cannot be reserved or sold.
  - Add restocking fees/tax handling where applicable, original-invoice currency
    policy and approved settlement/correction workflow.
  - Connect credit memos to an accounting/payment adapter. Record separate
    pending/confirmed/failed refund states; a local memo is not a payment refund.
  - Prevent credit total exceeding original discounted booked value.
  - Add safe SKU archival, not deletion of movement history; handle authorized
    returns into an archived SKU without hiding physical goods.
  - **Acceptance:** multiple partial receipts, damaged/resalable splits, cumulative
    rounding, multiple authorized returns, duplicate settlement and provider error.

### 9. Role-specific exceptions and onboarding

- [ ] Add actionable exception queues for warehouse, inventory, finance and admin.
  - Missing SKU/invoice evidence, shortages, pending approvals, late delivery,
    stalled jobs, unpriced analytics and integration conflicts.
  - Include owner, age, severity, source link, next action and resolution history.
  - Workspace selection is implemented; finish invitations/role assignment,
    permissions explanation, demo-vs-real-data separation and initial data setup.
  - Approval controls need reject/request-changes reasons and two-person policy.
  - **Acceptance:** each role sees only permitted data/actions; outages are not
    rendered as empty warehouses or successful zero metrics.

## P1 — Analytics and AI correctness

### 10. Monetary consistency across every report/tool

- [ ] Extend current snapshot-based overview to all remaining analytics.
  - Audit `app/api/customer-analytics`, `product-analytics`, price/deadstock
    reports, `lib/promotions/analytics.ts`, `signals.ts`, RFM and private AI tools.
  - Remove quantity-as-currency proxies and current-catalog-price historical joins.
  - Report currency and basis (booked value, credits, cash or recognized revenue)
    explicitly; do not add incompatible currencies.
  - Coverage must include missing/unverified legacy snapshots and invalid credits.
    Incomplete totals must remain labeled subtotals.
  - Distinguish lifetime new customers from single-order customers in a period.
  - **Acceptance:** repricing/renaming today's SKU cannot change a historical
    invoice; return credits affect the correct posting period; no ₹50 fallback.

### 11. Forecast, drift and replenishment certification

- [ ] Complete validation beyond the current chronological forecast implementation.
  - Reconcile unmapped legacy demand; expose canonical-only coverage per SKU.
  - Collect actual supplier lead times, purchasing/holding costs and stockout
    censoring evidence before claiming EOQ/cost-optimal purchasing.
  - Backtest by SKU cohort (intermittent, seasonal, new, declining) and horizon.
    Keep selection, calibration and final validation disjoint.
  - Measure empirical coverage, bias, WAPE/MAE and benchmark against naive models;
    zero-demand and sparse histories require unavailable—not invented—confidence.
  - Add drift alerts, model/version history and operator feedback.
  - **Acceptance:** reproducible held-out fixtures, no future information leakage,
    honest sparse-history outputs and documented interval limitations.

### 12. AI privacy, provenance and erasure completion

- [ ] Finish lifecycle around current AI governance/retention controls.
  - Add authenticated personal conversation deletion and admin source-erasure
    APIs/UI. Use `ai_source_controls` tombstones to prevent later re-ingestion.
  - Serialize erasure against embedding/upsert transactions and invalidate stale
    deterministic chunks when a source shrinks or changes.
  - Migrate old private memory/conversations to explicit retention or erase them;
    private records without expiry are intentionally not trusted for retrieval.
  - Separate ingestion time, source event time, source version and answer time.
    Persist validated citation IDs, tool policy decision and model/prompt version.
  - Add source inspection with permission re-check and an erased/expired response.
  - Strengthen PII/credential detection with adversarial fixtures. Current
    redaction/citation checks are controls, not formal semantic groundedness proof.
  - **Acceptance:** erasure vs pending outbox/embedding race cannot recreate private
    data; forbidden/expired/foreign sources never enter model or response context.

### 13. AI evaluation and long-lived model execution

- [ ] Add the non-Docker long-lived inference service/worker and release-gating evals.
  - Warm pinned/checksummed artifacts; readiness is false on load failure.
  - Current admission is process-local. Add global/per-tenant limits, bounded
    queue, deadlines, disconnect cancellation and native-resource accounting.
  - Bound embedding concurrency and knowledge bootstrap single-flight as well
    as generation. Retain capacity until native execution actually stops.
  - Add structured traces for routing score, retrieval tier, source IDs, tool
    status, load/inference timing, fallback and failure class without raw PII.
  - Build versioned golden/adversarial sets for routing, private-data access,
    injection, fabricated citations, numeric claims and answer abstention.
  - Test real generator API/artifacts/resource ceilings, not only mocked
    generation or the eight-case real email-classifier smoke check.
  - **Acceptance:** cold/warm latency, overload, abort, provider/download failure,
    queue exhaustion and retry recovery on the actual deployment runtime.

### 14. Hybrid retrieval and search coverage

- [ ] Make retrieval genuinely hybrid rather than vector-or-fallback.
  - Run authorized vector and indexed lexical retrieval, then fuse ranks.
  - Remove age bias from the bounded 500-recent-document fallback or expose its
    coverage limitation; older correct sources must remain retrievable.
  - Provision/verify Atlas `vec_idx_v3` expiry/kind/org filters, retries/readiness
    and versioned index migration. Global curated knowledge stays separate.
  - **Acceptance:** exact lexical and semantic matches both survive fusion, older
    sources are found, and authorization/expiry hold in both retrieval paths.

## P1 — Production operations and integrations

### 15. Cursor pagination, query/index budgets and read models

- [ ] Replace remaining offset/unbounded reads.
  - Orders, inventory, feedback/errors, promotions/coupons, customer analytics
    and operation-history lists need stable indexed compound cursors.
  - Preserve sort keys and add an `_id` tie-breaker; validate cursor/filter binding.
  - Use indexed tenant search, not unrestricted case-insensitive substring scans.
  - Materialize expensive reporting where needed with reconciled source version,
    freshness, rebuild coordination and explicit completeness.
  - Move DDL/index migration to deployment tooling; production app credentials
    should verify readiness without broad schema-administration privileges.
  - **Acceptance:** bounded response/memory, explain-plan assertions, stale cursor,
    concurrent insert/delete, deep page and million-record synthetic fixtures.

### 16. Structured observability, readiness and SLOs

- [ ] Implement telemetry end-to-end, not just console error names.
  - Add OpenTelemetry registration/export behind explicit configuration.
  - Request/job correlation IDs; spans for auth, Mongo, outbox, carrier/integration,
    retrieval, model load and generation.
  - Log only allowlisted/redacted fields; no query bodies, tokens, contacts,
    connection strings or complete provider error/request objects.
  - Health separates process liveness from database/index/job/model readiness.
  - Define latency/error/queue-age SLOs and alert thresholds with owners/runbooks.
  - **Acceptance:** injected faults produce a correlated diagnostic trace and
    explicit degraded state; telemetry failure cannot break business writes.

### 17. Backup, retention and verified restore drill

- [ ] Add backup automation and a non-Docker recovery rehearsal.
  - Snapshot consistency across canonical collections and operation/outbox state.
  - Encrypt backup artifacts; keep keys separately and backup files out of Git.
  - Restore only to an explicitly isolated test namespace by default; never
    overwrite the existing remote operational database.
  - Verify counts, hashes, types, indexes, ownership and replay/reconciliation.
  - Define RPO/RTO, retention schedules, rotation/access controls and a gated
    production recovery runbook.
  - **Acceptance:** actual disposable restore proves recovered data; corruption,
    wrong key, interrupted backup/restore and partial output fail safely.

### 18. Load, resilience and browser/accessibility certification

- [ ] Add reproducible load/fault tooling with no Docker requirement.
  - Seed isolated synthetic tenants/catalog/orders; never copy private production
    data into fixtures or public CI artifacts.
  - Exercise contention for the last unit, concurrent returns/cancellation,
    issuance/outbox races and large catalog/report pages.
  - Record latency percentiles, error/timeout rates, memory, query volume and
    queue depth; compare against declared budgets.
  - Add real browser keyboard/mobile checks for remaining dialogs, forms,
    permissions, pagination, uncertain retries and tracking error states.
  - Replace four skipped integration placeholders with real acceptance tests.
  - **Acceptance:** documented repeatable commands, adversarial multi-tenant
    fixtures, controlled dependencies and no unsupported “load-certified” claims.

### 19. ERP/WMS/accounting adapter framework

- [ ] Implement an actual adapter boundary and durable sync.
  - Versioned DTOs for products, stock, orders, shipments, returns and credit memos.
  - Explicit source-of-truth rules, external IDs, mapping and conflict resolution.
  - Encrypted per-workspace credentials, least-privilege scopes, signed webhook
    verification, SSRF-safe configured endpoints and safe secret rotation.
  - Outbound jobs use provider idempotency keys, checkpoints, retries/backoff,
    dead letters and operator reconciliation. Missing configuration is not success.
  - Importers call canonical commands instead of writing tables directly.
  - Record money/currency/unit/timezone conversions and original source lineage.
  - **Acceptance:** fake-provider contract tests for timeout-after-success,
    duplicate/out-of-order webhook, rate limits, partial batch, schema change and
    cross-tenant external-ID collision; live sandbox checks only after keys.

### 20. Dependency/lint debt and final release gates

- [ ] Triage remaining dependency findings and repair repository-wide lint.
  - Upgrade vulnerable packages with compatibility/native-model regression
    checks; do not use indiscriminate `npm audit fix --force`.
  - Replace legacy `any` with model/DTO/aggregation types, fix render purity and
    unused/dead code without weakening lint rules to claim success.
  - Upgrade/pin supported GitHub Actions runtimes; remove advisory lint
    `continue-on-error` only once lint actually passes.
  - Require typecheck, unit/component/fault tests, classifier/runtime tests,
    build, lint and relevant acceptance checks before release.
  - **Acceptance:** clean required checks on the final commit and an evidence-based
    release checklist. No deployment, live integration or restore certification
    is inferred from a successful compile.

## Suggested dependency order

1. Reconciliation + outbox/projection correctness + complete authorization.
2. Allocation/partial cancellation + carrier/return settlement + exceptions.
3. Monetary consistency + demand coverage/forecast certification.
4. AI erasure/evaluation + long-lived execution/retrieval.
5. Deployment/index tooling + observability + backup/restore + load/browser tests.
6. ERP/WMS/accounting adapters and their live sandbox acceptance.

Update this file after each verified slice. Record the commit/check evidence;
do not check off runtime-dependent items merely because an API stub exists.
