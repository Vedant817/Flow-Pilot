import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { rebuildCustomerSignalsForOrg } from '@/lib/promotions/signals';
import { PromotionAudit } from '@/models/PromotionAudit';
import { isAdminSecretValid, getAuthContext } from '@/lib/auth';
import { rateLimitAsync } from '@/lib/rate-limit';
import { acquireLock, releaseLock, refreshLock } from '@/lib/distributed-lock';

export const maxDuration = 300;

async function requireAuth(req: NextRequest) {
  const ctx = await getAuthContext().catch(() => ({ userId: null as any, email: undefined, orgId: 'default' }));
  if (ctx.userId) return ctx;
  if (isAdminSecretValid(req)) return { userId: 'cron', email: 'cron@system', orgId: 'default' };
  if (process.env.NODE_ENV === 'development' && !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) return { userId: 'dev', email: 'dev@local', orgId: 'default' };
  const err: any = new Error('Unauthorized'); err.status = 401; throw err;
}

export async function POST(req: NextRequest) {
  let authCtx: any;
  try { authCtx = await requireAuth(req); } catch (e: any) { return NextResponse.json({ error: e.message }, { status: e.status || 401 }); }

  const limited = await rateLimitAsync(req, { windowMs: 60_000, max: 5, keyPrefix: 'signals_rebuild' });
  if (!limited.ok) return NextResponse.json({ error: 'Rate limit exceeded — rebuild is expensive' }, { status: 429, headers: { 'Retry-After': String(limited.retryAfterSec) } as any });

  const lockKey = `rebuild:${authCtx.orgId || 'default'}`;
  const owner = String(authCtx.userId);
  const locked = await acquireLock(lockKey, 300_000, owner);
  if (!locked) return NextResponse.json({ error: 'Rebuild already running' }, { status: 409 });

  const body = await req.json().catch(() => ({}));
  const orgId = body.orgId || 'default';

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
