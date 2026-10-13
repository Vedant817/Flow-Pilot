# Inventory stock commands

Stock balances are discrete, nonnegative whole units. `quantity` is physical
on-hand stock; `reservedQuantity` is owned allocation; available units are
`quantity - reservedQuantity`. Receipts/adjustments must not consume reservations.

## Operator workflow

Open **Inventory → Stock ledger** for an item. Record a receipt, signed adjustment,
reservation, release, fulfillment or return with a reason. Order-linked
movements require a canonical order-line product ID and both inventory and order
write permissions. History shows actor/order provenance and uses a timestamp +
ObjectId cursor, never an offset scan.

Every command requires an intent-bound `Idempotency-Key`. Its balance change,
allocation counters, immutable movement and any derived fulfillment timeline
event share one MongoDB transaction. A matching retry returns the existing
movement without changing stock again. Changed payloads conflict.

Fulfillment status derives from all order-line quantities. The ordinary order
status API cannot manually mark an order partial/fulfilled. Canceling an
unfulfilled order releases all reservations in the cancellation transaction.
Already fulfilled units require returns, not cancellation.

Legacy items receive a clearly labeled `legacy_snapshot` on their first audited
command. That snapshot does not reconstruct pre-ledger history. New catalog
items record their opening balance atomically. Metadata edits cannot mutate
stock, require an expected version, and increment that version. Existing-price
changes additionally require pricing permission. Stock or audited history
prevents destructive item deletion.

## Remaining operational scope

This is not a complete shipping/accounting system. Shipping documents, carriers,
return authorization/inspection, financial credits, partial cancellation,
automatic allocation, coupon reversal, scheduler certification and all ingestion
channels on shared canonical order commands remain separate work.

Older/email orders without canonical product IDs must be mapped/reconciled
before allocation; the service rejects ambiguous name-only fulfillment.
Integration-level tests must exercise real MongoDB rollback, simultaneous order
cancellation/allocation and database correctness indexes on a disposable replica
set. Mocked transaction tests are not that certification.
