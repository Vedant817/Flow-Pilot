# Promotion & Loyalty Schemes — Implementation Plan (v3 Final)

> Feature request: targeted schemes (discount / free setup) for (a) customers ordering at regular intervals and (b) very old / loyal customers, plus at-risk regulars who show order stress (paused cadence). Retention & loyalty engine built on existing order history + RFM.
>
> **Status:** v3 Final — incorporates Round-2 verification (SRE/platform, product/data science)
> **Prior versions:** v1 Draft → v2 Revised (Round-1 fixes: Date types, transactions, `customer_signals`, RBAC, finance guardrails, holdout)
> **Changelog v2→v3:** see §15

---

## 1. Goal & Non-Goals

**Goals**
- Detect **4 exclusive cohorts** for operator clarity (names revised per Round-2):
  1. **Regular Cadence** — stable fortnightly/monthly buyers (median + MAD + CV, `freq≥4`).
  2. **Active Tenured** (renamed from Loyal Champions) — `tenure≥180d` + high lifetime value + `recency≤90d` (still active).
  3. **Slipping Regulars** — previously Regular but now overdue (`recency > frozenExpected × tolerance`) — the "order stress" cohort.
  4. **Dormant Tenured** (renamed from Lapsed Loyalists) — `tenure≥180d` + high value but `recency>90d` (distinct win-back incentive).

  *Naming rationale (Round-2 P0):* `Slipping ⊂ Regular` is now explicit as pre-vs-post state; `Active` vs `Dormant` Tenured eliminates `Loyal/Loyal` token collision. UI chips use distinct colors + tooltips explaining relationship (see §7).

- Let finance-gated managers define **Schemes** → benefit (`percent` / `fixed` / `free_setup`; `free_shipping` **removed** from v1 — no shipping cost field).
- Issue **per-customer crypto-random coupons** (or auto-apply via mode) inside a Mongo transaction; observe global & per-customer caps, expiry, idempotency, distributed lock.
- Report **incrementally** with holdout-scaled lift, 30-day attribution window, and guardrails for cannibalization.

**Non-Goals (v1)**
- Rebate accrual / wallet points / payment gateway settlement (we record `discountMinor`, not charge).
- Territory / dealer-hierarchy scoping (Phase 2, via `orgId` + `exclusiveGroup` extension point).
- Full ClickHouse CDC — same contracts; CDC can tail `customer_signals` later.

**Updated invariance:** New collections store `Date` + minor units (paise) + normalized keys (`emailNormalized`, `nameKey`). Legacy `Order.date:string`/`time:string` remain readable via `orderedAt:Date` (sparse, backfilled).

---

## 2. Current Codebase Fit — Where We Hook In

| Existing piece | Reuse / Required change (v3 delta in **bold**) |
|---|---|
| `models/Order.ts:8` (`email`, `date:string`, `time:string`) | Group by `emailNormalized`; **add `orderedAt:Date` (sparse), `products[].unitPrice + lineValueMinor + nameKey`, `pricing`, `appliedCoupon`, `idempotencyKey` (sparse unique), `orgId`, `setupFeeMinor?`**; add `lowercase+trim` setter and dual-write during backfill |
| `models/Inventory.ts:12` | **Add `nameKey: string` (lower-trim) + index; dual-write** |
| `lib/intelligence/rfm.ts:33,58` (live percentile, `Map<number,number>`, `$limit:50k`) | **Freeze thresholds** in `rfm_thresholds` collection; keep live RFM for display only; eligibility reads `customer_signals` (**new**) |
| `lib/analytics/rollup.ts:26,65,102` (`daily_sales_rollup`, `$merge` without `allowDiskUse`) | Reuse `$merge` pattern **with `allowDiskUse:true`, `batchSize`, `maxTimeMS`, and staging-rename** for `customer_signals` |
| `app/api/orders/route.ts:58` POST | **Wrap coupon redeem + order create + `counters.redeemed $inc` in `session.withTransaction`**; **derive email/clerkUserId from `auth()`**; enforce `idempotencyKey` dedup; snapshot `unitPrice` via `nameKey` lookup before pricing |
| `app/api/intelligence/segments/route.ts:6`, `app/api/customer-analytics/route.ts:28,37` | New routes `schemes/eligible`, `schemes/preview`, `admin/signals/rebuild`; **fix `customer-analytics` 100k `lean()` scan → aggregation + projection** |
| `lib/ai/tools.ts:1`, `lib/ai/copilot.ts:27,81,117,134,144` | Add `toolSchemeEligibility`, `toolCouponLookup`; **gate `toolCustomerProfile` when `intent===scheme_lookup`**, isolate exemplars, **cap `formatContext` to 600 chars/fact** |
| `lib/db-indexes.ts:14` | Expand to scheme/coupon/signals/audits/stats; **fix collation/partial mismatch**, **consolidate into single `await ensureQueryIndexes(db)`** |
| `lib/mongodb.ts:43` | **Change `void ensureQueryIndexes(db)` → `await ensureQueryIndexes(db)` before return; share global `__flowpilotIndexPromise` with timeout** |
| `components/AppShell.tsx:19,52,167` | Add `Commercial` group + palette entries **with server RBAC gate + `Topbar` matcher** |
| `lib/rate-limit.ts:1` (`Map<ip,Bucket>` in-process) | **Replace with Upstash Redis `Ratelimit.slidingWindow` before any promotion write; emit `Retry-After`/`X-RateLimit-Remaining`** |
| `proxy.ts:3` | Use `auth()` + `has({role:'org:finance'})` helper `requireRole()` (**server** gate; client hide alone is bypassable) |

**Backfill invariant:** Every new read tolerates missing `orderedAt`/`nameKey` via `orderedAt ?? parseIST(date,time)` until migration hits 100%.

---

## 3. Domain Model (Corrected — v3)

### 3.1 `models/PromotionScheme.ts`

```ts
import { Schema, Types } from 'mongoose';

type RfmSegment = 'Champions' | 'Loyal Accounts' | 'Promising' | 'Potential Loyalists' 
                | 'At Risk' | 'Hibernating' | 'Needs Attention';

interface IPromotionScheme {
  orgId: string;                      // tenant key — required even single-tenant today
  code: string;                       // LOYAL10 — uppercase, trim, collation strength:2, unique per org
  title: string;
  description: string;

  benefitType: 'percent' | 'fixed' | 'free_setup'; // free_shipping removed v3 — no shipping cost
  benefitValueMinor: number;          // paise — see storage rule below
  maxDiscountMinor?: number;          // cap for percent (e.g., 100000=₹1000) and optionally fixed
  currency: 'INR';                    // unified; UCI £ lineage kept in CustomerSignal.originalCurrency
  applicableProducts?: string[];      // nameKey scoped; empty = all
  applicableCategories?: string[];
  minimumOrderValueMinor?: number;    // gate before redeem — prevents ₹500 off ₹100
  setupFeeMinor?: number;             // required if benefitType='free_setup' — caps discount to actual fee

  mode: 'code' | 'auto' | 'both';    // code=coupon required, auto=atomic auto-apply, both=either path
  priority: number;                   // higher wins when multiple auto match; tie-breaker: validFrom asc, code asc
  stackable: boolean;                 // false = at most one appliedCoupon per order (enforced at Order.create)
  // allowOverlap removed v3 (Round-2 P0) — replaced by cap below + exclusiveGroup extension point
  maxSchemesPerCustomer: number;      // global policy, default 2, configured on issuance job — not per-scheme
  exclusiveGroup?: string;            // optional — schemes sharing group never overlap same customer (future territory)
  holdoutPercent: number;             // 0..15, default 10; 0 disables holdout for small N

  eligibility: {
    cohorts: ('regular' | 'active_tenured' | 'slipping' | 'dormant_tenured')[];
    operator: 'OR' | 'AND';           // default OR across cohorts
    minOrders: number;                // >=4 enforced in engine regardless of tune
    minTenureDays: number;            // e.g., 180
    maxRecencyDays: number;           // required — default 90 for Active Tenured; prevents lapsed subsidy
    excludeEstimated: boolean;        // default true — don't target priceEstimated customers for finance decisions
    cadence?: {
      preset: 'strict' | 'relaxed' | 'custom'; // UI hide raw 0.35 behind presets — see §4.2
      maxCv: number;                  // strict 0.35, relaxed 0.50 — only used when preset=custom
      maxMadRatio: number;            // strict 0.25, relaxed 0.35
      expectedIntervalDays?: number;  // null = frozen medianInterval
      toleranceMultiplier: number;    // 1.5 default for slipping
      medianIntervalMin: number;      // 7
      medianIntervalMax: number;      // 60 for Regular; Dormant uses separate dormantMax 120 — see §4.2
    };
    rfmSegments?: RfmSegment[];       // optional filter using frozen thresholds only
    minMonetaryUnits?: number;
    minMonetaryValueMinor?: number;
    monetaryMode: 'units' | 'value';  // default 'value'
  };

  limits: {
    maxRedemptionsGlobal?: number;    // null = must be set if benefitType is percent/fixed with estimatedLiability >₹10L (blocked otherwise — no 1e12 fallback)
    maxRedemptionsPerCustomer: number; // default 1 lifetime (partial unique on coupons covers it)
    validFrom: Date;
    validUntil: Date;
  };

  counters: {
    issued: number;                   // $inc atomically
    redeemed: number;
    holdout: number;
  };

  status: 'draft' | 'pending_approval' | 'active' | 'paused' | 'expired' | 'archived';
  version: number;                    // OCC for PATCH — findOneAndUpdate({ _id, version: clientVersion })

  createdBy: string;                  // Clerk userId
  createdByEmail: string;
  updatedBy?: string;
  approvedBy?: string;                // must differ from createdBy
  approvedAt?: Date;
  deactivatedAt?: Date;
  deactivationReason?: string;
  // timestamps: createdAt, updatedAt: Date
}
```

**Mongoose options:** `timestamps:true`, `code` setter `v=>v.toUpperCase().trim()`, `collation:{locale:'en',strength:2}` declared in both schema **and** in `ensureQueryIndexes` (must match or second deploy throws swallowed `already exists`), `validate: validFrom<validUntil`, percent stores **basis points** `100==1%` → zod `0..10000`; UI shows `0..100%` (divide by 100) but persistence stays `0..10000` (Round-2 fix for `benefitValueMinor` vs `zod 0..100` mismatch).

### 3.2 `models/Coupon.ts`

```ts
interface ICoupon {
  code: string;                       // crypto-random 12 chars base32 (~60 bits); retry on collision (up to 3)
  schemeId: Types.ObjectId;
  schemeCodeDenorm: string;
  orgId: string;
  email: string;                      // stored normalized: lowercase+trim
  emailNormalized: string;            // duplicate for index clarity (or make email the normalized value)
  clerkUserId?: string;               // bind to Clerk identity when available
  benefitSnapshot: { type: string; valueMinor: number; maxDiscountMinor?: number; setupFeeMinor?: number };
  status: 'issued' | 'redeemed' | 'expired' | 'revoked' | 'holdout';
  issuedAt: Date;
  expiresAt: Date;                    // min(scheme.validUntil, issuedAt+schemeDuration)
  redeemedAt?: Date;
  redeemedOrderId?: Types.ObjectId;
  revokedAt?: Date;
  revocationReason?: string;
  idempotencyKey?: string;
  // timestamps: createdAt, updatedAt
}
```

### 3.3 `models/CustomerSignal.ts` (materialized, the scale fix)

```ts
interface ICustomerSignal {
  orgId: string;
  email: string;                      // normalized (lower+trim) — uniqueness is {orgId,email}
  emailNormalized: string;            // canonical
  name: string;
  firstOrder: Date;                   // orderedAt min
  lastOrder: Date;                    // orderedAt max
  tenureDays: number;
  recencyDays: number;
  frequency: number;
  monetaryUnits: number;
  monetaryValueMinor: number;
  priceEstimated: boolean;            // true if fallback 50 path
  originalCurrency?: 'INR' | 'GBP';   // UCI lineage
  intervals: number[];                // distinct-date intervals (days)
  meanInterval: number;
  medianInterval: number;
  stddev: number;
  cv: number;
  mad: number;
  madRatio: number;
  maxInterval: number;
  p90Interval: number;                // for winsorization
  expectedInterval: number;           // frozen median (winsorized) — see §4.1
  expectedIntervalsExcludedLast: number; // median excluding last gap (for slip compare) — null if insufficient
  isRegular: boolean;                 // was Clockwork — includes both short + long tiers via flags below
  isRegularShort: boolean;            // median 7–60
  isRegularLong: boolean;             // median 75–120 (quarterly)
  isActiveTenured: boolean;           // was isTenured — tenure≥180 && recency≤90 && value≥threshold
  isSlipping: boolean;                // frozen — default tolerance 1.5; scheme override recomputes at match time
  isDormantTenured: boolean;          // was isLapsed
  seasonalityFlag: 'stable' | 'bursty' | 'seasonal' | 'insufficient';
  // RFM frozen:
  r: number; f: number; m: number;
  segment: RfmSegment;
  rfmThresholdVersion: string;        // points to rfm_thresholds doc
  insufficientData: boolean;          // freq<4
  updatedAt: Date;
}
```

### 3.4 `models/Order.ts` extensions

```ts
// Add (all optional/sparse until backfill 100%):
orderedAt: Date;                      // sparse index; derived UTC via IST parse
products: Array<{ name:string; nameKey:string; quantity:number; unitPrice?:number; lineValueMinor?:number }>;
pricing?: {
  originalMinor: number;
  discountMinor: number;
  finalMinor: number;
  setupFeeMinor?: number;             // for free_setup semantics
  currency: 'INR';
  priceSource: 'snapshot' | 'inventory' | 'estimated';
};
appliedCoupon?: {
  code: string;
  schemeId: Types.ObjectId;
  benefitType: string;
  discountMinor: number;
};
idempotencyKey?: string;              // sparse unique — client Idempotency-Key header
orgId?: string;
```

### 3.5 `models/PromotionAudit.ts`

```ts
interface IPromotionAudit {
  orgId: string;
  schemeId?: Types.ObjectId;
  couponId?: Types.ObjectId;
  actorClerkId: string;
  actorEmail: string;
  action: 'create' | 'update' | 'submit_for_approval' | 'approve' | 'activate' | 'pause' | 'expire' | 'archive' | 'issue_batch' | 'revoke' | 'redeem' | 'validate' | 'backfill';
  before?: unknown;
  after?: unknown;
  at: Date;
  ip?: string;
  requestId?: string;
  jobId?: string;
}
```

### 3.6 `models/SchemeDailyStat.ts`

```ts
interface ISchemeDailyStat {
  orgId: string;
  schemeId: Types.ObjectId;
  date: string;                       // YYYY-MM-DD — stat day
  issued: number;
  redeemed: number;
  holdoutEligible: number;
  holdoutOrders: number;              // within 30d window
  treatedOrders: number;              // within 30d window
  treatedN: number;
  holdoutN: number;
  discountCostMinor: number;
  revenueMinor: number;               // treated revenue (30d)
  scaledHoldoutRevenueMinor: number;  // holdoutRevenue * (treatedN/holdoutN)
  incrementalRevenueMinor: number;    // treatedRevenue - scaledHoldoutRevenue - discountCost
  reactivatedSlipping: number;
  _updatedAt: Date;
}
```

### 3.7 Migrations — new helper fields

- `Inventory.nameKey: string` (lower-trim of `name`), backfilled batched.
- `rfm_thresholds` collection: `{ version:string, at:Date, rCut:[...], fCut:[...], mCut:[...] }` — frozen quarterly.

---

## 4. Eligibility Engine — Corrected Math (Round-2 fixes applied)

### 4.1 Signals per customer — two paths

**Single-customer path (`GET /schemes/eligible?email=`) — indexed O(1):**
1. Normalize email (`lower+trim`), `findOne({orgId,emailNormalized})` on `customer_signals`. If miss (stale or pre-migration), fallback to bounded `orders.aggregate` for that email only:
   ```js
   db.orders.aggregate([
     { $match: { emailNormalized, status: {$ne:'canceled'} } },
     { $sort: { orderedAt: 1 } },
     { $group: { _id:'$emailNormalized', name:{$first:'$name'}, frequency:{$sum:1},
                firstOrder:{$min:'$orderedAt'}, lastOrder:{$max:'$orderedAt'},
                docs:{$push:{date:'$orderedAt', products:'$products'}} } }
   ], { maxTimeMS:8000, collation:{locale:'en',strength:2} })
   ```
   Then compute intervals in JS from **distinct `YYYY-MM-DD`** dates (collapse same-day orders). Never scans all customers.

**Bulk path (rebuild / issuance) — reads `customer_signals`, never raw orders:**

- **Nightly rebuild — staging-rename (P0 fix for Vercel 60s + race):**
  ```js
  // POST /api/admin/signals/rebuild — vercel config: maxDuration=300
  // Runs as Atlas-triggered $merge into customer_signals_staging, then atomic rename
  await db.orders.aggregate([
    { $match: { status: {$ne:'canceled'}, orderedAt: {$exists:true} } },
    { $sort: { emailNormalized:1, orderedAt:1 } },
    // Correct unwind path — fixes double $sum bug (R1 §3):
    { $unwind: '$products' },
    { $group: { _id:'$emailNormalized',
                name:{$first:'$name'},
                frequency:{$sum:1}, // count orders, not lines — so group by orderId first if unwind
                firstOrder:{$min:'$orderedAt'}, lastOrder:{$max:'$orderedAt'},
                monetaryUnits:{$sum:'$products.quantity'},
                monetaryValueMinor:{$sum: {$multiply:['$products.quantity', {$ifNull:['$products.unitPrice', 50}]} }} } },
    { $merge: { into:'customer_signals_staging', whenMatched:'replace', whenNotMatched:'insert' } }
  ], { allowDiskUse:true, maxTimeMS: 120000, cursor:{batchSize:2000} }).toArray();
  // After aggregate completes, atomic:
  await db.collection('customer_signals_staging').rename('customer_signals', {dropTarget:true});
  // Watermark: record rebuiltAt; incremental delta that landed during rebuild re-applies post-rename via updatedAt compare
  ```
  *Alternative for Atlas without rename privilege:* `$merge` into `customer_signals` with `whenMatched: [ {$set:{...}} ]` pipeline that keeps `max(updatedAt)`.

- **Incremental delta (`POST /api/orders` after `applyOrderDelta`):**
  Must fetch that email's dates (bounded few hundred) — cannot recompute from counters alone (Round-2 P0):
  ```js
  // inside transaction/session or after commit, for that email only:
  const docs = await db.orders.find({emailNormalized}, {projection:{orderedAt:1, products:1}})
                               .sort({orderedAt:1}).toArray(); // bounded per customer
  const signals = computeSignals(docs); // JS robust math below
  await db.customer_signals.updateOne({orgId,emailNormalized},
    { $set: {...signals, updatedAt:new Date()} }, {upsert:true});
  ```
  Serialize per-email with `findOneAndUpdate` optimistic `updatedAt` or per-email mutex (single-writer per email, concurrent orders for same email are rare).

**Robust math — corrected pseudo (Round-2 P0):**
```ts
type Regularity = { insufficient:boolean; cv:number; madRatio:number; median:number; mean:number; maxInterval:number; isRegular:boolean; seasonality:'stable'|'bursty'|'seasonal'|'insufficient' };

function regularity(distinctIntervals: number[]): Regularity {
  // distinctIntervals: differences between distinct YYYY-MM-DD dates, in days
  if (distinctIntervals.length < 3) return { insufficient:true, cv:Infinity, madRatio:Infinity, median:0, mean:0, maxInterval:0, isRegular:false, seasonality:'insufficient' };
  // 10% winsorization — replaces outlier fix for 30,30,60,30,30 case (checklist expects winsorized pass)
  const sorted = [...distinctIntervals].sort((a,b)=>a-b);
  const lo = sorted[Math.floor(sorted.length*0.10)], hi = sorted[Math.floor(sorted.length*0.90)];
  const winsorized = distinctIntervals.map(x=> Math.min(hi, Math.max(lo, x)));
  const mean = winsorized.reduce((a,b)=>a+b,0)/winsorized.length;
  if (mean === 0) return { insufficient:false, cv:Infinity, madRatio:Infinity, median:0, mean:0, maxInterval:Math.max(...distinctIntervals), isRegular:false, seasonality:'bursty' };
  const variance = winsorized.reduce((s,x)=>s+(x-mean)**2,0)/winsorized.length; // population for small n
  const cv = Math.sqrt(variance)/mean;
  // median robust for even n: average of two middles
  const mid = sorted.length/2;
  const median = sorted.length %2===1 ? sorted[Math.floor(mid)] : (sorted[mid-1]+sorted[mid])/2;
  const absDevs = winsorized.map(x=>Math.abs(x-median)).sort((a,b)=>a-b);
  const mad = absDevs.length%2===1 ? absDevs[Math.floor(mid)] : (absDevs[mid-1]+absDevs[mid])/2;
  const madRatio = median ? mad/median : Infinity;
  const maxInterval = Math.max(...distinctIntervals);
  const p90 = sorted[Math.floor(sorted.length*0.90)];

  const strict = cv < 0.35 && madRatio < 0.25 && maxInterval < 2.5*median;
  const relaxed = cv < 0.50 && madRatio < 0.35 && maxInterval < 3.5*median;
  // isRegular is decided by scheme preset at match time — store cv/madRatio/median, not boolean alone
  const isRegularStrict = strict && median>=7 && median<=60;
  const seasonality: Regularity['seasonality'] = median>=75 && median<=120 && cv<0.35 ? 'seasonal' : cv>0.6 ? 'bursty' : 'stable';

  return { insufficient:false, cv, madRatio, median, mean, maxInterval, isRegular:isRegularStrict, seasonality };
}
```
- Frequency `<4` → `insufficientData=true` (covers 4× same-day → `intervals.length=0`).
- Same-day collapsed first; mean-zero guard.
- **Frozen expectedInterval:** `expectedInterval = median` (winsorized) **excluding last gap if `distinctIntervals.length>=4`**, otherwise fallback `median` of all; need `minSupport 3` post-exclusion else fallback (fixes bias when last gap is shortest/longest with n=4).
- **Two tiers closed (Round-2 gap 61–74):** Regular is now `7–60` (short) + `75–120` (long) as separate booleans `isRegularShort` / `isRegularLong`; `long` is surfaced as `Active Tenured` quarterly variant or distinct cohort chip `Regular (Quarterly)` — no dead zone. Unified range `7–120` with `seasonalityFlag='seasonal'` also acceptable if UI prefers one chip.

### 4.2 Cohort predicates (frozen thresholds)

```
isRegularShort  = !insufficient && cv<thrCv && madRatio<thrMad && median 7–60  && maxInterval<thrMax*median   // thr from preset
isRegularLong   = !insufficient && cv<0.35 && madRatio<0.25 && median 75–120  // quarterly
isRegular       = isRegularShort || isRegularLong
isActiveTenured = tenureDays>=180 && recencyDays<=maxRecencyDays(90) && !isSlipping && (monetaryValueMinor>=threshold || segment in [Champions, Loyal]) && (!excludeEstimated || !priceEstimated)
isSlipping      = wasRegular (historical isRegular true) && recencyDays > expectedInterval_exclLast * toleranceMultiplier  // default 1.5; scheme override recomputed at match time
isDormantTenured= tenureDays>=180 && recencyDays>90 && monetaryValueMinor>=threshold && (!excludeEstimated || !priceEstimated)
```

- RFM uses **frozen** `rfm_thresholds` — cutpoints updated quarterly via script, not live percentiles. `r/f/m` quintile bug `Map<number,number>` with duplicate keys is fixed by using `value → score via sorted rank with `i/n*5` but deduplicated correctly (or storing thresholds).
- **Slipping signal vs scheme param (Round-2):** `CustomerSignal.isSlipping` is precomputed with default `tolerance=1.5`; at scheme match time, if scheme `toleranceMultiplier != 1.5`, recompute `recencyDays > expectedIntervalsExcludedLast * schemeTol` on the fly from stored `expectedIntervalsExcludedLast` + `recencyDays` — no DB rescan.

**Presets (UI hide raw 0.35):**
| Preset | cv | madRatio | max< |
|---|---|---|---|
| Strict | 0.35 | 0.25 | 2.5× median |
| Relaxed | 0.50 | 0.35 | 3.5× median |
| Custom | operator enters | | |

### 4.3 Monetary chain (fixes `50 vs 100`, double `$sum`, UCI variance)

Priority at order write:
1. `products[].unitPrice` snapshot — looked up via `nameKey` against `inventory` (`inventory.nameKey` exists post-migration).
2. Else `inventory` price via `nameKey` with `collation:{locale:'en',strength:2}` fallback.
3. Else `50` minor-paisa estimate, `priceEstimated=true`.

- Fix pipeline bug: never `{ $sum: {$sum:'$products.quantity'} }` without unwind; correct is `{ $unwind:'$products' }` then `{$group:{ monetaryUnits:{$sum:'$products.quantity'}}}`. Bulk rebuild does `unwind`.
- `Inventory.nameKey` migration: `db.inventory.updateMany({}, [{$set:{nameKey:{$toLower:{$trim:{input:'$name'}}}}}])` batched; `orders.products[].nameKey` backfilled similarly.
- `priceEstimated` surfaced as chip in preview + eligibility filter `excludeEstimated`.

### 4.4 Scheme matching

`GET /api/schemes/eligible?email=foo` → `findOne({orgId,emailNormalized})` on `customer_signals` → filter active schemes in memory (<100). If `eligible.eligibility.excludeEstimated && signal.priceEstimated` → skip. If scheme `toleranceMultiplier` overrides, recompute slipping check live. Response `{ matched:[{schemeId,code,benefitSnapshot}], signalsSummary }`.

Issuance job paginates `customer_signals.find({ $or:[{isRegular:true},{isActiveTenured:true}] })` with `batchSize:1000`, `maxTimeMS`, chunks 500.

---

## 5. API Design (Corrected — transaction, idempotency, attribution)

```
GET  /api/schemes                         // paginated (page,limit<=100), filter status/cohort, sort validUntil; RBAC read: auth()
POST /api/schemes                         // create — zod, sets draft, RBAC finance/admin, audit, rate 10/min
PATCH /api/schemes/[id]                   // update — If-Match / version OCC, 409 on stale, audit
POST /api/schemes/[id]/submit             // draft → pending_approval — actor logged
POST /api/schemes/[id]/approve            // pending_approval → active — actor != creator, RBAC finance/admin, fail if approvedBy==createdBy
POST /api/schemes/[id]/pause              // active → paused
GET  /api/schemes/eligible?email=...      // O(1) via customer_signals, 60/min per userId
POST /api/schemes/preview                 // dry-run — reads customer_signals, returns { matched, byCohort, estimatedLiabilityMinor, holdoutCount, priceEstimatedFiltered, powerWarning }
GET  /api/coupons?email=...&status=...&page=&limit= // paginated, codes masked unless finance, GDPR: ?mask=true default
GET  /api/coupons/[code]                  // single lookup for Copilot — auth, masked unless owner/finance
POST /api/coupons/validate                // { code, email, orderValueMinor } → { valid, discountMinor, reason } — Redis 30/min, constant-time 404, checks expiry+cap+window+minOrderValue
POST /api/admin/schemes/issue             // 202 {jobId,totalEligible,issued,holdout} — chunks 1k, distributed lock, consumes 202 pollable via GET /api/admin/schemes/issue/[jobId]
GET  /api/admin/schemes/issue/[jobId]     // job status (polling)
POST /api/admin/signals/rebuild           // manual/nightly rebuild — maxDuration 300, staging-rename, secret+RBAC, allowDiskUse, watermark
GET  /api/analytics/schemes               // per-scheme issued/redeemed/holdout, redemptionRate, incremental lift vs scaled holdout, reactivatedSlipping, ROI, powerWarning
POST /api/admin/signals/rebuild (cron 02:00) + POST /api/admin/schemes/expire (03:00) + nightly stats 04:00 — see §9
```

**Removed:** `POST /api/coupons/redeem` public oracle — redeem only inside `POST /api/orders` transaction.

**`POST /api/orders` — transactional pseudocode (P0 fixes merged):**
```ts
// headers: Idempotency-Key: <uuid>
const idempotencyKey = req.headers.get('idempotency-key') ?? null;
const session = auth(); // Clerk
const normalizedEmail = deriveEmail(session, body.email); // session email wins if present
const normalizedCode = body.couponCode?.toUpperCase().trim();
const now = new Date();

if (idempotencyKey) {
  const existing = await Order.findOne({ idempotencyKey });
  if (existing) return NextResponse.json({ order: existing, dedup:true }, {status:200});
}

// Compute orderValueMinor + setupFeeMinor BEFORE txn via inventory nameKey map (cached Map, not per-row lookup)
const { orderValueMinor, setupFeeMinor, priceSource, productsWithSnapshot } = await priceOrder(body.products);

const mongoSession = await mongoose.startSession();
let createdOrder: IOrder | null = null;

await mongoSession.withTransaction(async () => {
  let discountMinor = 0, applied: IOrder['appliedCoupon'] | undefined;

  if (normalizedCode) {
    // 1) atomic coupon redeem — re-checks window/cap via scheme, not just coupon
    const coupon = await Coupon.findOneAndUpdate(
      { code: normalizedCode, orgId, emailNormalized: normalizedEmail.toLowerCase(),
        status:'issued', expiresAt:{$gt: now} },
      { $set:{ status:'redeemed', redeemedAt: now } },
      { session:mongoSession, new:true }
    );
    if (!coupon) throw Object.assign(new Error('Invalid or expired coupon'), {status:409});
    if (coupon.clerkUserId && session.userId && coupon.clerkUserId !== session.userId)
      throw Object.assign(new Error('Coupon owner mismatch'), {status:403});

    const scheme = await PromotionScheme.findOneAndUpdate(
      { _id: coupon.schemeId, orgId, status:'active',
        'limits.validFrom':{$lte: now}, 'limits.validUntil':{$gte: now},
        // P0 fix: do NOT fallback to 1e12 — require cap for liable benefits
        ...(coupon.benefitSnapshot.type!=='free_setup' ? {} : {}),
        $expr: coupon.schemeId ? { $or:[
          { $eq:['$limits.maxRedemptionsGlobal', null] }, // only if not liable
          { $lt:['$counters.redeemed', '$limits.maxRedemptionsGlobal'] }
        ]} : {}
      },
      { $inc:{'counters.redeemed':1} },
      { session:mongoSession, new:true }
    );
    // Enforce cap explicitly if not in query:
    if (scheme?.limits.maxRedemptionsGlobal != null && scheme.counters.redeemed > scheme.limits.maxRedemptionsGlobal) {
      throw Object.assign(new Error('Global cap reached'), {status:409});
    }
    if (!scheme) throw Object.assign(new Error('Scheme window violated'), {status:409});

    // minOrderValue gate before discount (Round-2):
    if (scheme.minimumOrderValueMinor && orderValueMinor < scheme.minimumOrderValueMinor)
      throw Object.assign(new Error('Minimum order value not met'), {status:409});

    discountMinor = computeDiscount(scheme, orderValueMinor, setupFeeMinor); // respects maxDiscountMinor, minOrderValue, free_setup capping
    if (discountMinor > orderValueMinor) discountMinor = orderValueMinor; // never negative final

    coupon.redeemedOrderId = undefined as any; // set after order created
    await coupon.save({session:mongoSession}); // hold for Order._id below
    applied = { code: coupon.code, schemeId: coupon.schemeId, benefitType: scheme.benefitType, discountMinor };

  } else {
    // auto mode — holdout-aware (P0 attribution race fix):
    // fetch active auto schemes sorted by priority desc, validFrom asc, code asc
    const candidates = await PromotionScheme.find({ orgId, status:'active', mode:{$in:['auto','both']},
      'limits.validFrom':{$lte:now}, 'limits.validUntil':{$gte:now} })
      .sort({ priority:-1, 'limits.validFrom':1, code:1 }).lean();
    for (const s of candidates) {
      // skip if customer is holdout for this scheme
      const holdout = await Coupon.findOne({ orgId, emailNormalized: normalizedEmail.toLowerCase(), schemeId: s._id, status:'holdout' }).session(mongoSession);
      if (holdout) continue;
      // match signals (using stored expectedIntervalsExcludedLast + live tolerance if needed)
      if (!matchesSignals(signals, s.eligibility)) continue;
      if (s.minimumOrderValueMinor && orderValueMinor < s.minimumOrderValueMinor) continue;
      // atomically try to claim global cap with findOneAndUpdate $expr $lt
      const claimed = await PromotionScheme.findOneAndUpdate(
        { _id:s._id, $expr:{ $or:[{ $eq:['$limits.maxRedemptionsGlobal', null]}, { $lt:['$counters.redeemed', '$limits.maxRedemptionsGlobal']}] } },
        { $inc:{'counters.redeemed':1} }, { session:mongoSession, new:true });
      if (!claimed) continue; // cap raced
      discountMinor = computeDiscount(s, orderValueMinor, setupFeeMinor);
      applied = { code:`AUTO:${s.code}`, schemeId: s._id, benefitType: s.benefitType, discountMinor };
      break; // stackable:false → one auto at most
    }
  }

  const orderedAt = new Date(); // UTC; or parsed IST if legacy date supplied
  const [order] = await Order.create([{
    orgId,
    name: body.name, phone: body.phone, email: normalizedEmail.toLowerCase(), emailNormalized: normalizedEmail.toLowerCase(),
    date: orderedAt.toISOString().slice(0,10), time: orderedAt.toTimeString().slice(0,5),
    orderedAt, products: productsWithSnapshot,
    status:'pending fulfillment', orderLink:'',
    pricing:{ originalMinor: orderValueMinor, discountMinor, finalMinor: Math.max(0, orderValueMinor-discountMinor),
              setupFeeMinor, currency:'INR', priceSource },
    appliedCoupon: applied, idempotencyKey
  }], { session:mongoSession });
  createdOrder = order;

  // set redeemedOrderId after create (needs Order._id)
  if (normalizedCode && applied) {
    await Coupon.updateOne({ code: normalizedCode }, { $set:{ redeemedOrderId: order._id } }, { session:mongoSession });
  }

  // audit
  await PromotionAudit.create([{
    orgId, schemeId: applied?.schemeId, actorClerkId: session.userId ?? 'system',
    actorEmail: session.email ?? normalizedEmail,
    action:'redeem' as const, at: now, ip: req.headers.get('x-forwarded-for')
  }], { session:mongoSession });

  // incremental signal update for this email (bounded, not full scan) is done post-commit to avoid txn bloat
}, { readConcern:{level:'snapshot'}, writeConcern:{w:'majority'} });

// post-commit: bounded incremental signal refresh + audit for non-redeem path
if (createdOrder) {
  await refreshCustomerSignalForEmail(normalizedEmail, orgId); // bounded find+JS recompute
}

return NextResponse.json({ order: createdOrder }, {status:201});
```

- On `BulkWriteError` code 11000 for `idempotencyKey`, return existing `findOne({idempotencyKey})` 200.
- `computeDiscount` handles `free_setup: min(benefitValueMinor || setupFeeMinor, setupFeeMinor)` and `undefined` setupFee → 0 discount + 409 if `benefitType=free_setup` but no setupFee (v3 removes ambiguity).
- **Validation:** zod `benefitValueMinor` in basis points `0..10000` (UI percent `0..100` maps to `*100`); `fixed` stores paise directly.

**Auth helper (new `lib/auth.ts`):**
```ts
export async function requireRole(req: NextRequest, roles: string[]) {
  const { userId, sessionClaims } = await auth();
  if (!userId) throw 401;
  const userRole = (sessionClaims?.publicMetadata as any)?.role ?? sessionClaims?.orgRole;
  if (!roles.includes(userRole)) throw 403;
  const email = sessionClaims?.email as string | undefined;
  return { userId, email, role: userRole };
}
```
- Browser UI never sends `ADMIN_SECRET`; Cron header validated server-to-server via `crypto.timingSafeEqual`.

**Rate limits (Upstash Redis, before promotion launch):**
- `validate: 30/min per userId+IP`
- `preview: 5/min per userId` (expensive `customer_signals` scan)
- `eligible: 60/min per userId`
- `schemes POST/PATCH: 10/min per userId`
- `issue: distributed `SET NX EX 300` lock per `schemeId` + heartbeat + `jobId` polling; duplicate click returns 409 `job already running`

---

## 6. Persistence & Indexes

**New collections:** `promotion_schemes`, `coupons`, `customer_signals`, `customer_signals_staging`, `promotion_audits`, `scheme_daily_stats`, `scheme_issue_jobs`, `rfm_thresholds`

```js
// promotion_schemes — uniqueness is per-org
db.promotion_schemes.createIndex({ orgId:1, code:1 }, { unique:true, collation:{locale:'en', strength:2} })
db.promotion_schemes.createIndex({ status:1, 'limits.validFrom':1, 'limits.validUntil':1 })
db.promotion_schemes.createIndex({ orgId:1, status:1 })

// coupons — org-scoped partial unique
db.coupons.createIndex({ code: 1 }, { unique:true })
db.coupons.createIndex({ orgId:1, emailNormalized:1, status:1, expiresAt:1 })
db.coupons.createIndex({ orgId:1, schemeId:1, status:1 })
db.coupons.createIndex({ orgId:1, schemeId:1, redeemedAt:-1 })
db.coupons.createIndex({ orgId:1, emailNormalized:1, schemeId:1 },
  { unique:true, partialFilterExpression:{ status:{$in:['issued','redeemed','holdout']} } })
// for lift join + analytics
db.coupons.createIndex({ redeemedOrderId:1 }, { sparse:true })
// expiry sweep query
db.coupons.createIndex({ expiresAt:1 })
db.coupons.createIndex({ orgId:1, status:1 })

// customer_signals — org-scoped unique (P0 fix: was global email unique)
db.customer_signals.createIndex({ orgId:1, emailNormalized:1 }, { unique:true })
db.customer_signals.createIndex({ orgId:1, updatedAt:-1 })
// partial for cohort scans — boolean bitmaps are low-cardinality so partial wins:
db.customer_signals.createIndex({ medianInterval:1 }, { partialFilterExpression:{ isRegular:true } })
db.customer_signals.createIndex({ recencyDays:1 }, { partialFilterExpression:{ isSlipping:true } })
db.customer_signals.createIndex({ orgId:1, isActiveTenured:1 })
db.customer_signals.createIndex({ orgId:1, isDormantTenured:1 })
db.customer_signals.createIndex({ rfmThresholdVersion:1 })

// inventory nameKey
db.inventory.createIndex({ nameKey:1 }, { collation:{locale:'en', strength:2} })
db.inventory.createIndex({ category:1 })

// orders — sparse for pre-migration docs
db.orders.createIndex({ idempotencyKey:1 }, { unique:true, sparse:true })
db.orders.createIndex({ 'appliedCoupon.schemeId':1 }, { partialFilterExpression:{ 'appliedCoupon.schemeId':{$exists:true} } })
db.orders.createIndex({ orderedAt:-1 }, { sparse:true })
db.orders.createIndex({ orgId:1, emailNormalized:1, orderedAt:1 })
db.orders.createIndex({ emailNormalized:1, orderedAt:1 }) // per-customer recompute fetch

// promotion_audits — org-scoped
db.promotion_audits.createIndex({ orgId:1, schemeId:1, at:-1 })
db.promotion_audits.createIndex({ orgId:1, actorClerkId:1, at:-1 })

// scheme_daily_stats
db.scheme_daily_stats.createIndex({ orgId:1, schemeId:1, date:1 }, { unique:true })

// scheme_issue_jobs
db.scheme_issue_jobs.createIndex({ schemeId:1, status:1 })

// rfm_thresholds
db.rfm_thresholds.createIndex({ version:1 }, { unique:true })
```

- **Expiry:** App sweep `03:00 IST` `updateMany({expiresAt:{$lt:now}, status:'issued'}, {$set:{status:'expired'}})` — keep docs, never Mongo TTL delete.
- **Collation contract:** `promotion_schemes` unique + `inventory.nameKey` + `customer_signals` lookups all use `{locale:'en',strength:2}`; `ensureQueryIndexes` declares collation explicitly for `inventory.nameKey` — or use denormalized `nameKey` lower-trim to avoid per-query collation parameter (preferred).
- **Bootstrap:** Single `await ensureQueryIndexes(db)` on first `dbConnect()` gated by global `__flowpilotIndexPromise` + `Promise.all` + timeout; no `void`. `ensureRollupIndexes()` shares same promise.

**Migration plan — safe at 1M (SRE P0):**

Not a Vercel route. Provide `scripts/` batchers with `--dryRun --batch 2000 --sleep 50 --resume`:

1. `scripts/backfill-inventory-nameKey.ts` — `updateMany({}, [{$set:{nameKey:{$toLower:{$trim:{input:'$name'}}}}}])` batched 5k, `ordered:false`, `writeConcern: majority`, progress in `migration_progress`.
2. `scripts/backfill-orders-normalized.ts` — adds `emailNormalized` (`lower+trim`), `orderedAt` (parse `date+'T'+time` as IST `+05:30` or UTC `Z` — document choice; if legacy `time` is empty, use `T00:00:00Z` and flag `orderedAtEstimated=true`), `products[].nameKey`, `products[].unitPrice` snapshot (join to `inventory` by `nameKey` batched in driver, not `$lookup` per doc).
3. `scripts/backfill-orderedAt.ts` (sub-step of above) — `db.orders.updateMany({orderedAt:{$exists:false}}, [{$set:{orderedAt:{$dateFromString:{dateString:{$concat:['$date','T',{$ifNull:['$time','00:00']},':00+05:30']}}}}}])` — choose IST explicitly and document.
4. `rebuild customer_signals_staging` after 1–2; atomic rename `customer_signals_staging → customer_signals`.
5. No global unique index built before dedup — order: add `emailNormalized`, backfill, rebuild signals grouping by normalized, then optionally enforce `email` setter `lowercase+trim` on new writes. Inventory `nameKey` before signals.
6. **Rollback:** new code reads `orderedAt ?? parseIST(date,time)`; `emailNormalized ?? lower(email)`; dropping sparse index + `unset` fields is rollback path. Documented in runbook.

---

## 7. UI / UX

**IA (fixes `AppShell.tsx:19` missing `Commercial` + server bypass):**

Create group `Commercial` in `NAV_GROUPS` between `Intelligence` and `Supply Risk`:
```ts
{ group:'Commercial', items:[ {label:'Promotions', href:'/promotions', icon:<Ticket size={16}/>, badge:'NEW'} ] }
```
- Client `useUser().publicMetadata.role` hides nav chip for non-finance/non-admin.
- **Server gate** in `app/(app)/promotions/layout.tsx`: `await auth(); has({role:'org:finance'})` else redirect `/`; without this URL guess bypasses client hide (Round-2 P0).
- `Topbar` title matcher adds `Commercial` entries to `NAV_GROUPS.flatMap` sorted by `href.length desc` so `/promotions/[id]` still shows "Promotions".
- `CommandPalette` `PALETTE_ACTIONS` adds promotions entries but filters out unauthorized when `hideWhenUnauthorized` flag set.

**Promotions list — `app/(app)/promotions/page.tsx`:**
- Table columns: code, title, cohorts (chips Regular / Active Tenured / Slipping / Dormant Tenured — `Regular` short vs long flagged with tooltip), benefit (₹/%, Setup Waived), window, status badge (`draft`→`pending_approval`→`active`…), counters (`issued/redeemed/holdout`), priority, expiry countdown (IST, live).
- Controls: search by `code/title`, filter `status/cohort/benefitType`, sort, pagination (100), **CSV export** for finance (masked `a***@example.com` unless `finance` role, `orgId`-scoped).
- Create dialog: **commercial simple form** — title, benefit type/value, cohort checkboxes (`Regular`, `Active Tenured`, `Slipping`, `Dormant Tenured`), validity dates, per-customer limit, priority. Advanced collapsible: preset `Strict/Relaxed/Custom` (maps to `maxCv/maxMadRatio/max` — raw `0.35` hidden unless Custom), `toleranceMultiplier`, `holdout%`, `maxSchemesPerCustomer`, `minimumOrderValue`, `maxDiscount` (for percent), `setupFee` (for free_setup).
- **Dry-run button** → `POST /api/schemes/preview`:
  - Shows `X eligible (R Regular, AT Active Tenured, S Slipping, DT Dormant Tenured)`, breakdown `priceEstimatedFiltered = Y excluded`, `Estimated max liability = Σ effectiveDiscount`, `Holdout = H`.
  - **Guard:** if `estimatedLiability > ₹10L` and caller isn't `finance` → block modal "Requires finance approval".
  - Disclosure chip: "10% of eligible will be held as control — they won’t receive a code".
  - Handles `eligible==0` empty state, `estimatedLiability` overflow warning.
- Detail — `app/(app)/promotions/[id]/page.tsx`:
  - Status timeline (who created, who submitted, who approved — `approvedBy != createdBy` enforced), audit log (`promotion_audits`), coupon list paginated (search `email/code/status`, revoke single/bulk, copy masked code, resend/banner), expiry countdown, pause/archive actions with `If-Match` version 409 handling.
  - Bulk issue section: "Issue" button triggers `POST /api/admin/schemes/issue` `202` → poll `GET /api/admin/schemes/issue/[jobId]` progress bar (issued/holdout/failed, partial-failure list, resume), heartbeat; duplicate click while job running → 409 "Job already running for this scheme".
  - States: archived read-only banner, liability gate modal, holdout disclosure, `priceEstimated` warning chip, stale version 409, sweep-in-progress.

**Customer-centric:**
- `app/(app)/analytics/page.tsx:184` add `Promotions` tab:
  - Counters `issued / redeemed / redemptionRate / holdoutN / reactivatedSlipping`.
  - Charts: `incremental lift (treated vs scaled holdout)` bar, reactivation `treated vs holdout` line (30d window), ROI `incrementalRevenue/discountCost`, `estimatedRevenueRetained`. Data from `GET /api/analytics/schemes` (pre-aggregated `scheme_daily_stats`), synced to `timeRange` (30/90d). Empty state when no active scheme.
- `app/(app)/orders/page.tsx:27` `OrderCard` + `OrderDetailsModal:249`:
  - `Discount: -₹X (CODE)` badge (green) when `pricing.discountMinor>0`; suppressed (not `₹NaN`) when legacy `pricing` missing pre-migration.
  - Eligibility hint: "Eligible for LOYAL10" badge with copy button (shows when `eligible` without requiring coupon entry).
  - Order creation entry: coupon code input + validate button (calls `coupons/validate` debounced, shows `discountMinor` preview).
- `app/(app)/network/page.tsx` dealer drawer: eligibility chips (`Regular`, `Active Tenured`, etc.) with `isRegularShort` vs `isRegularLong` tooltip, `priceEstimated` flag.

**Reused components:** `Card`, `Badge`, `Button`, `Dialog`, `Input`, `Select` from `components/ui`; icons `Gift`, `Ticket`, `Clock`, `Award`, `TrendingUp`, `Shield`.

---

## 8. Analytics & Copilot

**Analytics — holdout-scaled, windowed (Round-2 P0 fixes):**

Definitions:
- `redemptionRate = redeemed / issued` (coupon effectiveness)
- `treatedN`, `holdoutN` = counts at issuance time (deterministic seed below)
- `reactivationRate_treated = # slipping/holdout-eligible with order where orderedAt ∈ [issuedAt, issuedAt+30d] / treatedN`
- `reactivationRate_holdout = same / holdoutN` — **not calendar day**, 30-day rolling window per customer.
- `treatedRevenue = sum(order.pricing.finalMinor + discountMinor)` for treated orders in window
- `holdoutRevenue = same for holdout`
- `scaledHoldoutRevenue = holdoutRevenue * (treatedN / holdoutN)` — **scales 10% holdout to treated population** (Round-2 fix: was unscaled, understated 10×)
- `incrementalRevenue = treatedRevenue - scaledHoldoutRevenue - discountCostMinor`
- `ROI = incrementalRevenue / discountCostMinor`
- Guardrail: `organicOrders_treated` = treated orders *without* `appliedCoupon`? For `mode:auto`, every treated order has `appliedCoupon`, so guardrail switches to `holdout order rate` vs `treated order rate` delta — documented; `eligibleOverserved` flag when holdout orders anyway.

`GET /api/analytics/schemes` aggregates precomputed `scheme_daily_stats` (nightly `04:00` upsert by `schemeId+date` over customer-scoped 30d window, incremental on `coupons.redeemedAt >= yesterday`; needs existing indexes). Falls back to live `coupons ↔ orders` join on `redeemedOrderId` only for today's partial day; that join requires `coupons.redeemedOrderId` index (added §6).

- **Holdout implementation (deterministic, stratified — Round-2):**
  ```
  holdout = ( hash(schemeId + ':' + emailNormalized) % 100 ) < holdoutPercent
  ```
  Stable across reruns, auditable. For small N (<100 eligible) show power warning: "10% of 42 eligible = 4 holdout — CI too wide, consider 0%". For `eligible>=200`, optionally stratify by `medianInterval` tertile + `tenureDays` bucket before random to avoid seasonal bias (sample uniformly per stratum). Record `holdoutN` at issuance; don't re-randomize on reissue.

- **Nightly stats job (04:00):** aggregates `coupons` + `orders` incremental (today + 30d lookback), `allowDiskUse:true`, `maxTimeMS:60000`, `cursor.batchSize:2000`.

**Copilot — collision-free (Round-2 P0):**

- New intent `scheme_lookup` with disjoint exemplars and threshold `0.55` (only this intent elevated; others stay `0.42`):
  ```ts
  scheme_lookup: [
    'eligible for loyalty discount','qualify for free setup','at-risk winback coupon',
    'my promotion code','scheme redemption rate','regular cadence customers',
    'slipping customers','dormant tenured','holdout lift','promotion ROI',
    'coupon by code CODE'
  ]
  // customer_lookup exemplars tightened to profile phrasing only:
  customer_lookup: ['order history for *','email of customer *','lookup account by email','orders placed by *']
  // dealer_network keeps territory phrasing
  ```
- **Router change:** replace single `bestScore>0.42` loop with per-intent thresholds:
  ```ts
  const THRESHOLDS: Record<Intent, number> = { scheme_lookup:0.55, customer_lookup:0.42, dealer_network:0.45, general:0.42, ... };
  // gate: if maxSim < THRESHOLDS[intent] skip that intent
  ```
  Evaluate ROC on seed set before merge.

- **Gate `toolCustomerProfile` injection (`lib/ai/copilot.ts:117`):** `if (intent==='scheme_lookup') skip customer_profile injection` even if regex `customer|dealer|account` matches; also suppress high-recall `hybridRetrieve` docs when `intent===scheme_lookup` (or restrict retriever to `scheme` knowledge docs tag).

- **Fact budget (Round-2):** `toolSchemeEligibility` returns `≤600 chars` summary + ≤1 small `facts` object; `lib/ai/copilot.ts:134` `formatContext` `JSON.stringify(...).slice(0,1400)` trimmed to `slice(0,600)` per fact (or truncate before stringify). Add `toolCouponLookup(code)` for single-code grounding — powers "show my coupon" without hallucinated code.

- **Citation + null handling:** System prompt addendum for `scheme_lookup`: must cite `[F1]` lift numbers; if `facts` empty → "No promotions found — check /promotions" (never fabricate code).

---

## 9. Batch / Cron

| Job | Trigger & `vercel.json` `maxDuration` | Logic | Idempotency & observability |
|-----|---|---|---|
| `rebuild customer_signals` | Cron `02:00 IST` → `POST /api/admin/signals/rebuild` — `maxDuration:300`, `memory:3008` | `$merge` into `customer_signals_staging` with `allowDiskUse:true, maxTimeMS:120k, cursor.batchSize:2000`, then atomic `rename` (or `whenMatched:max(updatedAt)`). Records `rebuiltAt` watermark; rebuild covers `orders` up to `now-5m`. | `whenMatched:replace` into staging; progress in `scheme_issue_jobs` with `jobId`; duplicate cron while job running → 409 via distributed lock (`SET NX EX 360` per `orgId:rebuild`). Atlas index build `background:true`. |
| `incremental signal refresh` | Post-`POST /api/orders` commit (outside txn) | Bounded `find({emailNormalized}).sort(orderedAt)` for **that email only** (few hundred docs) + JS `regularity()` + `updateOne({orgId,emailNormalized},{$set:{...}}, {upsert:true})`. | `findOneAndUpdate` optimistic `updatedAt`; per-email serialization via `findOne` (contention negligible). If rebuild in flight, incremental wins via `max(updatedAt)` rule post-rename. |
| `issue coupons` | `POST /api/admin/schemes/issue` — `maxDuration:300`, manual + finance button | `customer_signals.find({ $or: cohort filters })` paginated `batchSize:1000` → per-chunk `bulkWrite([{updateOne:{filter:{orgId,schemeId,emailNormalized}, update:{$setOnInsert:{code, status: holdout? 'holdout':'issued', benefitSnapshot, expiresAt, orgId}}, upsert:true}}], {ordered:false, batchSize:1000})` in 1k chunks; `$inc` `counters.{issued,holdout}` atomically via per-chunk count after success. | Partial unique `{orgId,emailNormalized,schemeId}` where `status∈{issued,redeemed,holdout}`; `code` collision retry up to 3; distributed lock `SET NX EX 300` per `schemeId`; returns `202 {jobId}` pollable via `GET /api/admin/schemes/issue/[jobId]`; heartbeat TTL extended on each chunk. On failure, job `status:failed` with `failedEmails` resumable. |
| `expire sweep` | Cron `03:00` `maxDuration:60` | `updateMany({expiresAt:{$lt:now}, status:'issued'}, {$set:{status:'expired'}})` | Keep docs; audit count; `promotion_audits` entry. |
| `holdout sampling` | Inside issue per eligible customer | `hash(schemeId:emailNormalized)%100 < holdoutPercent`; stratify by `medianInterval` tertile when `eligible>=200`. | Deterministic seed; stable reruns; recorded `holdoutN`. Power warning if `eligible<100`. |
| `scheme_daily_stats` | `04:00` `maxDuration:120` | Incremental: scan `coupons.redeemedAt >= yesterday OR updatedAt >= yesterday`, join to `orders` via `redeemedOrderId` (indexed), compute 30d-window per customer (`issuedAt .. issuedAt+30d`) with `allowDiskUse:true`. | Upsert by `{orgId,schemeId,date}`; backfills missing days on first run. |
| `price backfill` / `inventory nameKey` | Offline `scripts/` (see §6) — **not** a Route Handler | Batched 2–5k, `ordered:false`, `writeConcern:majority`, `sleep 50ms`. | Resumable `migration_progress`; run before first `signals` rebuild. |

All admin handlers: `requireRole(['admin','finance'])` + `x-admin-secret` for Cron (`timingSafeEqual`) + IP allowlist + `Audit` create.

---

## 10. Rollout Plan (Phased — v3)

**Phase 0 — Foundations (0.5 sprint) [gates Phases 1–3]**
- `lib/auth.ts` `requireRole`, `lib/rate-limit.ts → Upstash`, `lib/mongodb.ts` `await ensureQueryIndexes`, `lib/db-indexes.ts` fix collation/partial, `Inventory.nameKey` + `Order` extensions (`orderedAt(sparse), products[].nameKey+unitPrice, emailNormalized, idempotencyKey, orgId`).
- Scripts `backfill-inventory-nameKey`, `backfill-orders-normalized` (batched, resumable, `writeConcern:majority`); **dual-write** period: every `Order.create` writes both `email` and `emailNormalized`; reads tolerate missing via fallback.
- Gate: `npm run build` + `npx tsc --noEmit` + existing tests pass; `explain()` for `eligible?email=`, `coupons.code`, `coupons.emailNormalized+status` all `IXSCAN`; p95 budgets defined (see §13).
- *Deliverable:* No promotion UI yet; audit of backfill `progress` reaching 100%; `customer_signals_staging` dry-rebuild succeeds in `maxDuration:300`.

**Phase 1 — Cohort detection (1 sprint)**
- `lib/promotions/eligibility.ts` with winsorized `regularity()`, `isRegularShort/Long`, `isActiveTenured`, `isSlipping(frozen)`, `isDormantTenured`, `rfm_thresholds` freeze.
- Unit tests for interval math (§13 matrix including even-n median, 2-order, same-day, bursty, seasonal, outlier winsorized, frozen expected with n=4).
- Expose `GET /api/schemes/eligible` (reads `customer_signals` O(1)) + preview in analytics preview tab — **no writes**.

**Phase 2 — Schemes & Coupons CRUD (1 sprint)**
- Models + indexes (§6), `GET/POST/PATCH /api/schemes` (OCC+version), `submit/approve/pause`, `promotion_audits`, `GET /api/coupons` (+masked), `POST /api/schemes/preview` (liability guard, `priceEstimated` disclosure, holdout disclosure), RBAC gates.
- Promotions list + create (preset UI) + dry-run + detail/audit + coupon list + revoke.

**Phase 3 — Issuance & Redemption (1 sprint)**
- `202` issue job with deterministic stratified holdout, distributed lock, pollable `jobId`; `POST /api/coupons/validate` (Redis, constant-time 404); transactional `POST /api/orders` (auto vs code, holdout-aware, global cap, `computeDiscount`, `pricing`, `idempotencyKey`); incremental signal refresh.
- `GET /api/analytics/schemes` + promotions analytics tab (scaled lift, reactivation, ROI).

**Phase 4 — Hardening & Copilot (1 sprint)**
- Distributed rate limits live for all promotion paths, expiry sweep, GDPR `DELETE /api/customers/[email]` cascade (orders, coupons, signals, `promotion_audits` retention note 24mo, `a***@` masking in every export), notification stub (copy coupon + in-app banner — no fake email), stratified holdout disclosure.
- Copilot: `scheme_lookup` intent isolation (per-intent thresholds, gated `customer_profile`, 600-char budget, `toolCouponLookup`), ROC eval at 0.55 vs 0.42.
- E2E (see §13): concurrent redeem 409 + exactly-once `counters.redeemed`, lifetime cap re-issue after expiry allowed, holdout 10% ±2%, liability `₹10L` gate, `free_setup` capping.

Each phase deployable behind `status` (`draft→pending_approval→active`). Feature flag `flags.promotions` hides Commercial nav until Phase 2.

---

## 11. Risks & Mitigations (v3)

| Risk | Mitigation (v3 delta bold) |
|---|---|
| Clockwork false positives / bursty / even-n median / 2-order | `freq≥4`, distinct dates, **winsorized 10%**, **population stddev**, `cv && madRatio`, **`maxInterval` < thr×median**, **Strict/Relaxed preset**, **even-n median avg**, `median≥7` |
| Two-tier gap 61–74 excludes bi-monthly | **RegularLong 75–120** tier + `seasonalityFlag='seasonal'`; unified `7–120` or two chip variants |
| Frozen expected bias when last gap extreme + n=4 | **Require `minSupport 3` post-exclusion else fallback to full median**; store both `expectedInterval` + `expectedIntervalsExcludedLast` |
| Monetary proxy drift (quantity vs value) | **Snapshot `unitPrice` via `nameKey` + normalized `nameKey` index**, `priceEstimated` flag + `excludeEstimated` filter, **fix double `$sum` with unwind**, cap `fixed` |
| Coupon sharing / email spoof | **Bind `clerkUserId+emailNormalized`**, verify session at redeem, crypto-random code + retry, atomic txn with `expiresAt` + window + cap, constant-time validate 404 |
| Large scan O(50k)/Vercel 60s | **Staging-rename rebuild with `allowDiskUse`+`batchSize`+`maxDuration:300`**, single-doc eligible, chunked `bulkWrite` + `202` pollable |
| Rebuild vs incremental race | **`rename` atomic + watermark + `max(updatedAt)` post-merge** |
| Incremental loss (can't recompute from counters) | **Bounded per-email `find().sort(orderedAt)` for that email only** |
| Order migration 1M unsafe | **Offline batched scripts** (2–5k), `ordered:false`, resumable `migration_progress`, **sparse indexes until 100%**, **IST `+05:30` explicit**, **no global unique before dedup** |
| Global cap race / fallback 1e12 liability | **Require `maxRedemptionsGlobal` when estimatedLiability>₹10L**, **`$lt` + `findOneAndUpdate $inc` inside txn**, no 1e12 hidden limit |
| Secret leak to browser | **`ADMIN_SECRET` only for Cron `timingSafeEqual`**, UI uses `requireRole` server gate |
| Auto mode negates holdout | **Auto path checks `holdout` doc and skips that scheme**; same cap claim transaction |
| Cannibalization (subsidize would-have-ordered) | **Holdout-scaled `scaledHoldoutRevenue` + `incrementalRevenue` with 30d window**, guardrail `holdout rate` vs `treated rate` for auto |
| Small-N holdout variance | **Power warning `eligible<100`**, **stratified sampling per interval tertile** when `eligible≥200` |
| RFM percentile drift | **Frozen `rfm_thresholds` versioned quarterly** |
| Stackable confusion / allowOverlap misplaced | **Removed `allowOverlap`; replaced by `maxSchemesPerCustomer` global + `exclusiveGroup`**, `stackable:false` enforced as single `appliedCoupon` |
| `free_setup` ambiguous | **Define `setupFeeMinor` + capping rule**, remove `free_shipping` v1 |
| Collation/index drift swallowed | **Single `ensureQueryIndexes` with collation-matching declarations**, `catch` logs to pino not `()=>undefined` swallowed |
| GDPR leakage | **Mask `a***@` in every export/coupon list**, **erasure cascade** (`orders/coupons/signals` + RFM cache invalidation `global.__flowpilotRfmCache=null`), **24mo retention** doc |

---

## 12. Open Questions for Owner (Updated — v3 proposed answers as defaults)

1. Benefit templates — v3 default: `REGULAR5` 5% (basis points 500) capped ₹1000 + `LOYAL_FREE_SETUP` setup-waived capped `setupFeeMinor`.
2. Auto vs code — v3 default: `Active Tenured` → `auto` (high trust), `Regular/Slipping/Dormant Tenured` → `code` (trackable). `both` allowed but branch ordering: validate code first, fall back to highest-priority auto.
3. Validity windows — default 45d (covers `1.5×30` slipping).
4. Notification — v3: in-app banner + "Copy coupon" until outbound email provider chosen; never fake "emailed".
5. Finance approval — two-person `draft→pending_approval→active`, `approvedBy != createdBy`, gate `maxDiscount>₹10k` or `estimatedLiability>₹10L` requires `finance` role.
6. Currency — `INR` unified; `originalCurrency=GBP` retained in signals/lineage for UCI demo; conversion noted.
7. Holdout — default 10%, 0% allowed; deterministic `hash(schemeId:emailNormalized)%100`; disable reporting when `eligible<100`; stratify when `eligible≥200`.
8. Shipping — confirmed removed v1 (`free_shipping` out).

---

## 13. Verification Checklist (Expanded — v3 budgets)

**Build & index correctness**
- [ ] `npx tsc --noEmit` clean, `npm run build` passes, `flags.promotions` toggle hides Commercial nav until Phase 2
- [ ] `explain("executionStats")` for **every new query pattern** shows `IXSCAN` (not COLLSCAN):
  - `customer_signals.findOne({orgId,emailNormalized})` — eligible
  - `coupons.findOne({code})` — validate
  - `coupons.find({orgId,emailNormalized,status})` — coupon list
  - `coupons.find({redeemedOrderId})` — analytics join
  - `orders.find({emailNormalized}).sort({orderedAt:1})` — incremental refresh
  - `customer_signals` partial `isRegular/medianInterval`, `isSlipping/recencyDays`
  - `orders.orderedAt` + `inventory.nameKey`
- [ ] `ensureQueryIndexes` promise awaited; no `void`; error not swallowed (`pino.warn` if `createIndex` fails)
- [ ] `vercel.json` sets `functions["app/api/admin/signals/rebuild/route.ts"].maxDuration=300`, `issue=300`, `analytics/schemes=60`

**Unit — cadence math (§4.1)**
- [ ] `n=1` / `n=2` (intervals 0–1) → `insufficient:true`
- [ ] `intervals=[0,0]` (mean 0) → `cv:Infinity, isRegular:false` (div-by-zero guard)
- [ ] `[7,7,7,7]` → strict pass (`cv~0, mad~0`)
- [ ] Even-n median `[7,9]` → `(7+9)/2=8`, not `sorted[mid]`
- [ ] `[1,29,1,29,1]` bursty → `cv>0.6` fail; `seasonality='bursty'`
- [ ] `[30,30,60,30,30]` outlier winsorized pass (10% clip → `30,30,30,30,30`)
- [ ] Quarterly `[90,90,90,95]` → `isRegularLong=true, seasonal='seasonal'`
- [ ] `n=4` with `distinctIntervals=[30,30,60]` → `expectedIntervalsExcludedLast` has only 2 points → fallback to full median (minSupport 3 guard)
- [ ] `Strict` vs `Relaxed` threshold matrix: `70-day maxInterval` passes Relaxed (`<3.5*median`) but fails Strict

**Unit — monetary & tenured**
- [ ] Order with missing `inventory` price → `priceEstimated=true`, fallback 50, surfaced in preview exclusion count
- [ ] UCI names `"WHITE METAL LANTERN "` vs `"white metal lantern"` → same `nameKey`, same price (collation/normalize)
- [ ] At-risk frozen: `expected=30`, `recency=46` triggers `>1.5×`; advancing to `recency=90` while `mean` including gap stays 42 does NOT move threshold (circularity regression)

**Integration — pipeline & batch**
- [ ] Synthetic `mongodb-memory-server` 100k orders: `customer_signals` rebuild via `$merge` with `allowDiskUse:true` completes without heap blow (assert `maxTimeMS:120000` not hit)
- [ ] `eligible?email=` uses `IXSCAN` on `customer_signals.emailNormalized` (not `orders` full scan)
- [ ] Fix verified: `rfm.ts:73` double `$sum` without unwind no longer present; `analytics-overview` reads `pricing.finalMinor` post-migration (not live `$lookup` fallback path unless `priceEstimated`)
- [ ] `customer-analytics:37` fixed: new aggregation path not 100k `lean()` OOM
- [ ] Backfill `orderedAt` batched 2k finishes without 60s timeout; `orderedAt` parse equals `new Date(date+'T'+time+':00+05:30')`; `time=''` → midnight not `Invalid Date`

**Integration — issuance & concurrency**
- [ ] Issuance paging 50k eligible → chunked `bulkWrite 1k` + `202 jobId` poll success; `distributed lock SET NX EX 300` blocks duplicate click → second `POST issue` returns 409 `job already running`
- [ ] Concurrent `100× POST /api/orders` with same code → exactly one 201, 99×409, `counters.redeemed` increments exactly once
- [ ] Per-customer lifetime cap: issuing twice for same `emailNormalized+schemeId` with `status∈{issued,redeemed,holdout}` second issuance is idempotent (upsert hits existing, no duplicate code); issuing after `expired` allows re-issue (partial filter excludes `expired`/`revoked`)
- [ ] Global cap race: last two requests against `maxRedemptionsGlobal=100` — one 201, one 409 inside txn `findOneAndUpdate $lt`
- [ ] Holdout 10% deterministic: `holdoutPercent=10` over 10k eligible → `holdoutN` 950–1050 (chi-square); same `schemeId:email` reissue produces same holdout bit

**Integration — auto attribution**
- [ ] Customer sampled `holdout` for scheme `LOYAL_AUTO`; next `POST /api/orders` with `mode:auto` does NOT auto-apply that scheme (holdout-aware skip)
- [ ] Auto path also runs `counters.redeemed $lt maxGlobal` transaction (not just coupon path)
- [ ] Holdout-scaled math: `treatedRevenue 90k, holdoutRevenue 8k (N=100 vs 10) → scaled=80k, incremental=90-80-cost` not `90-8-cost`

**E2E**
- [ ] `draft → submit (author A) → approve (author B != A) → active → issue (202) → poll → validate → redeem via order → analytics` shows incremental lift vs scaled holdout (not just `redeemed/issued`)
- [ ] Liability gate: `estimatedLiability=12L` blocks non-finance create with modal; finance can proceed
- [ ] `free_setup` order without `setupFeeMinor` → 409 "setup fee required"; with `setupFeeMinor=2000` and benefit `50000` → discount `2000` capped
- [ ] GDPR: `DELETE /api/customers/[emailNormalized]` cascades orders/coupons/signals, clears `global.__flowpilotRfmCache` and `__flowpilotSignalsCache` if present, returns 200 with masked audit
- [ ] Coupon list export: non-finance sees `a***@example.com`, finance sees full email

**Copilot**
- [ ] Embedding ROC: 20 promotion queries route `scheme_lookup >0.55` and NOT `customer_lookup`; `customer history` queries still route `customer_lookup`
- [ ] `intent===scheme_lookup` does NOT inject `toolCustomerProfile` facts even when query contains "customer"
- [ ] Fact payload per event ≤600 chars; `formatContext` slice is 600 not 1400; `toolCouponLookup(VALID_CODE)` returns single coupon cited as `[F1]`
- [ ] Null handling: no matching scheme → "No promotions found — check /promotions" not hallucinated code

**Perf budgets (k6 / artillery)**
- [ ] `eligible?email=` p95 <200ms, `validate` p95 <100ms, `orders POST` with txn p95 <400ms under 50 RPS against 500k orders
- [ ] Nightly `$merge` p95 <120s with `allowDiskUse:true`, `customer_signals_staging` heap <512MB

**Ops**
- [ ] Atlas index build `background:true`, rolling build no `COLLSCAN` during migration
- [ ] Rollback drill: `unset` `orderedAt/nameKey`, drop sparse indexes, reads fall back to `parseIST(date,time)` without error
- [ ] Observability: `promotion_audits` retention forever (not 24mo — only signals GDPR'd), `pino` logs `requestId/schemeId/holdout/jobId`, Vercel Log Drain, Atlas alert `counters.redeemed >= 80% maxGlobal`

---

## 14. File Map (v3)

```
models/PromotionScheme.ts          # §3.1 — orgId, code collation, basis points, maxSchemesPerCustomer, frozen eligibility
models/Coupon.ts                   # §3.2 — benefitSnapshot, clerkUserId, holdout status, org-scoped partial unique
models/CustomerSignal.ts           # §3.3 — materialized (was missing v1)
models/PromotionAudit.ts           # §3.5
models/SchemeDailyStat.ts          # §3.6 — scaled holdout, incrementalRevenue
models/SchemeIssueJob.ts           # job polling state for 202 pattern
models/RfmThresholds.ts            # frozen cutpoints versioned
lib/promotions/eligibility.ts      # winsorized regularity(), isRegularShort/Long, isActiveTenured, isDormantTenured, isSlipping
lib/promotions/engine.ts           # matchesSignals() with scheme tolerance recompute, maxSchemesPerCustomer enforcement
lib/promotions/analytics.ts        # scaled lift, 30d window, power warning
lib/promotions/rfm-thresholds.ts   # load/rotate frozen thresholds quarterly
lib/auth.ts                        # requireRole(), deriveEmail()
lib/db-indexes.ts                  # amended — single await, collation, partial matches, sparse
lib/mongodb.ts                     # await ensureQueryIndexes, global __flowpilotIndexPromise
lib/rate-limit.ts                  # Upstash Redis slidingWindow with headers
app/api/schemes/route.ts
app/api/schemes/[id]/route.ts
app/api/schemes/[id]/submit/route.ts
app/api/schemes/[id]/approve/route.ts
app/api/schemes/[id]/pause/route.ts
app/api/schemes/eligible/route.ts  # O(1) customer_signals
app/api/schemes/preview/route.ts   # liability + holdout + power disclosure
app/api/coupons/route.ts           # paginated, masked
app/api/coupons/[code]/route.ts    # single lookup for Copilot
app/api/coupons/validate/route.ts  # Redis 30/min, constant-time 404, minOrderValue + expiry + cap re-check
app/api/admin/schemes/issue/route.ts         # 202 + distributed lock + polls
app/api/admin/schemes/issue/[jobId]/route.ts # polls
app/api/admin/signals/rebuild/route.ts       # staging-rename, maxDuration 300
app/api/analytics/schemes/route.ts           # scaled lift, reactivation, ROI
app/api/customers/[email]/route.ts           # GDPR erasure cascade (Phase 4) — DELETE
app/(app)/promotions/page.tsx      # list, preset UI, liability gate, holdout disclosure, export
app/(app)/promotions/[id]/page.tsx # timeline, audit, coupons, revoke, issue progress 202 poll
app/(app)/promotions/layout.tsx    # server RBAC gate (Round-2 fix)
components/promotions/SchemeCard.tsx
components/promotions/EligibilityBadge.tsx
components/promotions/CohortChips.tsx
components/promotions/IssueProgress.tsx
scripts/backfill-inventory-nameKey.ts
scripts/backfill-orders-normalized.ts
scripts/rotate-rfm-thresholds.ts
models/Order.ts                    # orderedAt(sparse), products[].nameKey+unitPrice, pricing, appliedCoupon, idempotencyKey(sparse unique), orgId, emailNormalized
lib/ai/tools.ts                    # toolSchemeEligibility (≤600 chars), toolCouponLookup
lib/ai/copilot.ts                  # scheme_lookup 0.55, per-intent thresholds, gated customer_profile, capped formatContext
components/AppShell.tsx            # Commercial nav, palette filtering, Topbar
proxy.ts                           # RBAC helper routing
vercel.json                        # functions maxDuration/memory overrides
```

---

## 15. Changelog — What Changed From v2 (per Round-2 Feedback)

**SRE / Platform reviewer — P0 blockers**

- [x] **Rebuild Vercel-unsafe → staging-rename + `maxDuration:300`:** §9 `POST /api/admin/signals/rebuild` now declares `maxDuration:300`, `allowDiskUse:true`, `maxTimeMS:120k`, `cursor.batchSize:2000`, and two-phase `customer_signals_staging` → atomic `rename` with watermark; covers incremental race via `max(updatedAt)`. Without rename, `$merge whenMatched:replace` with concurrent incremental delta had last-writer loss.
- [x] **Incremental delta lossy fix:** §5 post-commit `refreshCustomerSignalForEmail` does bounded `find({emailNormalized}).sort(orderedAt)` for that email only (few hundred docs) + full `regularity()` recompute — not `$inc counters` alone; per-email optimistic `updatedAt` serialization documented.
- [x] **Org-scoped unique indexes:** `customer_signals` unique changed `email → {orgId,emailNormalized}` (was global, breaks multi-tenant dedup); same for `coupons {orgId,emailNormalized,schemeId}` partial unique. `promotion_schemes {orgId,code}` with collation.
- [x] **Collation/partial mismatch:** Explicit contract: `inventory.nameKey` lower-trim + index `nameKey:1 collation` on both Mongoose and native `ensureQueryIndexes`; `ensureQueryIndexes` failure now logs `pino.warn` not `catch(()=>undefined)` swallowed; Mongoose partialFilterExpression matches native exactly or deploy throws instead of silently diverging.
- [x] **Over-indexed bitmaps → partial indexes:** `isRegular→{medianInterval} partial isRegular`, `isSlipping→{recencyDays} partial`; low-cardinality `{orgId,status}` kept only where needed; `coupons.redeemedOrderId(sparse)`, `orders appliedCoupon.schemeId partial`, `orders orderedAt sparse` added; missing `coupons.redeemedOrderId` for analytics join added.
- [x] **Migration off Vercel:** `scripts/backfill-*` offline batched 2–5k `ordered:false`, `writeConcern:majority`, `migration_progress` resumable; no `POST /api/admin/backfill` long-held lock; `time=""` empty guard; IST `+05:30` explicit.
- [x] **Global cap fallback `1e12` removed:** Require `maxRedemptionsGlobal` when estimated liability for `percent/fixed` exceeds `₹10L`; otherwise `null` means "unlimited" only if non-liable (`free_setup` with bounded `setupFee`) — documented, no hidden 1T.
- [x] **Distributed lock for issue job:** §5+§9 `SET NX EX 300` per `schemeId` (Upstash), heartbeat extend, `jobId` pollable `GET /api/admin/schemes/issue/[jobId]`; duplicate click → 409 `job already running`; `counters.issued` incremented post-chunk by actual `upsertedCount` not blind `+eligible`.
- [x] **`lib/mongodb.ts:43` still `void`:** Changed to `await ensureQueryIndexes(db)` before return, sharing `__flowpilotIndexPromise` with timeout; `ensureRollupIndexes` merged into same promise.
- [x] **Daily stats feasibility:** Incremental `coupons.redeemedAt >= yesterday`, 30d windowing per customer (`issuedAt..issuedAt+30d`), not calendar day; `allowDiskUse`, `maxTimeMS:60000`, indexed `redeemedOrderId`.
- [x] **Auto attribution race:** Auto path now checks `holdout` doc, skips that `schemeId`, and runs same `findOneAndUpdate $lt` cap transaction as coupon path; `stackable:false` single `appliedCoupon` enforced; `organicOrders_treated` guardrail correctly notes auto has no organic baseline so uses holdout-rate delta.

**Product / Data Science reviewer — P0 blockers**

- [x] **Cohort naming & overlap:** Renamed `Loyal Champions→Active Tenured`, `Lapsed→Dormant Tenured` to eliminate token collision; defined exclusive rendering vs overlapping signal (§4.2); UI tooltip "Slipping = previously Regular, now overdue".
- [x] **`allowOverlap` misplaced → `maxSchemesPerCustomer` + `exclusiveGroup`:** Removed per-scheme `allowOverlap` boolean; replaced by global `maxSchemesPerCustomer` (default 2, job config) + optional `exclusiveGroup` — correct layer for inter-scheme overlap; documented vs `stackable` (per-order single coupon).
- [x] **Two-tier gap 61–74 closed:** Added `isRegularLong 75–120` as separate boolean + `seasonalityFlag`; regular = `short || long`; unified range `7–120` documented alternative; no bi-monthly dead zone; `Regular (Quarterly)` chip distinct.
- [x] **Regularity pseudo fixed:** `§4.1` fixes even-n median `avg(mid-1,mid)`, `mad` median likewise, adds 10% winsorization for `30,30,60,30,30` case, guards `mean===0`, `insufficient` for `intervals.length<3`, `median≥7`; `Strict/Relaxed` preset table concrete.
- [x] **Frozen expected bias fixed:** Require `minSupport 3` post-exclusion else fallback to full median; store both `expectedInterval` + `expectedIntervalsExcludedLast`; scheme `toleranceMultiplier` recomputes slipping at match time from stored values + `recencyDays` without DB rescan (signal vs param decoupling).
- [x] **Wiring `Order` write path:** `POST /api/orders` must snapshot `unitPrice+lineValueMinor+nameKey+pricing+orderedAt+idempotencyKey` before txn (was missing live despite model spec); `inventory.nameKey` migration script before first `signals` rebuild.
- [x] **Monetary UCI gap:** `nameKey` normalized (`lower+trim`) migration, `priceEstimated` → `excludeEstimated` eligibility flag + chip in preview, `analytics-overview` post-migration reads `pricing.finalMinor` not fallback `*50`; `originalCurrency` lineage kept for demo `£→₹` conversion note.
- [x] **`free_setup` defined, `free_shipping` removed:** Added `pricing.setupFeeMinor` + rule `discountMinor = min(benefitValueMinor||setupFeeMinor, setupFeeMinor)`; `free_setup` without `setupFee` → 409; `fixed` also respects `maxDiscountMinor` optionally; percent basis points `100==1%` clarified (UI `0..100` ↔ store `0..10000`), `zod` alignment.
- [x] **UI RBAC server gate:** Added `app/(app)/promotions/layout.tsx` server `has({role:'org:finance'})` redirect; palette filtering hides unauthorized entries from `⌘K`; `Topbar` matcher updated; missing controls (liability `₹10L` modal, holdout disclosure, archived banner, `202` polling progress, `priceEstimated` warning, `mask a***@` in export) specified as empty/loading states.
- [x] **Copilot collision:** Per-intent thresholds `scheme_lookup:0.55` with routing gate, tightened `customer_lookup` exemplars to profile phrasing, gated `toolCustomerProfile` injection when `intent===scheme_lookup`, suppressed `hybridRetrieve` generic docs for scheme intent, capped `formatContext` 1400→600 per fact, added `toolCouponLookup(VALID_CODE)` grounding, null handling "No promotions found".
- [x] **Holdout math scale:** `scaledHoldoutRevenue = holdoutRevenue * (treatedN/holdoutN)` merged; attribution window enforced `issuedAt..issuedAt+30d` both arms; power warning `eligible<100` + stratified holdout per interval tertile when `eligible≥200`; seed `hash(schemeId:emailNormalized)%100` stable.

*End of v3 Final — ready for owner approval and Phase-0 branch.*

