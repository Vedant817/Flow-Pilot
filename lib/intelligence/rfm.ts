import { dbConnect } from '@/lib/mongodb';

/**
 * RFM segmentation over order history.
 * Percentile-scored (1–5) Recency / Frequency / Monetary per customer,
 * bucketed into actionable dealer segments. Computed server-side via
 * aggregation; results cached in-process with TTL.
 */

export interface SegmentRow {
  email: string;
  name: string;
  recencyDays: number;
  frequency: number;
  monetary: number;
  r: number;
  f: number;
  m: number;
  segment: string;
}

const CACHE_TTL_MS = 5 * 60_000;

interface CacheShape {
  data: SegmentRow[] | null;
  at: number;
}

declare global {
  var __flowpilotRfmCache: CacheShape | undefined;
}

function percentileScores(values: number[], invert = false): Map<number, number> {
  const sorted = [...values].sort((a, b) => (invert ? b - a : a - b));
  const n = sorted.length || 1;
  const rank = new Map<number, number>();
  sorted.forEach((v, i) => {
    const score = Math.min(5, Math.floor((i / n) * 5) + 1);
    if (!rank.has(v)) rank.set(v, score);
  });
  return rank;
}

export function classifySegment(r: number, f: number, m: number): string {
  if (r >= 4 && f >= 4 && m >= 4) return 'Champions';
  if (f >= 4 && m >= 3) return 'Loyal Accounts';
  if (r >= 4 && f <= 2) return 'Promising';
  if (r >= 4 && f === 3) return 'Potential Loyalists';
  if (r <= 2 && f >= 3) return 'At Risk';
  if (r <= 2 && f <= 2) return 'Hibernating';
  return 'Needs Attention';
}

export async function computeSegments(): Promise<SegmentRow[]> {
  const cached = global.__flowpilotRfmCache;
  if (cached?.data && Date.now() - cached.at < CACHE_TTL_MS) return cached.data;

  const conn = await dbConnect();
  const rows = await conn.connection.db!
    .collection('orders')
    .aggregate<{
      _id: string;
      name: string;
      frequency: number;
      monetary: number;
      lastOrder: string;
    }>([
      {
        $group: {
          _id: '$email',
          name: { $first: '$name' },
          frequency: { $sum: 1 },
          monetary: { $sum: { $sum: '$products.quantity' } },
          lastOrder: { $max: '$date' },
        },
      },
      { $limit: 50_000 },
    ])
    .toArray();

  const now = Date.now();
  const recencies = rows.map((c) => ({
    ...c,
    recencyDays: Math.floor((now - new Date(c.lastOrder).getTime()) / 86_400_000),
  }));

  // Higher score = better. Recency inverted (fewer days is better).
  const rScore = percentileScores(recencies.map((c) => c.recencyDays), true);
  const fScore = percentileScores(recencies.map((c) => c.frequency));
  const mScore = percentileScores(recencies.map((c) => c.monetary));

  const segments: SegmentRow[] = recencies.map((c) => {
    const r = rScore.get(c.recencyDays) ?? 1;
    const f = fScore.get(c.frequency) ?? 1;
    const m = mScore.get(c.monetary) ?? 1;
    return {
      email: c._id,
      name: c.name,
      recencyDays: c.recencyDays,
      frequency: c.frequency,
      monetary: c.monetary,
      r,
      f,
      m,
      segment: classifySegment(r, f, m),
    };
  });

  segments.sort((a, b) => b.monetary - a.monetary);

  global.__flowpilotRfmCache = { data: segments, at: Date.now() };
  return segments;
}
