import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Coupon } from '@/models/Coupon';
import { PromotionScheme } from '@/models/PromotionScheme';
import { computeDiscount } from '@/lib/promotions/pricing';
import { rateLimitAsync } from '@/lib/rate-limit';
import { AuthorizationError, requireWorkspace } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const limited = await rateLimitAsync(req, { windowMs: 60_000, max: 30, keyPrefix: 'coupon_validate' });
  if (!limited.ok) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers: { 'Retry-After': String(limited.retryAfterSec) } as any });
  }

  try {
    const authCtx = await requireWorkspace();
    const body = await req.json();
    const { code, email, orderValueMinor } = body ?? {};
    if (!code) return NextResponse.json({ error: 'code required' }, { status: 400 });
    const normalizedCode = String(code).toUpperCase().trim();
    const normalizedEmail = email ? String(email).toLowerCase().trim() : undefined;
    const now = new Date();

    await dbConnect();
    const coupon = await Coupon.findOne({
      orgId: authCtx.orgId,
      code: normalizedCode,
    }).lean() as any;
    if (!coupon) {
      // constant-time 404 to avoid enumeration timing
      await new Promise((r) => setTimeout(r, 120));
      return NextResponse.json({ valid: false, reason: 'Invalid code' }, { status: 200 });
    }

    if (coupon.status !== 'issued') {
      return NextResponse.json({ valid: false, reason: `Coupon is ${coupon.status}` });
    }
    if (new Date(coupon.expiresAt) < now) {
      return NextResponse.json({ valid: false, reason: 'Expired' });
    }
    if (coupon.emailNormalized) {
      if (!normalizedEmail) {
        return NextResponse.json({ valid: false, reason: 'Email required — coupon is bound to a customer' });
      }
      if (coupon.emailNormalized !== normalizedEmail) {
        return NextResponse.json({ valid: false, reason: 'Email mismatch' });
      }
    }

    const scheme = await PromotionScheme.findOne({
      _id: coupon.schemeId,
      orgId: authCtx.orgId,
    }).lean() as any;
    if (!scheme) return NextResponse.json({ valid: false, reason: 'Scheme not found' });
    if (scheme.status !== 'active') return NextResponse.json({ valid: false, reason: `Scheme is ${scheme.status}` });
    if (scheme.limits?.validFrom && new Date(scheme.limits.validFrom) > now) return NextResponse.json({ valid: false, reason: 'Scheme not yet valid' });
    if (scheme.limits?.validUntil && new Date(scheme.limits.validUntil) < now) return NextResponse.json({ valid: false, reason: 'Scheme expired' });
    if (scheme.limits?.maxRedemptionsGlobal != null && scheme.counters?.redeemed >= scheme.limits.maxRedemptionsGlobal) {
      return NextResponse.json({ valid: false, reason: 'Global cap reached' });
    }

    const orderVal = orderValueMinor != null ? Number(orderValueMinor) : 50000; // fallback 500 INR
    if (scheme.minimumOrderValueMinor && orderVal < scheme.minimumOrderValueMinor) {
      return NextResponse.json({ valid: false, reason: `Minimum order value ₹${scheme.minimumOrderValueMinor / 100} required` });
    }

    const discountMinor = computeDiscount(
      {
        benefitType: scheme.benefitType,
        benefitValueMinor: scheme.benefitValueMinor,
        maxDiscountMinor: scheme.maxDiscountMinor,
        setupFeeMinor: scheme.setupFeeMinor,
        minimumOrderValueMinor: scheme.minimumOrderValueMinor,
      },
      orderVal
    );

    if (scheme.benefitType === 'free_setup' && discountMinor === 0) {
      return NextResponse.json({ valid: false, reason: 'Setup fee required' });
    }

    return NextResponse.json({ valid: true, discountMinor, coupon: { code: coupon.code, schemeCode: coupon.schemeCodeDenorm, expiresAt: coupon.expiresAt }, scheme: { code: scheme.code, title: scheme.title } });
  } catch (e) {
    if (e instanceof AuthorizationError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error('validate failed', e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
