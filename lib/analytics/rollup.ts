import { dbConnect } from '@/lib/mongodb';
import type { ClientSession } from 'mongodb';

/**
 * Daily sales rollup engine.
 *
 * Raw orders are written once and mutated rarely; every analytics consumer
 * needs day×product aggregates. Instead of scanning millions of order docs
 * per request (O(orders)), we maintain a compact pre-aggregated collection
 * (O(distinct days × products)) updated incrementally on order mutations
 * and rebuilt via server-side aggregation when backfilling.
 */

export interface RollupDoc {
  _id: string;
  date: string; // YYYY-MM-DD
  product: string;
  units: number;
  orders: number;
}

export interface SeriesPoint extends RollupDoc {
  _id: string;
}

export const ROLLUP_COLLECTION = 'daily_sales_rollup';

function docId(date: string, product: string): string {
  return `${date}|${product}`;
}

interface ProductLine {
  name: string;
  quantity: number;
}

/** Incrementally apply one order's lines (+1) or its removal (−1). */
export async function applyOrderDelta(
  date: string,
  products: ProductLine[],
  sign: 1 | -1,
  session?: ClientSession
): Promise<void> {
  if (!products?.length) return;
  const conn = await dbConnect();
  const col = conn.connection.db!.collection<RollupDoc>(ROLLUP_COLLECTION);

  const ops = products.map((p) => ({
    updateOne: {
      filter: { _id: docId(date, p.name) },
      update: {
        $inc: { units: sign * p.quantity, orders: sign },
        $setOnInsert: { date, product: p.name },
      },
      upsert: true,
    },
  }));

  await col.bulkWrite(ops, { ordered: false, session });
}

/**
 * Full rebuild using a server-side aggregation + $merge.
 * Runs entirely inside MongoDB — no document ever crosses the wire,
 * so this is safe at any data volume. Idempotent.
 */
export async function backfillRollups(): Promise<number> {
  const conn = await dbConnect();
  const db = conn.connection.db!;

  await db.command({
    collMod: ROLLUP_COLLECTION,
  }).catch(() => undefined);

  await db
    .collection('orders')
    .aggregate<{ count: number }>([
      { $unwind: '$products' },
      {
        $group: {
          _id: { $concat: ['$date', '|', '$products.name'] },
          date: { $first: '$date' },
          product: { $first: '$products.name' },
          units: { $sum: '$products.quantity' },
          orders: { $sum: 1 },
        },
      },
      {
        $merge: {
          into: ROLLUP_COLLECTION,
          whenMatched: [
            { $set: { units: '$$new.units', orders: '$$new.orders' } },
          ],
          whenNotMatched: 'insert',
        },
      },
    ])
    .toArray();

  const count = await db.collection(ROLLUP_COLLECTION).countDocuments();
  return count;
}

function ensureRollupIndexes(): Promise<unknown> {
  return dbConnect().then((conn) =>
    Promise.all([
      conn.connection.db!
        .collection(ROLLUP_COLLECTION)
        .createIndex({ date: -1 })
        .catch(() => undefined),
      conn.connection.db!
        .collection(ROLLUP_COLLECTION)
        .createIndex({ product: 1, date: -1 })
        .catch(() => undefined),
    ])
  );
}

declare global {
  var __flowpilotRollupIdx: Promise<unknown> | undefined;
}

/** Reads the daily series window (all products) ordered by date ascending. */
export async function getDailySeries(days: number): Promise<SeriesPoint[]> {
  if (!global.__flowpilotRollupIdx) global.__flowpilotRollupIdx = ensureRollupIndexes();
  await global.__flowpilotRollupIdx;

  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const conn = await dbConnect();
  // Cap at ~500k docs to protect memory on huge catalogs; typical catalogs (4k SKUs * 90d = 360k) fit safely.
  const safeLimit = Math.min(500_000, Math.max(10_000, days * 5000));
  return conn.connection.db!
    .collection<SeriesPoint>(ROLLUP_COLLECTION)
    .find({ date: { $gte: since } }, { sort: { date: 1 } })
    .limit(safeLimit)
    .toArray();
}

/** Dense per-product daily units array (zero-filled) for time-series models. */
export async function getProductSeries(
  product: string,
  days: number
): Promise<{ dates: string[]; units: number[] }> {
  const since = new Date(Date.now() - days * 86_400_000);
  const conn = await dbConnect();
  const rows = await conn.connection.db!
    .collection<RollupDoc>(ROLLUP_COLLECTION)
    .find({ product, date: { $gte: since.toISOString().slice(0, 10) } })
    .toArray();

  const map = new Map(rows.map((r) => [r.date, r.units]));
  const dates: string[] = [];
  const units: number[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    dates.push(d);
    units.push(map.get(d) ?? 0);
  }
  return { dates, units };
}
