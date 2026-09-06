# Flow Pilot DMS Product and Implementation Plan

## Product Position

Flow Pilot is a multi-workspace distribution management system for manufacturers,
distributors, wholesalers, and dealer networks. It connects the transaction path
(orders, fulfillment, returns, payments, inventory) to the decision path
(exceptions, demand, credit risk, service levels, and next-best action).

The product is not a generic CRUD suite. Every workspace is organized around an
operator question: **what needs attention now, why, and what action is safe?**

## Users and Their Daily Jobs

| Persona | Daily decisions | Product capability |
|---|---|---|
| Sales operations | Which dealers stopped buying? Where is target attainment weak? | Account health, RFM, territory scorecards, target/actual variance |
| Order desk | Which orders are blocked, partial, late, or duplicated? | Exception queue, bulk allocation, status SLA, order timeline |
| Inventory planner | What will stock out? What is overstocked? | Forecast, reorder point, safety stock, ABC/XYZ, inter-warehouse transfer |
| Warehouse manager | What must ship today and where are picking bottlenecks? | Wave/pick/pack/dispatch board, inventory reservations, OTIF |
| Credit controller | Which accounts are over limit or overdue? | Credit exposure, aging buckets, holds, promises-to-pay, collection queue |
| Customer service | What happened to an order/return and what can I promise? | Unified account timeline, shipment/return status, case notes |
| Territory manager | Which region or route needs intervention? | Geographic performance, dealer coverage, beat/visit planning |
| Commercial manager | Which schemes and prices create incremental margin? | Promotion lift, elasticity, price waterfall, rebate accrual |
| Finance | Is revenue real, collected, and margin-positive? | Invoice/payment reconciliation, DSO, GMROI, return leakage |
| Compliance/admin | Who changed price, credit, stock, or status? | Immutable audit log, roles, approvals, data lineage |

## Capability Map

### Foundation

- Workspace isolation and source lineage
- Role-based permissions and approval policies
- Dealer, product, warehouse, supplier, territory, and price-list masters
- Audit events, idempotency keys, import jobs, and data-quality exceptions

### Transaction Operations

- Sales orders, allocations, backorders, split fulfillment, cancellation
- Pick/pack/dispatch, shipment milestones, proof of delivery, OTIF
- Returns/RMA, reason codes, inspection, disposition, credit note
- Inventory by warehouse/bin/batch, reservations, transfers, adjustments
- Invoices, payments, credit limits, aging, holds, and collection actions

### Commercial Operations

- Dealer hierarchy, territory ownership, routes/beats, activity timeline
- Targets, incentives, promotion/scheme eligibility, rebate accrual
- Contract and tier pricing, approval-based overrides, margin guardrails

### Intelligence

- Materialized sales/stock/service read models
- RFM account health, churn signals, demand anomaly detection
- Holt-Winters forecasting, ABC/XYZ, safety stock, EOQ, deadstock
- Channel-stuffing and return-abuse signals
- Tool-grounded local Copilot with cited operational facts

## Public Demo Warehouse

The first end-to-end data product uses the **UCI Online Retail** dataset:

- 541,909 real transaction lines
- Wholesale-heavy UK online retailer
- Invoices, cancellation invoices, products, quantities, timestamps, prices,
  customer IDs, and countries
- CC BY 4.0, DOI `10.24432/C5BW33`
- Official source: `https://archive.ics.uci.edu/static/public/352/online+retail.zip`

The importer writes only to namespaced `demo_uci_*` collections. It never mixes
public records with tenant operational collections. Source dates are shifted as
a block so the latest source date appears as yesterday while preserving weekday,
seasonal, cohort, and cancellation relationships. Original timestamps remain in
lineage fields.

## Shipped Vertical Slice

1. Stream the official XLSX without holding 541k rows in memory.
2. Convert invoices into order facts and cancellation invoices into return facts.
3. Materialize dealer account metrics, territory metrics, daily trends, product
   velocity, credit exposure, service levels, and exception flags.
4. Serve bounded, indexed APIs for overview KPIs and dealer pagination/filtering.
5. Provide a Dealer Network workspace for account health, credit, returns,
   territories, and service exceptions.
6. Expose public-demo facts to the local Copilot through typed tools.

## Delivery Sequence

### Phase 1: Public Demo + Dealer Network (implemented in this change)

- Streaming source importer and lineage
- Dealer/territory/credit/returns read models
- Network APIs, workspace UI, Copilot tool

### Phase 2: Fulfillment Control Tower

- Inventory reservation ledger
- Shipment milestones, SLA clock, pick/pack/dispatch exceptions
- OTIF and fill-rate drill-down with bulk intervention

### Phase 3: Finance and Returns

- Invoice/payment ledger, aging buckets, credit holds
- RMA workflow, inspection/disposition, credit-note reconciliation
- DSO, return leakage, and bad-debt risk

### Phase 4: Commercial Execution

- Targets, territory ownership, route/beat plans
- Pricing/scheme approvals, rebate accrual, promotion lift
- Dealer portal and field-sales offline workflows

### Phase 5: Platform Hardening

- Organization-scoped row security on every operational collection
- Redis/distributed rate limits and event queue
- CDC to ClickHouse for billion-row analytical history
- OpenTelemetry traces, SLOs, disaster recovery, retention controls

## Scale Boundaries

- Browser APIs are always paginated and project only required fields.
- Imports use streaming readers and unordered bulk writes.
- Dashboard reads use materialized collections, never raw transaction scans.
- Unique source keys make ingestion idempotent and resumable.
- MongoDB supports the transactional and current-state workload. At sustained
  billion-line history, the same normalized import events feed ClickHouse via
  CDC; UI/API contracts remain unchanged.
