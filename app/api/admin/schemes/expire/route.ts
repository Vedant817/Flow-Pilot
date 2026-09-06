import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { isAdminSecretValid, getAuthContext } from '@/lib/auth';
import { PromotionAudit } from '@/models/PromotionAudit';

export const maxDuration = 60;

async function requireAuth(req: NextRequest) {
  const ctx = await getAuthContext().catch(() => ({ userId: null as any, email: undefined, orgId: 'default' }));
  if (ctx.userId) return ctx;
  if (isAdminSecretValid(req)) return { userId: 'cron', email: 'cron@system', orgId: 'default' };
  if (process.env.NODE_ENV === 'development' && !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) return { userId: 'dev', email: 'dev@local', orgId: 'default' };
  const err: any = new Error('Unauthorized'); err.status = 401; throw err;
}

export async function POST(req: NextRequest) {
  let authCtx: any;
  try {
    authCtx = await requireAuth(req);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 401 });
  }

  await dbConnect();
  const now = new Date();

  // Use direct mongoose models for updates to keep hooks
  const { Coupon } = await import('@/models/Coupon');
  const { PromotionScheme } = await import('@/models/PromotionScheme');

  const [couponRes, schemeRes] = await Promise.all([
    Coupon.updateMany({ expiresAt: { $lt: now }, status: 'issued' }, { $set: { status: 'expired' } }),
    PromotionScheme.updateMany({ status: 'active', 'limits.validUntil': { $lt: now } }, { $set: { status: 'expired' } }),
  ]);

  const expiredCoupons = (couponRes as any).modifiedCount ?? 0;
  const expiredSchemes = (schemeRes as any).modifiedCount ?? 0;

  await PromotionAudit.create({
    orgId: 'default',
    actorClerkId: authCtx.userId,
    actorEmail: authCtx.email || 'unknown',
    action: 'expire',
    after: { expiredCoupons, expiredSchemes, at: now },
    at: now,
  });

  return NextResponse.json({ expiredCoupons, expiredSchemes, at: now });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
