import type { Db } from 'mongodb';

/**
 * Declarative index strategy. Applied idempotently once per process on the
 * first DB connection — query patterns stay index-backed as data grows.
 *
 * orders:        date-desc sort (feed), email lookup (RFM/history),
 *                status+date (status filters), name prefix (search)
 * inventory:     name equality joins, category scans
 * feedback:      sentiment filters + recency
 * errors:        severity dashboards + time-window queries
 * rollup:        date / product+date (handled in lib/analytics/rollup.ts)
 */
export async function ensureQueryIndexes(db: Db): Promise<void> {
  try {
    await Promise.all([
      db.collection('orders').createIndex({ date: -1 }),
      db.collection('orders').createIndex({ email: 1, date: -1 }),
      db.collection('orders').createIndex({ status: 1, date: -1 }),
      db.collection('orders').createIndex({ name: 1 }),
      db.collection('inventory').createIndex({ name: 1 }),
      db.collection('inventory').createIndex({ category: 1 }),
      db.collection('feedback').createIndex({ type: 1 }),
      db.collection('errors').createIndex({ timestamp: -1 }),
      db.collection('errors').createIndex({ severity: 1 }),
    ]);
  } catch (e) {
    console.warn('Index ensure skipped:', e instanceof Error ? e.message : e);
  }
}
