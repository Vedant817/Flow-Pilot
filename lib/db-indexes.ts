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
  const ops: Promise<unknown>[] = [
    db.collection('orders').createIndex({ orgId: 1, orderedAt: -1, _id: -1 }),
    db.collection('orders').createIndex({ orgId: 1, email: 1, date: -1 }),
    db.collection('orders').createIndex({ orgId: 1, status: 1, orderedAt: -1 }),
    db.collection('orders').createIndex({ orgId: 1, name: 1 }),
    db.collection('orders').createIndex({ emailNormalized: 1, orderedAt: 1 }),
    db.collection('orders').createIndex({ orderedAt: -1 }, { sparse: true } as any),
    db.collection('orders').createIndex({ orgId: 1, idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } }),
    db.collection('orders').createIndex({ trackingTokenHash: 1 }, { unique: true, sparse: true } as any),
    db.collection('orders').createIndex({ 'appliedCoupon.schemeId': 1 }, { partialFilterExpression: { 'appliedCoupon.schemeId': { $exists: true } } as any }),
    db.collection('orders').createIndex({ orgId: 1, emailNormalized: 1, orderedAt: 1 }),
    db.collection('inventory').createIndex({ orgId: 1, name: 1 }),
    db.collection('inventory').createIndex({ orgId: 1, nameKey: 1 } as any, { collation: { locale: 'en', strength: 2 } as any }),
    db.collection('inventory').createIndex({ orgId: 1, category: 1 }),
    db.collection('feedback').createIndex({ orgId: 1, type: 1, createdAt: -1 }),
    db.collection('feedback').createIndex(
      { orgId: 1, sourceMessageId: 1 },
      { unique: true, partialFilterExpression: { sourceMessageId: { $type: 'string' } } }
    ),
    db.collection('errors').createIndex({ orgId: 1, timestamp: -1 }),
    db.collection('errors').createIndex({ orgId: 1, severity: 1, timestamp: -1 }),
    db.collection('errors').createIndex(
      { orgId: 1, sourceMessageId: 1 },
      { unique: true, partialFilterExpression: { sourceMessageId: { $type: 'string' } } }
    ),
    db.collection('conversations').createIndex({ orgId: 1, userId: 1, updatedAt: -1 }),
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
    db.collection('integration_cursors').createIndex({ orgId: 1, provider: 1 }, { unique: true }),
    db.collection('outbox_events').createIndex({ orgId: 1, eventKey: 1 }, { unique: true }),
    db.collection('outbox_events').createIndex({ orgId: 1, status: 1, availableAt: 1, lockedUntil: 1 }),
    db.collection('order_events').createIndex({ orgId: 1, orderId: 1, at: 1 }),
    db.collection('email_reviews').createIndex({ orgId: 1, gmailMessageId: 1 }, { unique: true }),
    db.collection('email_reviews').createIndex({ orgId: 1, status: 1, createdAt: -1 }),
    db.collection('inbound_order_drafts').createIndex({ orgId: 1, gmailMessageId: 1 }, { unique: true }),
    db.collection('inbound_order_drafts').createIndex({ orgId: 1, status: 1, createdAt: -1 }),
    db.collection('integration_credentials').createIndex({ orgId: 1, provider: 1 }, { unique: true }),
    db.collection('oauth_states').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection('inventory_movements').createIndex({ orgId: 1, eventKey: 1 }, { unique: true }),
    db.collection('inventory_movements').createIndex({ orgId: 1, productId: 1, at: -1, _id: -1 }),
    db.collection('inventory_reservations').createIndex({ orgId: 1, orderId: 1, productId: 1 }, { unique: true }),
  ];

  const results = await Promise.allSettled(ops);
  const failures = results.filter(
    (result): result is PromiseRejectedResult => result.status === 'rejected'
  );
  if (failures.length) {
    throw new AggregateError(
      failures.map((failure) => failure.reason),
      'Required database indexes could not be created'
    );
  }
}
