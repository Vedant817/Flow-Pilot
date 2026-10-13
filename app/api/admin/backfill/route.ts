import { NextRequest, NextResponse } from 'next/server';
import { backfillRollups } from '@/lib/analytics/rollup';
import { bootstrapKnowledge } from '@/lib/ai/memory';
import { AuthorizationError, requireMaintenanceAccess } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * One-shot maintenance endpoint:
 * 1. Rebuilds daily_sales_rollup via server-side $merge (safe at any volume).
 * 2. Seeds the domain knowledge corpus into semantic memory.
 * Idempotent — safe to call repeatedly (e.g., cron).
 */
export async function POST(req: NextRequest) {
  let authCtx: Awaited<ReturnType<typeof requireMaintenanceAccess>>;
  try {
    authCtx = await requireMaintenanceAccess(req);
  } catch (error) {
    const status = error instanceof AuthorizationError ? error.status : 401;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unauthorized' }, { status });
  }
  try {
    const rollupDocs = await backfillRollups(authCtx.orgId);
    await bootstrapKnowledge();
    return NextResponse.json({ ok: true, rollupDocs, message: 'Rollups rebuilt and knowledge seeded.' });
  } catch (error) {
    console.error('Backfill failed:', error);
    return NextResponse.json({ error: 'Backfill failed' }, { status: 500 });
  }
}
