# Failed Real-World Scenarios — Fix Plan (v2)

> Source: `docs/PROMOTION_SCHEMES_PLAN.md:561` v3 + Round-1/2 verifiers. After v3 + prior patches, three scenario families still **FAIL** in prod-like Vercel multi-instance. All other gaps now PASS (see §2).

| # | Failed Scenario | Evidence | Impact |
|---|---|---|---|
| **F1** | **Rate limit per `userId` not IP-only** — `lib/rate-limit.ts:20` reads `x-clerk-user-id` header never set → fallback `ip` only. `preview 5/min`, `validate 30/min`, `eligible 60/min` all `Map` in-process → attacker rotates IP or hits different lambda → `5*N_instances/min`. | `lib/rate-limit.ts:20-28` `getClientKey`, callers `app/api/schemes/preview/route.ts:9`, `app/api/coupons/validate/route.ts:9`, `app/api/schemes/eligible/route.ts:12`, `app/api/orders/route.ts:67`, `app/api/schemes/route.ts:67` | Abuse: brute-force `validate` oracle (per `emailNormalized`), expensive `preview` scan (50k) DDOS |
| **F2** | **Bulk issue distributed lock is in-process** — `app/api/admin/schemes/issue/route.ts:13` `global.__issueLocks Map` TTL 300s. Multi-instance bypass → duplicate `bulkWrite` and `counters.issued` double inc despite partial unique guard. Verifier `failed++` inaccurate. | `issue/route.ts:13-16` placeholder comment | Money: double coupons, liability double count |
| **F3** | **Thundering herd preview 5/min** — same root as F1 (in-process `Map`), per-lambda isolation lets `5*N_instances` expensive scans (`customer_signals.find().limit(50000)`) run. | `lib/rate-limit.ts:7` token bucket | Perf: OOM under burst |

> **F1 and F3 share root: in-process `Map` `lib/rate-limit.ts:7`; F2 is independent (in-process `global.__issueLocks`). Fixing F1 fixes F3. No new failed cohort math — all `eligibility.ts` `isRegular` etc. now PASS. GDPR masking, scaled holdout, expiry sweep, inventory collation also already PASS — verified, no change.

---

## §2 Already Fixed — Not in Scope for This Plan

Prior verifiers flagged 7 eligibility + 4 infra gaps. All verified fixed in code:

| Prior gap | Status | Evidence |
|---|---|---|
| distinct IST bucket | FIXED | `lib/promotions/eligibility.ts:121` `+19800000` IST |
| winsorization n<10 | FIXED | `lib/promotions/eligibility.ts:39` `n<10` clamp `sorted[1]/sorted[n-2]` |
| dead zone 61-74 | FIXED | `lib/promotions/eligibility.ts:228` `61-120` + `isRegularRelaxed 7-120` |
| mean===0 insufficient | FIXED | `lib/promotions/eligibility.ts:48` `insufficient:true` |
| rebuild canceled filter | FIXED | `lib/promotions/signals.ts:15` `status:{$ne:'canceled'}` |
| preview byCohort stale | FIXED | `app/api/schemes/preview/route.ts:72` recomputes `matchesSignals` with `toleranceOverride` |
| cadence maxCv unused | FIXED | `lib/promotions/engine.ts:77` custom `preset===custom` checks `cv/madRatio` |
| GDPR masking `a***@` | FIXED | `app/api/coupons/route.ts:24` finance/owner gate `reveal`, `app/api/coupons/[code]/route.ts:12` same |
| holdoutRevenue scaled | FIXED | `lib/promotions/analytics.ts:124` `scaledHoldout = holdoutRevenue*treatedN/holdoutN` + loop summing `pricing` |
| expiry sweep | FIXED | `app/api/admin/schemes/expire/route.ts:16` `updateMany expiresAt<now→expired` + audit |
| inventory collation | FIXED | `lib/db-indexes.ts:27` `nameKey` collation `en:strength2` |

This plan therefore **only** addresses F1-F3.

---

## Fix Strategy

We stay on **MongoDB-backed** distributed primitives (already provisioned, replica set required for `app/api/orders` txn). Reuses infra, no Upstash env, strong enough for low-QPS `issue` lock. For high-QPS `validate/preview`, Mongo adds 10–40ms but we keep `Map` L1 10s optimistic cache **only** as optimization, not source of truth. All buckets/locks use `Date` types so TTL `expireAfterSeconds:0` works; liveness is checked in code, not by TTL expiry (TTL monitor runs ~60s, eventual only).

### F1: Rate limit per `userId` (not IP, not header)

**Goal:** `validate 30/min`, `preview 5/min`, `eligible 60/min`, `orders 60/min`, `schemes 10/min`, `issue 5/min`, `rebuild` must be per authenticated `userId` else `ip`, atomic, header-spoof-proof.

**Design:**

```ts
// lib/rate-limit.ts — NEW async primary, sync wrapper deprecated
import { getAuthContext } from '@/lib/auth';
import { dbConnect } from '@/lib/mongodb';

export async function rateLimitAsync(
  req: Request,
  opts: { windowMs: number; max: number; keyPrefix?: string }
): Promise<{ ok: boolean; remaining: number; retryAfterSec: number }> {
  // 1. userId from auth(), NOT from header. Never read x-clerk-user-id.
  let userId: string | null = null;
  try { const ctx = await getAuthContext().catch(()=>null as any); userId = ctx?.userId ?? null; } catch {}
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'local';
  const base = userId ?? ip; // per-user if authed, else per-ip (accepted risk for anon orders, doc'd)
  const windowStart = Math.floor(Date.now() / opts.windowMs) * opts.windowMs;
  const key = `rate:${opts.keyPrefix ?? 'default'}:${base}:${windowStart}`;
  const now = new Date();
  const resetAt = new Date(windowStart + opts.windowMs);

  // 2. L1 Map 10s cache — fast path, but source of truth is Mongo
  //    On cache hit with tokens>0, decrement in-memory and proceed; on miss or tokens<=0, read-through DB.
  //    Implemented via global Map with 10s TTL, invalidated when window rolls.
  // 3. L2 Mongo atomic fixed-window: findOneAndUpdate upsert $inc tokens:-1
  //    Tokens start at max, decrement atomically, ok if remaining >=0.
  const db = (await dbConnect()).connection.db!;
  const col = db.collection('rate_limit_buckets');
  const res = await col.findOneAndUpdate(
    { key },
    {
      $setOnInsert: { key, resetAt, createdAt: now },
      $inc: { tokens: -1 },
      $set: { updatedAt: now },
    },
    { upsert: true, returnDocument: 'after' }
  );
  // On first insert, tokens was undefined → $inc makes NaN → we initialize to max-1 via $setOnInsert tokens:max
  // So we need two-phase: if inserted, set tokens = max-1. Simpler: upsert with aggregation pipeline or check.
  // Implementation does find then set: if res.tokens === -1 (first inc on null) then $set tokens = max-1.
  // For brevity, we handle via $setOnInsert {tokens: max} then $inc after, or use pipeline.
}
```

*Remove* `getClientKey()` and `global.__flowpilotBuckets` direct use for promotion callers; keep sync `rateLimit()` as `/** @deprecated — use rateLimitAsync */` delegating to `Map` IP-only for legacy `chatbot` only.

**Files:**
- `lib/rate-limit.ts:1` — implement `rateLimitAsync` as above, delete `x-clerk-user-id` read, change `Bucket.resetAt: Date` not `number`, keep deprecated sync wrapper.
- Callers to migrate (7 sites):
  - `app/api/schemes/preview/route.ts:9` `5/min keyPrefix:'preview'` → `await rateLimitAsync`
  - `app/api/coupons/validate/route.ts:9` `30/min keyPrefix:'coupon_validate'` + additional per-`emailNormalized` bucket `rate:coupon_validate:${base}:${emailNorm}:${windowStart}` (see §1.4)
  - `app/api/schemes/eligible/route.ts:12` `60/min keyPrefix:'eligible'` (missing before)
  - `app/api/orders/route.ts:67` `60/min` add `keyPrefix:'orders_post'`
  - `app/api/schemes/route.ts:67` `10/min keyPrefix:'schemes_post'`
  - `app/api/admin/schemes/issue/route.ts:37` `5/min keyPrefix:'issue'`
  - `app/api/admin/signals/rebuild/route.ts:1` no limit → add `5/min keyPrefix:'signals_rebuild'` + Mongo lock (reuse F2 helper)
  - `app/api/chatbot/route.ts:12` keep sync but note
- Index: `rate_limit_buckets.createIndex({key:1},{unique:true})`, `createIndex({resetAt:1},{expireAfterSeconds:0})` — added in `lib/db-indexes.ts:15`. Note `resetAt` must be `Date`.

**Edge cases:**
- Clerk not configured → `userId=null` → fallback `ip` (doc'd, accepted for anon `orders`).
- `getAuthContext` throws → fallback `ip`.
- Header spoof `x-clerk-user-id` removed.
- Anonymous `validate` still per-`emailNormalized` bucket to stop email rotation bypass.
- Clock skew: use DB `now` for `resetAt` consistency if possible, else server `Date.now()` ±2s tolerated via `retryAfterSec` monotonic.

### F2: Bulk issue distributed lock

**Goal:** At most one `issue` job per `schemeId` cluster-wide, `409 Job already running` observable, auto-expire 5 min, heartbeat, owner-scoped release.

**Design:**
- Collection `distributed_locks`: `{ _id: string, owner: string, expiresAt: Date, createdAt: Date }` TTL `expiresAt` 0s (GC only, liveness checked in code).
- Helper `lib/distributed-lock.ts`:
  ```ts
  export async function acquireLock(key: string, ttlMs: number, owner: string): Promise<boolean> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMs);
    const col = (await dbConnect()).connection.db!.collection('distributed_locks');
    // Atomic primary: try to steal expired or insert if missing in one round-trip
    const res = await col.findOneAndUpdate(
      { _id: key, $or: [{ expiresAt: { $lt: now } }, { expiresAt: { $exists: false } }] },
      { $set: { owner, expiresAt, createdAt: now } },
      { upsert: false, returnDocument: 'after' }
    ).catch(()=>null);
    if (res) return true;
    // If no doc matched (either locked or missing), try insert (missing case)
    try {
      await col.insertOne({ _id: key, owner, expiresAt, createdAt: now });
      return true;
    } catch (e: any) {
      if (e?.code !== 11000) throw e;
      // Duplicate: someone else inserted or lock still held
      const existing = await col.findOne({ _id: key });
      if (existing && new Date(existing.expiresAt) < now) {
        // expired — try steal via findOneAndUpdate with owner check
        const steal = await col.findOneAndUpdate(
          { _id: key, expiresAt: { $lt: now } },
          { $set: { owner, expiresAt: new Date(Date.now()+ttlMs) } },
          { returnDocument: 'after' }
        );
        return !!steal;
      }
      return false;
    }
  }
  export const releaseLock = async (k:string, owner:string) =>
    (await dbConnect()).connection.db!.collection('distributed_locks').deleteOne({_id:k, owner});
  export const refreshLock = async (k:string, ttlMs:number, owner:string) =>
    !!(await (await dbConnect()).connection.db!.collection('distributed_locks').updateOne({_id:k, owner}, {$set:{expiresAt:new Date(Date.now()+ttlMs)}})).modifiedCount;
  ```
  Primary path is single `findOneAndUpdate` atomic; insert fallback only for missing doc. `owner` enforced on `release`/`refresh` to prevent stealing.

**Files:**
- New `lib/distributed-lock.ts:1`
- Modify `app/api/admin/schemes/issue/route.ts:13,37,122,263` — remove `global.__issueLocks Map`, import `acquireLock/releaseLock/refreshLock`, `const owner=authCtx.userId; const ok=await acquireLock(`issue:${schemeId}`,300_000,owner); if(!ok) return 409; try{ for chunk... await refreshLock(...); } finally{ await releaseLock(...,owner); }` — early returns `404/400` before lock are outside `try`; heartbeat every `BATCH` 500.
- Add TTL index `lib/db-indexes.ts:15` `distributed_locks.createIndex({expiresAt:1},{expireAfterSeconds:0})` + `ensureQueryIndexes` failure logging via `Promise.allSettled`.

### F3: Thundering herd preview

Covered by F1 (per-user Mongo bucket + `Map` L1). Additionally, ensure `preview` response includes `Retry-After` + `X-RateLimit-Remaining` headers and `maxTimeMS` already on pipeline `app/api/schemes/preview/route.ts:48` `limit(50000)` plus `Cache-Control: no-store` `Vary: Cookie` (not cacheable POST).

---

## Verification Plan (expanded)

1. **Unit rateLimitAsync:** same `userId` diff IPs → same bucket `remaining` decrements; `userId` rotation bypass fails; 10 concurrent `rateLimitAsync` with `max:5` → exactly 5 `ok:true` via atomic `$inc`; `x-clerk-user-id` spoof header ignored (set `attacker-id` while `auth()->victim` → bucket is `victim`).
2. **Unit lock:** two concurrent `acquireLock('k',300000,'o1'/'o2')` → one true one false; after `releaseLock` third true; expired lock `expiresAt=now-1s` → next `acquireLock` true via steal; `releaseLock(k,wrongOwner)` does not delete; `refreshLock` extends `expiresAt` so second waiter still 409 after heartbeat.
3. **Integration preview:** two `POST /api/schemes/preview` from same `userId` 6th call → 429 with `Retry-After`; two parallel `POST /api/admin/schemes/issue` same `schemeId` across pods (simulate via two `acquireLock` with different owners) → one 200 one 409; verify `counters.issued` unchanged after 409.
4. **Integration lock heartbeat & crash:** acquire → throw inside `try` → `finally releaseLock` called (lock not leaked 5 min).
5. **Regression:** `npx tsc --noEmit` 0, `npm test` existing suite green + new `rate_limit_buckets`/`distributed_locks` `explain IXSCAN`, `npm run build` 38 routes, `explain` preview still `IXSCAN` on `customer_signals`.

---

## Rollout Steps

1. Create `lib/distributed-lock.ts` + update `lib/rate-limit.ts` to async user-aware atomic + add `rate_limit_buckets`/`distributed_locks` TTL indexes in `lib/db-indexes.ts:15`.
2. Migrate 7 callers to `await rateLimitAsync` (preview, validate, eligible, orders, schemes, issue, signals/rebuild) with precise `keyPrefix` and per-email bucket for `validate`.
3. Swap `issue` route `global.__issueLocks` to Mongo lock with `try/finally` `releaseLock(owner)` and per-chunk `refreshLock`.
4. Run `npx tsc --noEmit` + `npm test` + `npx tsx` lock/rate atomic tests.

*End of fix plan v2 — addresses verifier feedback verbatim.*

