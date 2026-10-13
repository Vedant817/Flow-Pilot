import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { rebuildCustomerSignalsForOrg } from '@/lib/promotions/signals';
import { PromotionAudit } from '@/models/PromotionAudit';
import { AuthorizationError, requireMaintenanceAccess } from '@/lib/auth';
import { rateLimitAsync } from '@/lib/rate-limit';
import { acquireLock, releaseLock, refreshLock } from '@/lib/distributed-lock';

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  let authCtx: Awaited<ReturnType<typeof requireMaintenanceAccess>>;
  try {
    authCtx = await requireMaintenanceAccess(req);
  } catch (error) {
    const status = error instanceof AuthorizationError ? error.status : 401;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unauthorized' }, { status });
  }

  const limited = await rateLimitAsync(req, { windowMs: 60_000, max: 5, keyPrefix: 'signals_rebuild' });
  if (!limited.ok) return NextResponse.json({ error: 'Rate limit exceeded — rebuild is expensive' }, { status: 429, headers: { 'Retry-After': String(limited.retryAfterSec) } as any });

  const lockKey = `rebuild:${authCtx.orgId}`;
  const owner = String(authCtx.userId);
  const locked = await acquireLock(lockKey, 300_000, owner);
  if (!locked) return NextResponse.json({ error: 'Rebuild already running' }, { status: 409 });

  const orgId = authCtx.orgId;

  try {
    await dbConnect();
    const result = await rebuildCustomerSignalsForOrg(orgId);

    await PromotionAudit.create({
      orgId,
      actorClerkId: authCtx.userId,
      actorEmail: authCtx.email || 'unknown',
      action: 'backfill',
      after: result,
      at: new Date(),
    });

    return NextResponse.json({ orgId, ...result });
  } catch (e: any) {
    console.error('rebuild failed', e);
    return NextResponse.json({ error: e?.message || 'Rebuild failed' }, { status: 500 });
  } finally {
    await releaseLock(lockKey, owner).catch(() => {});
  }
}

export async function GET(req: NextRequest) {
  // For manual trigger via GET as well
  return POST(req);
}
