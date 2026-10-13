import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { AuthorizationError, requireMaintenanceAccess } from '@/lib/auth';
import { PromotionAudit } from '@/models/PromotionAudit';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let authCtx: Awaited<ReturnType<typeof requireMaintenanceAccess>>;
  try {
    authCtx = await requireMaintenanceAccess(req);
  } catch (error) {
    const status = error instanceof AuthorizationError ? error.status : 401;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unauthorized' }, { status });
  }

  await dbConnect();
  const now = new Date();

  // Use direct mongoose models for updates to keep hooks
  const { Coupon } = await import('@/models/Coupon');
  const { PromotionScheme } = await import('@/models/PromotionScheme');

  const [couponRes, schemeRes] = await Promise.all([
    Coupon.updateMany(
      { orgId: authCtx.orgId, expiresAt: { $lt: now }, status: 'issued' },
      { $set: { status: 'expired' } }
    ),
    PromotionScheme.updateMany(
      { orgId: authCtx.orgId, status: 'active', 'limits.validUntil': { $lt: now } },
      { $set: { status: 'expired' } }
    ),
  ]);

  const expiredCoupons = (couponRes as any).modifiedCount ?? 0;
  const expiredSchemes = (schemeRes as any).modifiedCount ?? 0;

  await PromotionAudit.create({
    orgId: authCtx.orgId,
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
