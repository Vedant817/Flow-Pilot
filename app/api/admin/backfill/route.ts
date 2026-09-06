import { NextRequest, NextResponse } from 'next/server';
import { backfillRollups } from '@/lib/analytics/rollup';
import { bootstrapKnowledge } from '@/lib/ai/memory';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * One-shot maintenance endpoint:
 * 1. Rebuilds daily_sales_rollup via server-side $merge (safe at any volume).
 * 2. Seeds the domain knowledge corpus into semantic memory.
 * Idempotent — safe to call repeatedly (e.g., cron).
 */
export async function POST(req: NextRequest) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret || req.headers.get('x-admin-secret') !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const rollupDocs = await backfillRollups();
    await bootstrapKnowledge();
    return NextResponse.json({ ok: true, rollupDocs, message: 'Rollups rebuilt and knowledge seeded.' });
  } catch (error) {
    console.error('Backfill failed:', error);
    return NextResponse.json({ error: 'Backfill failed' }, { status: 500 });
  }
}
