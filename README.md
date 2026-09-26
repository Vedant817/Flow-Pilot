# Flow Pilot

Flow Pilot is a distribution management and sales-intelligence console for order operations, inventory planning, customer risk, and grounded operational analysis. It is designed around bounded queries and materialized read models rather than browser-side CRUD over entire collections.

## Product Advantages

- **Operations Copilot without paid inference APIs:** SmolLM2-360M-Instruct and MiniLM run locally through ONNX and Transformers.js inside the Vercel Node runtime.
- **Tool-grounded RAG:** semantic routing chooses deterministic MongoDB tools before generation. The model writes an answer over verified facts instead of inventing calculations.
- **Hybrid retrieval:** MongoDB Atlas Vector Search is preferred; bounded lexical plus cosine retrieval remains available for local MongoDB.
- **Incremental analytics:** a `daily_sales_rollup` read model reduces forecasting and trend reads from `O(raw orders)` to `O(days × active SKUs)`.
- **Sales intelligence:** Holt-Winters demand forecasting, EWMA anomaly detection, RFM account segmentation, ABC/XYZ concepts, EOQ, reorder-point and deadstock analysis.
- **Enterprise operations UI:** grouped navigation, dense order workflows, command palette, source-cited copilot, and a consistent dark operations-console theme.
- **Draft-first inbound email orders:** a classifier proposes intent, but only validated evidence creates or changes orders. Incomplete requests become confirmable drafts; amendments always go through human review.

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
          ├── Inbound email path ── classify intent ── parse evidence ──┬── validated order
          │        (subject + cleaned body)      (typed parser)          ├── confirmable draft
          │                                                             └── human review queue
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
| Million-order feeds | Index-backed server pagination; max 100 rows/request |
| Analytics fan-out | Materialized daily product rollups and bounded aggregation pipelines |
| Forecasting | Reads dense rollup series, never raw order documents |
| Semantic search | Persisted 384-dimensional memory collection with Atlas vector index |
| AI reliability | Typed tools compute facts; the small model only composes the response |
| Cold starts | Global model/embedding singleton and `/tmp` Hugging Face weight cache |
| Abuse protection | Clerk proxy protection plus token buckets on generation and writes |
| Maintenance | Idempotent, secret-protected rollup and knowledge backfill |

MongoDB remains the operational source of truth because orders are document-shaped and transactional access dominates. The analytical read model avoids introducing ClickHouse operational overhead at the current scale. A future CDC sink can mirror the same rollup events into ClickHouse without changing route contracts.

## Inbound Email Orders

The Gmail webhook (`/api/webhook/gmail`) classifies each message as `new_order`, `update_order`, `feedback`, or `other` using the subject plus quote/signature-stripped body, and logs per-mail scores for drift review. Classification is an intent hint only — **no order is created or changed on a label alone**:

- A new order is created only with explicit purchase wording, parseable product lines with usable names and quantities, and an explicit valid delivery date and time. Each Gmail message maps to one order via a `gmail:<messageId>` idempotency key.
- Clear purchase intent with missing details becomes an **inbound order draft** (`/email-drafts`) carrying the original message, placement timestamp, and editable product suggestions. A reviewer corrects the lines, enters the delivery slot, and confirms; confirmation validates again and atomically creates the order and resolves the draft.
- Amendments and cancellations are **never applied from email alone**. They become typed change proposals (`set_quantity`, `remove_product`, `reschedule`, `cancel_order`) in the **review queue** (`/email-reviews`), where a reviewer selects the pending order and applies a verified change. Order, review state, and rollup update together in one MongoDB transaction.
- New `Order` documents record `placedAt` separately from `requestedDeliveryDate`/`requestedDeliveryTime`, so a missing delivery slot is never silently stored as today at noon. The webhook tenant comes from `GMAIL_ORG_ID` (fails closed when unset); production also requires `GMAIL_WEBHOOK_SECRET`.

See `docs/EMAIL_ORDER_REVIEW.md` for the operating details.

## Local Models

Default models:

- Generator: `HuggingFaceTB/SmolLM2-360M-Instruct` (`q4`)
- Embeddings/router: `Xenova/all-MiniLM-L6-v2` (`q8`, 384 dimensions)
- Email intent classifier: SetFit-tuned MiniLM encoder (`q8` ONNX, committed under `lib/nlp/model/`) plus a logistic-regression head (`lib/nlp/model/head.json`)

No Gemini, OpenAI, or hosted LLM inference API is used. Generator and router weights are downloaded from Hugging Face and inference executes in-process through `onnxruntime-node`. The email classifier encoder is committed to the repo so the webhook does not depend on a weight download; a hosted decision model (Laya) was evaluated locally and rejected — it scored lower on the author-held comparison set and would have added a Python service for no accuracy gain.

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
npm install --force
```

Create `.env.local`:

```env
MONGO_URI=mongodb+srv://...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...
CLERK_SECRET_KEY=...
ADMIN_SECRET=replace-with-a-long-random-value

# Optional Gmail ingestion
GMAIL_ORG_ID=your-clerk-organization-id
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=...
GOOGLE_REFRESH_TOKEN=...
GMAIL_WEBHOOK_SECRET=...
```

Start the application:

```bash
npm run dev
```

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
npx tsc --noEmit
npm test
npm run build
```

`npm test` runs the Jest suites plus an 8-case classifier regression gate (`scripts/verify-email-classifier.ts`) against the real local encoder. The larger synthetic evaluation corpus used during development is intentionally not committed; evaluate future classifier changes against independently labeled, securely held mail.

## Known Limitations (Not Yet Built)

- **No automatic amendments or confirmations.** Every order change requires human review, and drafts require manual confirmation. On the retired synthetic set this meant high review volume by design; widen automation only with measured evidence from real labeled mail.
- **Confidence is uncalibrated.** The classifier's softmax scores have not been calibrated on production traffic — do not use them as automation thresholds without a validation study.
- **No production metrics yet.** Per-mail scores are logged, but there is no dashboard for harmful-write rate, review rate, or draft confirmation rate.
- **Transactions required.** Draft confirmation and reviewed amendments commit order, review, and rollup writes in one MongoDB transaction and fail closed on deployments without transaction support.
- **Weakest on casual Hinglish mail.** Short mixed-language messages (e.g. reschedules, praise mentioning past orders) are the largest residual error group; rate/freight inquiries adjacent to orders are the main false-new-order risk.
- **No sender-history signal.** The pipeline does not yet bias thin rescheduling mail toward a sender's pending order, and the review UI does not submit arbitrary order edits.

## Vercel Notes

`next.config.ts` externalizes Transformers.js and ONNX native packages so Vercel bundles the correct Linux runtime rather than parsing every platform binary. The copilot route allows a 60-second execution window and streams tokens immediately after retrieval. Provision sufficient function memory for the quantized 360M model; choose a smaller SmolLM2 checkpoint through `AI_GEN_MODEL` if the selected Vercel plan has tighter memory limits.
