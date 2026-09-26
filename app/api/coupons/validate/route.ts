import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Coupon } from '@/models/Coupon';
import { PromotionScheme } from '@/models/PromotionScheme';
import { computeDiscount } from '@/lib/promotions/pricing';
import { rateLimitAsync } from '@/lib/rate-limit';

const GENERIC_REASON = 'Invalid or ineligible code';

interface CouponLean {
  schemeId?: unknown;
  status?: string;
  expiresAt?: string | Date;
  emailNormalized?: string;
  code?: string;
  schemeCodeDenorm?: string;
}

interface SchemeLean {
  status?: string;
  benefitType?: string;
  benefitValueMinor?: number;
  maxDiscountMinor?: number;
  setupFeeMinor?: number;
  minimumOrderValueMinor?: number;
  limits?: {
    validFrom?: string | Date;
    validUntil?: string | Date;
    maxRedemptionsGlobal?: number;
  };
  counters?: { redeemed?: number };
  code?: string;
  title?: string;
}

export async function POST(req: NextRequest) {
  const limited = await rateLimitAsync(req, { windowMs: 60_000, max: 30, keyPrefix: 'coupon_validate' });
  if (!limited.ok) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers: { 'Retry-After': String(limited.retryAfterSec) } });
  }

  try {
    const body = await req.json();
    const { code, email, orderValueMinor } = body ?? {};
    if (!code) return NextResponse.json({ error: 'code required' }, { status: 400 });
    const orderVal = Number(orderValueMinor);
    if (orderValueMinor == null || !Number.isFinite(orderVal) || orderVal <= 0) {
      return NextResponse.json({ error: 'orderValueMinor required' }, { status: 400 });
    }
    const normalizedCode = String(code).toUpperCase().trim();
    const normalizedEmail = email ? String(email).toLowerCase().trim() : undefined;
    const now = new Date();

    await dbConnect();
    const coupon = (await Coupon.findOne({ code: normalizedCode }).lean()) as unknown as CouponLean | null;
    // Always perform both lookups to keep timing uniform (no early-return oracle).
    // When the coupon is missing we still issue a scheme read so hit/miss cost is similar.
    const scheme = coupon?.schemeId
      ? ((await PromotionScheme.findById(coupon.schemeId).lean()) as unknown as SchemeLean | null)
      : ((await PromotionScheme.findOne().lean()) as unknown as null);
    const effectiveScheme: SchemeLean | null = coupon?.schemeId ? (scheme as SchemeLean | null) : null;

    if (!coupon) {
      return NextResponse.json({ valid: false, reason: GENERIC_REASON }, { status: 200 });
    }

    if (coupon.status !== 'issued') {
      return NextResponse.json({ valid: false, reason: GENERIC_REASON });
    }
    if (!coupon.expiresAt || new Date(coupon.expiresAt) < now) {
      return NextResponse.json({ valid: false, reason: GENERIC_REASON });
    }
    if (coupon.emailNormalized) {
      if (!normalizedEmail) {
        return NextResponse.json({ valid: false, reason: 'Email required — coupon is bound to a customer' });
      }
      if (coupon.emailNormalized !== normalizedEmail) {
        return NextResponse.json({ valid: false, reason: GENERIC_REASON });
      }
    }

    if (!effectiveScheme) return NextResponse.json({ valid: false, reason: GENERIC_REASON });
    if (effectiveScheme.status !== 'active') return NextResponse.json({ valid: false, reason: GENERIC_REASON });
    if (effectiveScheme.limits?.validFrom && new Date(effectiveScheme.limits.validFrom) > now) return NextResponse.json({ valid: false, reason: GENERIC_REASON });
    if (effectiveScheme.limits?.validUntil && new Date(effectiveScheme.limits.validUntil) < now) return NextResponse.json({ valid: false, reason: GENERIC_REASON });
    if (effectiveScheme.limits?.maxRedemptionsGlobal != null && (effectiveScheme.counters?.redeemed ?? 0) >= effectiveScheme.limits.maxRedemptionsGlobal) {
      return NextResponse.json({ valid: false, reason: GENERIC_REASON });
    }
    if (!effectiveScheme.benefitType || effectiveScheme.benefitValueMinor == null) {
      return NextResponse.json({ valid: false, reason: GENERIC_REASON });
    }

    const orderValChecked = orderVal;
    if (effectiveScheme.minimumOrderValueMinor && orderValChecked < effectiveScheme.minimumOrderValueMinor) {
      return NextResponse.json({ valid: false, reason: `Minimum order value ₹${effectiveScheme.minimumOrderValueMinor / 100} required` });
    }

    const discountMinor = computeDiscount(
      {
        benefitType: effectiveScheme.benefitType,
        benefitValueMinor: effectiveScheme.benefitValueMinor,
        maxDiscountMinor: effectiveScheme.maxDiscountMinor,
        setupFeeMinor: effectiveScheme.setupFeeMinor,
        minimumOrderValueMinor: effectiveScheme.minimumOrderValueMinor,
      },
      orderValChecked
    );

    if (effectiveScheme.benefitType === 'free_setup' && discountMinor === 0) {
      return NextResponse.json({ valid: false, reason: GENERIC_REASON });
    }

    return NextResponse.json({ valid: true, discountMinor, coupon: { code: coupon.code, schemeCode: coupon.schemeCodeDenorm, expiresAt: coupon.expiresAt }, scheme: { code: effectiveScheme.code, title: effectiveScheme.title } });
  } catch (e) {
    console.error('validate failed', e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
