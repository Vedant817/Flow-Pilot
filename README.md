# Flow Pilot — AI Operations Copilot for Commerce Fulfillment

Flow Pilot is a Next.js operations dashboard for small-to-mid-market commerce teams that need a single control plane for orders, inventory, customer feedback, error triage, and AI-assisted operational decision making. The repository currently contains a working application shell with MongoDB-backed API routes, Clerk authentication pages, Gmail ingestion, analytics views, inventory forecasting/price-adjustment routes, and a LangChain/Gemini retrieval chatbot. This README documents the real implementation, the engineering gaps discovered during repo analysis, and the production-grade implementation plan needed to turn the project into a resume-quality, domain-aware system.

> **Resume positioning:** present this as an AI-assisted commerce operations platform, not a generic dashboard. The strongest narrative is: event-driven order ingestion, inventory risk analytics, retrieval-grounded operations copilot, measurable evaluation harnesses, and production controls for multi-tenant commerce data.

## 1. What exists today

### Product surface

| Area | Current implementation | Production intent |
| --- | --- | --- |
| Landing and authentication | Next.js App Router landing page plus Clerk sign-in/sign-up routes. | Replace unverifiable marketing claims with measured product metrics and enforce tenant-aware access control across all protected routes. |
| Orders | API route reads and updates MongoDB orders; dashboard supports order status changes and search-oriented operations. | Add order lifecycle state machine, stock reservation, idempotent ingestion, SLA tracking, and audit trails. |
| Inventory | CRUD-style inventory API, inventory dashboard, forecasting, dynamic pricing, and deadstock pages. | Add SKU/location modeling, reorder-point math, supplier lead times, backorder handling, inventory ledger, and explainable recommendations. |
| Analytics | Customer/product/overview analytics routes aggregate order and inventory data. | Move heavy analytics into typed service modules, materialized views, scheduled jobs, and quality checks. |
| Feedback and errors | Feedback and error APIs with validation, search/filter utilities, and dashboard pages. | Add sentiment confidence, taxonomy, alert routing, source correlation, PII retention controls, and incident workflow. |
| Gmail ingestion | Google OAuth/watch/webhook routes classify inbound email and extract order/feedback details with Gemini helpers. | Add Pub/Sub signature validation, replay protection, idempotency keys, attachment parsing pipeline, and dead-letter queues. |
| Chatbot | LangChain retrieval chain loads attachments plus MongoDB orders, inventory, errors, and feedback into an in-memory vector store. | Replace per-process memory retrieval with persistent tenant-scoped RAG, tool calling for live data, citations, authorization filters, and evaluation gates. |

### Technology snapshot

- **Frontend:** Next.js 15 App Router, React 18, Tailwind CSS, Recharts/Chart.js, MUI Data Grid, table libraries, Clerk auth.
- **Backend:** Next.js route handlers, Mongoose/MongoDB, Google APIs/PubSub/Gmail integrations, LangChain, Gemini, OpenAI package dependency available.
- **Testing:** Jest and React Testing Library are configured, with tests for API utility clients and Gmail webhook behavior.
- **Current persistence model:** MongoDB collections for orders, inventory, feedback, errors, conversations, and related analytics reads.

## 2. Domain model the project should demonstrate

A production commerce operations project should show that the engineer understands fulfillment, inventory economics, and operational reliability.

### Core domain objects

1. **Tenant / organization**
   - `tenantId`, plan, regions, feature flags, data retention policy.
   - Every order, SKU, conversation, and event must be tenant scoped.
2. **Sales channel**
   - Shopify, Amazon, manual email, POS, marketplace, or CSV import.
   - Each channel needs external IDs, webhook signatures, rate limits, and retry semantics.
3. **Customer**
   - Contact details, consent flags, locale, lifetime value, risk flags, communication preferences.
4. **Order**
   - Immutable order number, channel ID, customer reference, line items, payment status, fulfillment status, cancellation/refund status, shipment tracking, promised delivery date.
5. **Order line item**
   - SKU, quantity ordered, quantity fulfilled, quantity returned, unit price, discounts, tax, warehouse allocation.
6. **SKU / product**
   - SKU code, barcode, category, supplier, cost, sell price, dimensions, shelf life, substitutions, bundle/BOM relation.
7. **Inventory ledger**
   - Stock is not just a `quantity`; it is a ledger of receipts, reservations, picks, adjustments, returns, damaged goods, and cycle counts.
8. **Warehouse/location**
   - Fulfillment nodes, bin locations, lead times, replenishment calendars, capacity constraints.
9. **Supplier and purchase order**
   - MOQ, lead-time distribution, fill rate, cost breaks, purchase order status.
10. **Operational event**
    - Normalized event stream for `order.created`, `inventory.reserved`, `shipment.delayed`, `feedback.received`, `error.detected`, and `ai.recommendation.accepted`.
11. **Recommendation**
    - Forecast, reorder, deadstock, price adjustment, or support response with model version, input snapshot, explanation, confidence, and approval state.

### Critical workflows to support

- Email/order ingestion -> classification -> extraction -> validation -> human review queue -> idempotent order creation.
- Order creation -> inventory reservation -> fulfillment status transition -> customer tracking link -> exception detection.
- SKU monitoring -> demand forecast -> reorder point/safety stock -> purchase order recommendation -> buyer approval.
- Slow-moving stock detection -> margin-aware markdown recommendation -> approval -> price update -> result tracking.
- Customer feedback ingestion -> sentiment/category extraction -> escalation -> trend analytics.
- Chatbot question -> auth check -> live tool call or RAG retrieval -> cited answer -> audit log -> feedback/evaluation.

## 3. Issues, flaws, and missing production concerns

### Architecture gaps

| Finding | Why it matters | Remediation |
| --- | --- | --- |
| Route handlers contain business logic directly. | Forecasting, pricing, analytics, and ingestion logic become hard to test and reuse when embedded in API files. | Introduce `services/`, `repositories/`, `domain/`, and `jobs/` layers. Keep route handlers thin and typed. |
| No tenant isolation model is visible. | A resume-grade SaaS project must prove every query is scoped and access-controlled. | Add `tenantId` to schemas, compound indexes, middleware helpers, authorization checks, and tenant-scoped tests. |
| Data models are too thin for commerce. | `Order.products.name` makes matching ambiguous and prevents SKU-level analytics. | Normalize customers, SKUs, order line items, inventory ledger entries, and channel references. |
| Analytics query the full collections at request time. | This does not scale and can create slow dashboards. | Add scheduled aggregation jobs, materialized KPI collections, date windows, pagination, indexes, and cache invalidation. |
| Environment variable access is scattered. | Missing variables fail at import time or in unexpected routes. | Add a single validated config module using a schema validator and separate server/client config. |
| API response contracts vary. | Frontend code becomes fragile and error handling is inconsistent. | Define shared response envelopes, Zod schemas, typed clients, and central error mapping. |
| Some frontend calls depend on `NEXT_PUBLIC_API_URL` for same-app APIs. | Misconfiguration breaks local/prod deployments and leaks implementation details to clients. | Use relative `/api/...` paths for same-origin calls and reserve public base URLs for external services only. |
| Localhost and fake enterprise claims appear in user-facing or test paths. | Hardcoded URLs break deployments; unverifiable claims look like resume padding. | Replace with environment-derived URLs, measured metrics, or clearly labeled demo targets. |

### AI/ML gaps

| Finding | Why it matters | Remediation |
| --- | --- | --- |
| Chatbot uses an in-memory vector store initialized from the whole database. | Data can become stale, memory grows with data size, and multi-tenant isolation is unsafe. | Use persistent vector storage with tenant filters, incremental indexing, and document-level ACL metadata. |
| Retrieval documents stringify whole MongoDB records. | This may leak PII, wastes context, and hurts retrieval precision. | Build curated knowledge documents with redaction, normalized fields, and source IDs. |
| The assistant does not have a tool/action layer. | Operational questions often require fresh counts, filtered orders, or workflow actions. | Add tool calling for `getOrder`, `searchInventory`, `computeReorderPoint`, `createDraftPO`, and `summarizeFeedback`. |
| No model evaluation harness. | AI quality cannot be defended in interviews or production. | Add golden datasets, extraction accuracy, groundedness, refusal, latency, and cost metrics in CI. |
| No prompt/version governance. | Changes are hard to reproduce or roll back. | Store prompt versions, model versions, eval results, and deployment approvals. |
| Fine-tuning is not yet justified by data. | Fine-tuning without labeled domain data can reduce quality and look like AI slop. | Start with RAG + tools. Fine-tune only extraction/classification adapters once labeled examples exist. |

### Inventory and operations edge cases

- Partial fulfillments, split shipments, returns, exchanges, damaged inventory, cancelled orders, payment failures, and fraud holds.
- Bundles/kits where one customer-facing product consumes multiple component SKUs.
- Multi-warehouse allocation, transfer orders, stock in transit, and warehouse-specific reorder points.
- Supplier lead-time variance, minimum order quantities, case-pack rounding, supplier holidays, and stockout penalty costs.
- Perishable or lot-controlled inventory with expiration dates and recall workflows.
- Overselling caused by concurrent orders and non-atomic stock decrements.
- Negative inventory, cycle-count adjustments, and reconciliation with external channels.
- Product aliases in email ingestion; matching by product name is insufficient.
- Price recommendations that ignore margin floor, MAP policies, competitor price freshness, promotion calendars, and elasticity uncertainty.
- Demand forecasting anomalies: promotions, holidays, launches, discontinuations, out-of-stock periods, and sparse demand.

### Security, privacy, and reliability gaps

- Add authentication/authorization checks to every protected API route, not only UI routes.
- Validate all request bodies and query params with schemas; reject unknown fields for write routes.
- Add CSRF considerations for browser-originating mutations and webhook signature verification for machine-originating calls.
- Add rate limiting and abuse detection on chatbot, ingestion, feedback, and write APIs.
- Redact PII before logging, embedding, model prompts, and analytics exports.
- Encrypt sensitive OAuth tokens and rotate credentials.
- Store webhook processing state and idempotency keys to prevent duplicate orders.
- Add structured logs, traces, metrics, SLO dashboards, and alerting.
- Add backup/restore, migration scripts, seed data, and disaster-recovery runbooks.

## 4. Repo-specific audit notes

These are concrete issues found in the current implementation that should be fixed before presenting the app as production-ready:

1. **Free-form order statuses:** the order schema stores status as an unconstrained string, while UI and analytics expect specific lifecycle labels. Create a shared enum and migrate existing values.
2. **Name-based product matching:** order products store names rather than canonical SKUs, which makes forecasting, revenue attribution, returns, aliases, and bundles unreliable.
3. **Inventory validation rejects valid zero values:** shallow truthiness checks can reject `quantity: 0`, `price: 0`, or `stock_alert_level: 0`. Use schema validation with explicit numeric bounds.
4. **Missing database connection calls in some inventory handlers:** handlers should consistently initialize persistence before Mongoose operations.
5. **All-record reads:** several dashboards and analytics routes load full MongoDB collections, then filter or aggregate in memory. Add server-side pagination, date windows, indexes, and materialized analytics.
6. **Mock or estimated analytics:** revenue and top-spender calculations can be reconstructed from current inventory prices or constants rather than immutable order-time totals. Store order totals, currency, taxes, discounts, and line-item unit prices.
7. **Random pricing output:** dynamic pricing should be deterministic, auditable, and constrained by margin/approval rules; random adjustments are unsuitable for production.
8. **Public Gmail webhook without strong verification:** add Pub/Sub JWT/topic validation, replay protection, idempotency, stored Gmail history cursors, and failure retry behavior.
9. **LLM JSON is trusted too early:** model extraction output must be schema-validated, confidence-scored, repaired or reviewed, and only then persisted.
10. **Prompt-injection surface:** inbound emails and attachments are untrusted data. Prompts should isolate untrusted content and validators should reject instruction-following artifacts.
11. **PII in RAG:** raw orders, feedback, and errors can include personal data. Redact before embedding and use tenant-scoped tool calls for sensitive live records.
12. **In-memory vector store:** chatbot retrieval is stale, non-durable, not multi-instance safe, and not tenant-filtered. Move to persistent vector storage or Atlas Vector Search.
13. **Conversation retention:** chat history lacks tenant/user ownership, TTL, deletion/export controls, and max-length policy.
14. **Hardcoded environment assumptions:** localhost/public base URLs and direct public API env usage should be replaced with relative paths and validated config.
15. **Destructive operations need guardrails:** broad delete/update routes should require role checks, typed filters, confirmation workflows, audit logs, and rollback strategy.
16. **Tests need alignment:** webhook and API tests should be refreshed to match the current Gemini/Mongoose implementation and should include security, validation, idempotency, and failure-path cases.

## 5. Target production architecture

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ Next.js App Router UI                                                   │
│ Dashboard | Orders | Inventory | Analytics | Feedback | Errors | Copilot│
└───────────────┬─────────────────────────────────────────────────────────┘
                │ typed API client, auth token, tenant context
┌───────────────▼─────────────────────────────────────────────────────────┐
│ API Route Layer                                                         │
│ Thin handlers: auth, validation, idempotency, response envelope          │
└───────────────┬─────────────────────────────────────────────────────────┘
                │ calls domain services
┌───────────────▼─────────────────────────────────────────────────────────┐
│ Domain Services                                                         │
│ OrderService | InventoryService | ForecastService | PricingService      │
│ FeedbackService | IngestionService | CopilotService                     │
└───────┬───────────────┬───────────────────────────────┬────────────────┘
        │               │                               │
┌───────▼───────┐ ┌─────▼─────────────────┐ ┌──────────▼───────────────┐
│ Repositories  │ │ Event/Job Pipeline     │ │ AI Gateway               │
│ MongoDB       │ │ Pub/Sub or queue       │ │ API models + OSS models  │
│ indexes       │ │ idempotency + retries  │ │ RAG + tools + evals      │
└───────┬───────┘ └─────┬─────────────────┘ └──────────┬───────────────┘
        │               │                               │
┌───────▼───────────────▼───────────────────────────────▼────────────────┐
│ Data Stores                                                             │
│ MongoDB OLTP | Vector DB | Object storage for attachments | Metrics     │
└─────────────────────────────────────────────────────────────────────────┘
```

### Proposed folder structure

```text
flow-pilot/
  app/
    api/                         # thin route handlers only
    (app)/                       # authenticated application pages
  components/
    domain/                      # order, inventory, analytics components
    ui/                          # reusable primitives
  config/
    env.server.ts                # validated server env
    env.client.ts                # validated client env
  domain/
    orders/                      # schemas, state machine, value objects
    inventory/                   # SKU, ledger, reorder policy
    analytics/                   # KPI definitions
    ai/                          # prompts, tool contracts, eval schemas
  repositories/
    mongo/                       # query implementations and indexes
  services/
    order-service.ts
    inventory-service.ts
    forecast-service.ts
    pricing-service.ts
    ingestion-service.ts
    copilot-service.ts
  jobs/
    ingest-gmail-message.ts
    rebuild-analytics.ts
    refresh-vector-index.ts
  evals/
    datasets/
    rag-groundedness.test.ts
    extraction-quality.test.ts
  scripts/
    seed-demo-tenant.ts
    migrate.ts
```

## 6. Detailed implementation plan

### Phase 0 — Baseline cleanup and credibility

1. Replace unverifiable landing page claims such as Fortune 500 trust, fixed uptime, and fixed error-reduction percentages with measured demo metrics or remove them.
2. Update all same-origin frontend calls to relative `/api/...` paths.
3. Replace hardcoded localhost URLs with `APP_BASE_URL` from validated config.
4. Add `.env.example` with required variables and safe placeholders.
5. Add a `config/env.server.ts` and `config/env.client.ts` layer that validates variables at runtime startup.
6. Create seed data that is realistic but explicitly synthetic: tenants, customers, SKUs, suppliers, orders, inventory ledger events, and feedback.
7. Add repository-level scripts: `typecheck`, `lint`, `test`, `test:coverage`, `build`, `seed`, and `eval`.

### Phase 1 — Domain data model and API hardening

1. Add tenant-aware schemas:
   - `Tenant`, `UserMembership`, `Customer`, `Sku`, `InventoryLocation`, `InventoryLedgerEntry`, `Supplier`, `PurchaseOrder`, `Order`, `OrderLine`, `OperationalEvent`, `Recommendation`.
2. Add MongoDB indexes:
   - `{ tenantId, createdAt }` for time-window dashboards.
   - `{ tenantId, externalChannel, externalId }` unique for idempotent ingestion.
   - `{ tenantId, sku }` unique for SKUs.
   - `{ tenantId, status, promisedDeliveryDate }` for order operations.
   - text/search indexes for feedback and errors where appropriate.
3. Introduce Zod validation for every route body and query.
4. Create shared API response types:
   - success: `{ success: true, data, meta? }`
   - error: `{ success: false, error: { code, message, details?, traceId } }`
5. Implement order state machine:
   - `draft -> validated -> inventory_reserved -> fulfillment_pending -> fulfilled -> delivered`.
   - terminal states: `cancelled`, `refunded`, `failed`.
   - enforce legal transitions in the domain service.
6. Implement inventory ledger:
   - Never directly mutate stock without a ledger entry.
   - Compute available stock as `onHand - reserved - damaged - safetyStock`.
   - Use MongoDB transactions for order reservation and release.
7. Add audit logs for all write operations.

### Phase 2 — Event-driven ingestion

1. Normalize Gmail webhook handling:
   - Verify Pub/Sub message authenticity.
   - Decode message safely and reject malformed payloads.
   - Store raw event metadata and processing status.
2. Add idempotency:
   - Deduplicate by Gmail message ID, channel, and normalized external order ID.
3. Add extraction pipeline:
   - classify email type: order, feedback, support, supplier, unknown.
   - extract structured fields with schema-constrained model output.
   - validate extracted fields against SKU/customer/order rules.
   - route low-confidence records to a human review queue.
4. Add attachment handling:
   - store files in object storage.
   - parse CSV/PDF/text with typed parsers.
   - virus-scan and size-limit uploads.
5. Add dead-letter handling:
   - failed events should persist with retry count, error reason, and replay action.

### Phase 3 — Forecasting, replenishment, and pricing intelligence

1. Forecasting:
   - Start with transparent statistical baselines: moving average, exponential smoothing, seasonal naive.
   - Add backtesting by SKU/category with MAPE, WAPE, bias, and stockout-adjusted demand.
   - Forecast demand intervals, not only point estimates.
2. Reorder policy:
   - `reorderPoint = expectedDemandDuringLeadTime + safetyStock`.
   - `safetyStock = zScore(serviceLevel) * sqrt(leadTimeVariance * demandMean^2 + demandVariance * leadTimeMean)`.
   - Round recommended order quantity by MOQ/case pack and cash constraints.
3. Deadstock:
   - Combine days since last sale, sell-through rate, stock value, carrying cost, seasonality, margin, and forecasted demand.
   - Recommend actions: markdown, bundle, transfer, supplier return, liquidation, donation, or keep.
4. Dynamic pricing:
   - Enforce guardrails: margin floor, max daily price delta, MAP policy, active promotions, competitor data freshness.
   - Use approval workflow before writing price changes.
   - Track realized revenue/margin lift after recommendation acceptance.

### Phase 4 — AI copilot done properly

1. Build an `AiGateway` abstraction:
   - Supports API models for high-quality reasoning and open-weight models for private/offline workloads.
   - Records model name, prompt version, latency, token counts, cost, and safety outcome.
2. Use RAG only for knowledge retrieval:
   - Persist embeddings in a vector database or MongoDB Atlas Vector Search.
   - Chunk curated domain documents, not raw JSON dumps.
   - Attach tenant ID, source type, record ID, timestamps, and ACL metadata to each chunk.
3. Add live tools:
   - `get_order_status(orderId)`
   - `search_inventory(filters)`
   - `calculate_reorder_recommendation(sku)`
   - `summarize_feedback(window, sentiment)`
   - `explain_deadstock_risk(sku)`
4. Add answer requirements:
   - cite source records.
   - refuse unauthorized data.
   - ask clarifying questions for ambiguous SKUs/orders.
   - distinguish facts from recommendations.
   - never fabricate metrics or customer details.
5. Add AI evaluations:
   - groundedness: answer supported by retrieved/tool data.
   - retrieval precision/recall: correct source chunks are retrieved.
   - extraction accuracy: email-to-order field-level F1.
   - safety: PII leakage and cross-tenant access tests.
   - operations usefulness: recommendation accepted/rejected outcome tracking.

### Phase 5 — Open-source model strategy and fine-tuning

The project currently uses model APIs. That is the correct starting point because the core product risk is workflow quality, not training a generic chatbot. Fine-tuning should be introduced only where it has a measurable advantage.

#### Recommended model policy

1. **API default for production-quality reasoning:** use an API model for complex planning, user-facing explanations, and ambiguous operations questions.
2. **Open-weight model for private extraction/classification:** use a smaller instruct model for repetitive structured tasks once you have labeled examples.
3. **Do not fine-tune the general copilot first:** use RAG, tools, prompts, and evaluations before training.
4. **Fine-tune only narrow adapters:** order-email extraction, feedback taxonomy classification, SKU alias resolution, or routing intents.

#### Open-weight shortlist to evaluate

Model availability changes quickly, so pin the selected model and license at implementation time. As of this README update, the practical shortlist should be:

- **Qwen instruct/coder family:** strong multilingual and structured-output performance; good candidate for extraction/classification adapters.
- **Llama open-weight family:** strong ecosystem support and deployment tooling; evaluate license fit before commercial positioning.
- **Mistral/Mixtral family:** efficient inference options and mature serving ecosystem.
- **DeepSeek open-weight family:** strong reasoning/coding options, but validate license, hosting risk, and latency/cost for the target deployment.
- **Gemma family:** useful for lightweight private workloads; validate license terms and task quality.

#### Fine-tuning plan

1. Build labeled datasets:
   - `email_classification.jsonl`: email text -> category and confidence.
   - `order_extraction.jsonl`: email text -> structured order JSON.
   - `feedback_taxonomy.jsonl`: review -> sentiment, issue category, urgency.
   - `sku_alias.jsonl`: raw product mention -> canonical SKU.
2. Define acceptance thresholds before training:
   - extraction field F1 >= 0.95 for required fields.
   - invalid JSON rate < 0.5%.
   - hallucinated SKU rate < 1%.
   - p95 latency under product SLO.
3. Start with prompt + schema-constrained decoding baseline.
4. Fine-tune LoRA/QLoRA adapter only if the baseline misses target quality or cost.
5. Evaluate against holdout data and adversarial cases.
6. Version datasets, prompts, adapters, and eval reports.
7. Serve with vLLM/TGI/Ollama-compatible local path for demos and a hosted GPU path for production.
8. Keep a model fallback chain:
   - local fine-tuned extractor for routine structured work.
   - API model fallback for low-confidence or novel cases.
   - human review for high-risk mutations.

### Phase 6 — Observability and production readiness

1. Add structured logs with `traceId`, `tenantId`, route, model, and job ID.
2. Add OpenTelemetry traces for API routes, Mongo queries, model calls, and webhook jobs.
3. Add dashboards:
   - API latency/error rate.
   - ingestion backlog and dead-letter count.
   - forecast accuracy by category.
   - AI cost/latency/groundedness.
   - inventory stockout/deadstock value.
4. Add alerting:
   - Gmail webhook failures.
   - duplicate order spike.
   - model refusal or invalid JSON spike.
   - Mongo query latency and connection errors.
5. Add CI gates:
   - lint, typecheck, unit tests, integration tests, build, and AI eval smoke tests.
6. Add deployment artifacts:
   - Dockerfile, compose stack for local Mongo/vector DB, migration scripts, and seed scripts.

## 7. Concrete resume-grade milestones

### Milestone A — Production API foundation

- Tenant-scoped data model with indexes and migrations.
- Zod-validated routes and shared API response envelopes.
- Thin route handlers with tested domain services.
- Mongo transaction-backed inventory reservation.
- Audit log and idempotency table.

### Milestone B — Real commerce intelligence

- Demand forecasting with backtesting and confidence intervals.
- Reorder recommendations with service-level, lead-time, MOQ, and case-pack constraints.
- Deadstock scoring with carrying cost and action recommendations.
- Guardrailed dynamic pricing with approval workflow and outcome tracking.

### Milestone C — Reliable ingestion pipeline

- Gmail/PubSub ingestion with signature verification, retry, dead-letter queue, and replay UI.
- Schema-constrained extraction of orders and feedback.
- Human review queue for low-confidence AI output.
- Attachment parsing and storage pipeline.

### Milestone D — AI operations copilot

- Persistent vector index with tenant ACL filters.
- Tool-calling copilot for live operational answers.
- Cited, grounded responses with refusal behavior.
- Evaluation suite for extraction, retrieval, groundedness, safety, latency, and cost.
- Optional fine-tuned open-weight extractor after labeled data exists.

### Milestone E — Production polish

- CI/CD, Dockerized local stack, seeded demo tenant, observability dashboards, and runbooks.
- UI empty/loading/error states, optimistic updates, pagination, sorting, and accessibility checks.
- Security checklist: auth on APIs, rate limiting, webhook validation, PII redaction, secret management.

## 8. Engineering backlog by priority

| Priority | Item | Type | Interview value |
| --- | --- | --- | --- |
| P0 | Remove hardcoded URLs and fake metrics | Credibility | Shows production judgment. |
| P0 | Validate env and API inputs | Reliability/security | Prevents common runtime and injection issues. |
| P0 | Add tenant scope to every collection and query | Architecture | Demonstrates SaaS/domain maturity. |
| P0 | Add order/SKU/inventory-ledger models | Domain | Shows commerce knowledge beyond CRUD. |
| P1 | Service/repository refactor | Architecture | Shows maintainable code design. |
| P1 | Idempotent Gmail ingestion | Distributed systems | Shows webhook/event expertise. |
| P1 | Forecast backtesting | Data/ML | Shows measurable analytics quality. |
| P1 | Persistent RAG with citations and ACL filters | AI engineering | Shows safe, real AI implementation. |
| P2 | Fine-tuned extraction adapter | MLOps | Shows practical model training only where useful. |
| P2 | Observability and SLO dashboards | Production | Shows operational ownership. |
| P2 | Human review workflow | Product | Shows trust-and-safety thinking. |

## 9. What not to hardcode

- Do not hardcode model names inside business logic; load them from validated config and store the model version with each AI result.
- Do not hardcode localhost URLs; use relative URLs or `APP_BASE_URL`.
- Do not hardcode demo metrics like “95% reduction” unless generated from benchmark scripts and linked to reproducible data.
- Do not hardcode product names as SKU identifiers; use canonical SKU IDs and alias tables.
- Do not embed raw PII or full MongoDB documents; create redacted, purpose-built retrieval documents.
- Do not let AI directly mutate orders, inventory, or prices without tool-level authorization, validation, and audit logs.

## 10. Local development

```bash
cd flow-pilot
npm install
npm run dev
```

Create `flow-pilot/.env.local` with the required variables for the features you run locally:

```bash
MONGO_URI=mongodb://localhost:27017/store_db
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...
CLERK_SECRET_KEY=...
AI_PROVIDER=local
LOCAL_LLM_BASE_URL=http://localhost:11434/v1
LOCAL_LLM_MODEL=qwen3:8b
LOCAL_CLASSIFICATION_MODEL=qwen3:8b
LOCAL_EXTRACTION_MODEL=qwen3:8b
LOCAL_CHAT_MODEL=qwen3:8b
# Optional fallback if AI_PROVIDER=gemini:
GEMINI_API_KEY=...
GEMINI_CLASSIFICATION_MODEL=gemini-2.5-flash
GEMINI_EXTRACTION_MODEL=gemini-2.5-flash
GEMINI_CHAT_MODEL=gemini-2.5-flash
OPENAI_API_KEY=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/callback
GOOGLE_REFRESH_TOKEN=...
GOOGLE_TOPIC_NAME=...
GMAIL_WEBHOOK_TOKEN=replace-with-a-strong-shared-secret
APP_BASE_URL=http://localhost:3000
```


### Local open-source model mode

Flow Pilot now defaults to `AI_PROVIDER=local`, which calls an OpenAI-compatible local model server instead of a paid model API. For a resume demo, download Qwen3 8B through Ollama and run:

```bash
ollama pull qwen3:8b
ollama serve
cd flow-pilot
npm run ai:smoke
```

Fine-tuning guidance, JSONL dataset format, and a QLoRA/Axolotl template live in `flow-pilot/ml/fine-tuning/`. Fine-tune only the extraction/classification adapters after collecting reviewed labels and passing the evaluation gates documented there.

## 11. Verification commands

```bash
cd flow-pilot
npm run lint
npm run test
npm run build
```

The current repository may require dependency and environment cleanup before all commands pass. Treat failing checks as backlog items, not as reasons to skip automated verification.
