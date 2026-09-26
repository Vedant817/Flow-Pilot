import type { Db } from 'mongodb';

/**
 * Declarative index strategy. Applied idempotently once per process on the
 * first DB connection — query patterns stay index-backed as data grows.
 *
 * orders:        date-desc sort (feed), email lookup (RFM/history),
 *                status+date (status filters), name prefix (search)
 * inventory:     name equality joins, category scans + nameKey normalized
 * feedback:      sentiment filters + recency
 * errors:        severity dashboards + time-window queries
 * rollup:        date / product+date (handled in lib/analytics/rollup.ts)
 * promotions:    schemes, coupons, customer_signals, audits, daily stats
 */
export async function ensureQueryIndexes(db: Db): Promise<void> {
  const ops: Promise<any>[] = [
    db.collection('orders').createIndex({ date: -1 }),
    db.collection('orders').createIndex({ email: 1, date: -1 }),
    db.collection('orders').createIndex({ status: 1, date: -1 }),
    db.collection('orders').createIndex({ name: 1 }),
    db.collection('orders').createIndex({ emailNormalized: 1, orderedAt: 1 }),
    db.collection('orders').createIndex({ orderedAt: -1 }, { sparse: true } as any),
    db.collection('orders').createIndex({ idempotencyKey: 1 }, { unique: true, sparse: true } as any),
    db.collection('orders').createIndex({ 'appliedCoupon.schemeId': 1 }, { partialFilterExpression: { 'appliedCoupon.schemeId': { $exists: true } } as any }),
    db.collection('orders').createIndex({ orgId: 1, emailNormalized: 1, orderedAt: 1 }),
    db.collection('inventory').createIndex({ name: 1 }),
    db.collection('inventory').createIndex({ nameKey: 1 } as any, { collation: { locale: 'en', strength: 2 } as any }),
    db.collection('inventory').createIndex({ category: 1 }),
    db.collection('feedback').createIndex({ type: 1 }),
    db.collection('errors').createIndex({ timestamp: -1 }),
    db.collection('errors').createIndex({ severity: 1 }),
    db.collection('email_reviews').createIndex({ orgId: 1, gmailMessageId: 1 }, { unique: true }),
    db.collection('email_reviews').createIndex({ orgId: 1, status: 1, createdAt: -1 }),
    // promotion_schemes
    db.collection('promotion_schemes').createIndex({ orgId: 1, code: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } as any }),
    db.collection('promotion_schemes').createIndex({ status: 1, 'limits.validFrom': 1, 'limits.validUntil': 1 }),
    db.collection('promotion_schemes').createIndex({ orgId: 1, status: 1 }),
    // coupons
    db.collection('coupons').createIndex({ code: 1 }, { unique: true }),
    db.collection('coupons').createIndex({ orgId: 1, emailNormalized: 1, status: 1, expiresAt: 1 }),
    db.collection('coupons').createIndex({ orgId: 1, schemeId: 1, status: 1 }),
    db.collection('coupons').createIndex({ orgId: 1, schemeId: 1, redeemedAt: -1 }),
    db.collection('coupons').createIndex({ orgId: 1, emailNormalized: 1, schemeId: 1 }, { unique: true, partialFilterExpression: { status: { $in: ['issued', 'redeemed', 'holdout'] } } as any }),
    db.collection('coupons').createIndex({ redeemedOrderId: 1 }, { sparse: true } as any),
    db.collection('coupons').createIndex({ expiresAt: 1 }),
    // customer_signals
    db.collection('customer_signals').createIndex({ orgId: 1, emailNormalized: 1 }, { unique: true }),
    db.collection('customer_signals').createIndex({ orgId: 1, updatedAt: -1 }),
    db.collection('customer_signals').createIndex({ medianInterval: 1 }, { partialFilterExpression: { isRegular: true } as any }),
    db.collection('customer_signals').createIndex({ recencyDays: 1 }, { partialFilterExpression: { isSlipping: true } as any }),
    db.collection('customer_signals').createIndex({ orgId: 1, isActiveTenured: 1 }),
    db.collection('customer_signals').createIndex({ orgId: 1, isDormantTenured: 1 }),
    // audits
    db.collection('promotion_audits').createIndex({ orgId: 1, schemeId: 1, at: -1 }),
    db.collection('promotion_audits').createIndex({ orgId: 1, actorClerkId: 1, at: -1 }),
    // daily stats
    db.collection('scheme_daily_stats').createIndex({ orgId: 1, schemeId: 1, date: 1 }, { unique: true }),
    // issue jobs
    db.collection('scheme_issue_jobs').createIndex({ schemeId: 1, status: 1 }),
    db.collection('rfm_thresholds').createIndex({ version: 1 }, { unique: true }),
    // distributed primitives
    db.collection('rate_limit_buckets').createIndex({ key: 1 }, { unique: true }),
    db.collection('rate_limit_buckets').createIndex({ resetAt: 1 }, { expireAfterSeconds: 0 } as any),
    db.collection('distributed_locks').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 } as any),
  ];

  const results = await Promise.allSettled(ops);
  for (const r of results) {
    if (r.status === 'rejected') {
      console.warn('Index ensure skipped:', r.reason instanceof Error ? r.reason.message : r.reason);
    }
  }
}
