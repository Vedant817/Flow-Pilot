# Flow Pilot

Flow Pilot is a distribution management and sales-intelligence console for order operations, inventory planning, customer risk, and grounded operational analysis. It is designed around bounded queries and materialized read models rather than browser-side CRUD over entire collections.

## Readiness

This is an actively developed application, not a production-certified release.
The eight-week implementation roadmap is incomplete. See
[delivery status](docs/DELIVERY_STATUS.md), [release gates](docs/RELEASE_CHECKLIST.md)
and [order processing prerequisites](docs/ORDER_PROCESSING.md) before deployment.
Unit tests and a successful build do not certify live authentication, database
transactions, Gmail, model-runtime limits, load behavior or backup recovery.

## Current Capabilities

- **Local Operations Copilot:** SmolLM2-360M-Instruct and MiniLM execute through ONNX and Transformers.js. Production hosting/resource limits still need certification.
- **Tool-assisted RAG:** semantic routing chooses deterministic MongoDB tools before generation. Citations and tools assist grounding; they do not guarantee factual answers.
- **Semantic retrieval:** MongoDB Atlas Vector Search is preferred; bounded lexical plus cosine fallback remains available for local MongoDB. This is not simultaneous hybrid fusion in every path.
- **Incremental analytics:** a `daily_sales_rollup` read model reduces forecasting and trend reads from `O(raw orders)` to `O(days × active SKUs)`.
- **Sales intelligence:** Holt-Winters demand forecasting, EWMA anomaly detection, RFM account segmentation, ABC/XYZ concepts, EOQ, reorder-point and deadstock analysis.
- **Operations UI:** grouped navigation, order workflows, accessible mobile navigation/command palette and a source-cited copilot.

## Architecture

```text
Gmail / Web / Operator
          │
          ▼
   Next.js Route Handlers ─── Clerk authentication + rate limits
          │
          ├── Transaction path ── MongoDB orders / inventory / feedback
          │                              │
          │                              ├── query-pattern indexes
          │                              └── incremental sales rollup
          │
          ├── Intelligence path ── Rollups ── Forecast / EWMA / RFM
          │
          └── Copilot path
                semantic intent router (MiniLM)
                         │
                  deterministic tools
                         │
            Atlas Vector Search + lexical fallback
                         │
              SmolLM2 q4 grounded generation
                         │
                   cited SSE response
```

### Scale Decisions

| Concern | Implementation |
|---|---|
| Order feeds | Server pagination; max 100 rows/request. Million-order performance is not load-certified |
| Analytics fan-out | Materialized daily product rollups and bounded aggregation pipelines |
| Forecasting | Reads dense rollup series, never raw order documents |
| Semantic search | Persisted 384-dimensional memory collection with Atlas vector index |
| AI grounding | Typed tools compute facts; model output still requires release-gating evaluation |
| Cold starts | Global model/embedding singleton and `/tmp` Hugging Face weight cache |
| Abuse protection | Clerk proxy protection plus token buckets on generation and writes |
| Maintenance | Idempotent, secret-protected rollup and knowledge backfill |

MongoDB remains the operational source of truth because orders are document-shaped and transactional access dominates. The analytical read model avoids introducing ClickHouse operational overhead at the current scale. A future CDC sink can mirror the same rollup events into ClickHouse without changing route contracts.

## Local Models

Default models:

- Generator: `HuggingFaceTB/SmolLM2-360M-Instruct` (`q4`)
- Embeddings/router: `Xenova/all-MiniLM-L6-v2` (`q8`, 384 dimensions)

No Gemini, OpenAI, or hosted LLM inference API is used. Model weights are downloaded from Hugging Face and inference executes in-process through `onnxruntime-node`.

Override models with:

```env
AI_GEN_MODEL=HuggingFaceTB/SmolLM2-360M-Instruct
AI_GEN_MAX_TOKENS=320
AI_EMBED_MODEL=Xenova/all-MiniLM-L6-v2
```

## Setup

```bash
git clone https://github.com/Vedant817/Flow-Pilot.git
cd Flow-Pilot
npm ci
```

Copy `.env.example` to `.env.local` and supply credentials locally. The following
shows the required configuration names, not usable credentials:

```env
MONGO_URI=mongodb+srv://...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...
CLERK_SECRET_KEY=...
DEFAULT_ORG_ID=org_...
ADMIN_SECRET=replace-with-a-long-random-value

# Optional Gmail ingestion
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=...
GOOGLE_REFRESH_TOKEN=...
GOOGLE_TOPIC_NAME=projects/your-project/topics/gmail-notifications
GMAIL_ORG_ID=org_...

# Authenticate Pub/Sub pushes with either a shared secret...
GMAIL_WEBHOOK_SECRET=replace-with-a-long-random-value

# ...or Google Pub/Sub OIDC (preferred for Google-hosted pushes)
GOOGLE_PUBSUB_AUDIENCE=https://your-app.example.com/api/webhook/gmail
GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL=pubsub-push@your-project.iam.gserviceaccount.com
```

Start the application:

```bash
npm run dev
```

### Existing data migration

Workspace-scoped releases require every tenant record to have an `orgId`.
Preview the migration first; no data is changed without `--apply`:

```bash
npm run data:migrate-workspace
npm run data:migrate-workspace -- --apply
```

For an older single-tenant deployment whose records use `orgId: "default"`,
explicitly name that source:

```bash
npm run data:migrate-workspace -- --from=default
npm run data:migrate-workspace -- --from=default --apply
```

Both forms migrate into `DEFAULT_ORG_ID`; use `--to=org_...` to override it.
The migration now requires an empty target workspace and transaction-capable
MongoDB. All ownership changes commit together or abort; occupied targets are
rejected rather than silently merging tenants. The atomic tool is limited to
10,000 source records including projections; larger tenants require a rehearsed
resumable migration.
Back up the database, pause tenant writes, and drain/reconcile all source outbox
events during migration. Rebuild rollups
and semantic memory for the target afterward; cached projections and integration
configuration are not automatically reassigned. Source semantic-memory and
rollup projections are removed in the same transaction rather than relabeled
with invalid deterministic IDs. The shared `global` knowledge corpus is reserved
and cannot be a migration source or target.

## Public Demo Warehouse

Flow Pilot can load the official UCI Online Retail dataset into an isolated
public-demo workspace:

- 541,909 real wholesale transaction lines
- 25,901 invoices/cancellation invoices
- 4,381 customer/dealer accounts
- 4,070 products
- CC BY 4.0, DOI `10.24432/C5BW33`

The importer downloads the official archive, streams the XLSX, persists raw
lineage facts, and materializes dealer, product, daily-sales, return, credit,
territory, and service-level views. It does not write into tenant order or
inventory collections.

```bash
npm run data:import:uci -- --reset
```

On npm versions that consume unknown flags, call the runner directly:

```bash
npx tsx scripts/import-uci-retail.ts --reset
```

For interrupted large imports, source-line writes can resume while all
materialized views are rebuilt from the complete workbook:

```bash
npx tsx scripts/import-uci-retail.ts --resume-lines=390000
```

Rebuild only the dealer/product/daily materialized views from the cached
workbook without rewriting raw source facts:

```bash
npx tsx scripts/import-uci-retail.ts --views-only
```

Open `/network` for dealer health, territory performance, credit exposure,
returns, product velocity, and exception queues. Original source fields are
kept distinct from deterministic demo enrichments such as credit and service
levels. See `docs/DMS_IMPLEMENTATION_PLAN.md` for the complete provider roadmap.

After connecting a database, build rollups and seed the DMS knowledge corpus:

```bash
curl -X POST http://localhost:3000/api/admin/backfill \
  -H "x-admin-secret: $ADMIN_SECRET"
```

For MongoDB Atlas, allow the app to create the `vec_idx` Vector Search index or create an equivalent 384-dimension cosine index on `semantic_memory.embedding`. Local MongoDB automatically uses the bounded fallback retriever.

## Verification

```bash
npm run verify
npm run lint
```

GitHub Actions runs typechecking, tests and the production build. Its build key
is synthetic and does not authenticate real users. Lint remains advisory while
repository-wide debt is unresolved; passing CI is not production certification.
See [contributing](CONTRIBUTING.md) for the full verification procedure.

## Vercel Notes

`next.config.ts` externalizes Transformers.js and ONNX native packages so Vercel bundles the correct Linux runtime rather than parsing every platform binary. The copilot route allows a 60-second execution window and streams tokens immediately after retrieval. Provision sufficient function memory for the quantized 360M model; choose a smaller SmolLM2 checkpoint through `AI_GEN_MODEL` if the selected Vercel plan has tighter memory limits.
