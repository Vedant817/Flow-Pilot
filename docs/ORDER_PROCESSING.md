# Transactional order processing

## Write contract

`POST /api/orders` requires `Idempotency-Key` (8–128 letters, digits, `.`, `_`,
`:` or `-`). Generate the key once per checkout intent and reuse it for retries.
Changing the intent requires a new key. A reused key with a different payload
returns `409`; a matching retry returns the original order.
Legacy keyed orders without a request fingerprint fail closed with `409`;
they are not assumed equivalent to a new checkout. Inspect the original order
and choose a new key only when the caller genuinely intends a new order.

Catalog prices are looked up only in the authenticated active organization.
Missing/ambiguous products or invalid prices return `409`; there is no invented
₹50 price. Each line stores product identity and integer minor-unit prices.

MongoDB must support transactions (replica set or Atlas). Order creation, coupon
redemption, redemption audit, and an `order.created` outbox event share one
transaction. An unsupported transaction returns `503`, never a non-atomic
fallback. A single-node replica set is suitable for local development.

## Worker operation

Schedule an authenticated `POST /api/admin/outbox/process` at least once per
minute, and monitor `outbox_events` queue age and failed events:

```bash
curl -X POST http://localhost:3000/api/admin/outbox/process \
  -H "x-admin-secret: $ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"limit":25}'
```

Secret-authenticated processing uses `DEFAULT_ORG_ID` explicitly. A signed-in
administrator processes their active Clerk organization. A multi-tenant
deployment must invoke processing for each organization; this endpoint does not
silently fan out across tenants. Scheduler provisioning is not performed by the
application and must be configured before deployment.

Workers atomically claim events with expiring leases and owner-fenced updates.
Rollup changes and consumer receipts commit together, making retries safe.
Customer signals recompute/upsert; semantic-memory chunks use deterministic IDs.
Failures back off and remain visible after ten attempts. An operator must inspect
the cause before resetting a failed event to pending. Event payloads contain
aggregate IDs rather than customer contact details.

## Existing deployment prerequisites

Database-index bootstrap now fails closed. Resolve duplicate data and index
option conflicts before release; do not weaken uniqueness to make startup pass.
The old `orders` compound sparse index `orgId_1_idempotencyKey_1` must be migrated
to a unique **partial** index with:

```json
{"partialFilterExpression":{"idempotencyKey":{"$type":"string"}}}
```

Take a backup and review duplicate `(orgId, idempotencyKey)` values before changing
an existing index in a maintenance window. The partial predicate lets legacy
orders without keys coexist. The application does not automatically drop indexes.

## Verification status and remaining scope

Unit/mocked-route tests can validate isolation, key conflicts, price snapshots,
leases, and retry behavior. They do not prove real MongoDB transaction rollback
or scheduler execution. Run fault-injection tests on a disposable replica set
before production, especially crashes between projection and event completion.

This outbox currently covers the authenticated order-creation API. Gmail order
ingestion, updates/deletions, rollup rebuild coordination, and inventory
reservation events still require migration to the same command/event model.
Do not treat the whole order lifecycle or the eight-week roadmap as complete.
