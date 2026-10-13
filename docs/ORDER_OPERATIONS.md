# Canonical creation, dispatch and authorized returns

The shared `persistCanonicalOrder` boundary validates tenant-owned SKU references
and integer money snapshots before inserting an order, creation event and outbox
event under one session. Web pricing/promotions, Gmail ingestion and reviewed
draft confirmation all use it. Missing/ambiguous catalog evidence remains a
draft/reconciliation failure, never an invented ₹50 price.

Open **Orders → Dispatch / authorized returns**:

1. Reserve stock for the canonical order in the product stock ledger.
2. Dispatch quantities with carrier and tracking reference. Stock fulfillment,
   derived order status, shipment and timeline share one transaction.
3. Record delivered state with operator delivery proof.
4. Request a return for fulfilled, not already-returned units.
5. A different admin/finance approver authorizes or rejects it. Outstanding
   authorized quantities hold return capacity and cannot overbook units.
6. Warehouse receipt records inspected quantities/disposition. Resalable units
   restock; damaged units enter quarantine. Partial receipts are supported.
7. The receipt posts an exact discounted credit **memo** in the transaction.
   It does not execute or claim an external payment refund.

Dispatch/receipt require both inventory and order write capabilities. Decisions
require `returns:approve`. The reusable operations also check actor capabilities,
not only the HTTP route. Actor/workspace/role are derived from authenticated
context, not request JSON.

Use one intent key for retryable creation/receipt commands. A changed payload
conflicts. State transitions use recorded proof and maker/checker controls.
Carrier automation, tax/fee settlement, notifications, refund adapters, partial
cancellation and quarantine disposition are detailed in `todo.md`.

Legacy name-only/unpriced orders require reconciliation; today's catalog price
cannot prove their original invoice. Unit/component tests and mocked transaction
tests exist. Live MongoDB rollback/concurrency and carrier/accounting acceptance
still require an approved test environment.
