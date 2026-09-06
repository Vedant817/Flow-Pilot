import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { PromotionScheme } from '@/models/PromotionScheme';
import { Coupon } from '@/models/Coupon';
import { fetchCustomerSignals } from '@/lib/promotions/eligibility';
import { matchesSignals } from '@/lib/promotions/engine';
import { rateLimitAsync } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const limited = await rateLimitAsync(req, { windowMs: 60_000, max: 60, keyPrefix: 'eligible' });
  if (!limited.ok) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers: { 'Retry-After': String(limited.retryAfterSec) } as any });

  const email = req.nextUrl.searchParams.get('email')?.toLowerCase().trim();
  if (!email || !email.includes('@')) return NextResponse.json({ error: 'email query required' }, { status: 400 });

  try {
    await dbConnect();
    const orgId = 'default';
    const emailNormalized = email.toLowerCase().trim();
    const signal = await fetchCustomerSignals(orgId, emailNormalized);
    if (!signal) return NextResponse.json({ email: emailNormalized, eligible: [], signal: null, reason: 'No orders for this email' });

    const now = new Date();
    const activeSchemes = await PromotionScheme.find({
      orgId,
      status: 'active',
      'limits.validFrom': { $lte: now },
      'limits.validUntil': { $gte: now },
    })
      .sort({ priority: -1, 'limits.validFrom': 1, code: 1 })
      .lean();

    const matched: any[] = [];
    for (const s of activeSchemes as any[]) {
      // check global cap not exceeded
      if (s.limits?.maxRedemptionsGlobal != null && s.counters?.redeemed >= s.limits.maxRedemptionsGlobal) continue;
      const tolerance = s.eligibility?.cadence?.toleranceMultiplier;
      if (!matchesSignals(signal, s.eligibility, { toleranceOverride: tolerance })) continue;

      // check per-customer cap: already has coupon issued/redeemed/holdout?
      const existing = await Coupon.findOne({
        orgId,
        emailNormalized,
        schemeId: s._id,
        status: { $in: ['issued', 'redeemed', 'holdout'] },
      }).lean();
      const hasActive = !!existing;
      // allow multiple if maxSchemesPerCustomer not hit and not same scheme; for same scheme, block if already has
      if (hasActive) continue;

      matched.push({
        schemeId: String(s._id),
        code: s.code,
        title: s.title,
        benefitType: s.benefitType,
        benefitValueMinor: s.benefitValueMinor,
        maxDiscountMinor: s.maxDiscountMinor,
        validUntil: s.limits.validUntil,
        existingCoupon: null,
      });
    }

    // Also list already-issued coupons for this email
    const coupons = await Coupon.find({ orgId, emailNormalized, status: { $in: ['issued', 'redeemed'] } })
      .sort({ issuedAt: -1 })
      .limit(10)
      .lean();

    return NextResponse.json({
      email: emailNormalized,
      signal: {
        recencyDays: signal.recencyDays,
        tenureDays: signal.tenureDays,
        frequency: signal.frequency,
        monetaryValueMinor: signal.monetaryValueMinor,
        priceEstimated: signal.priceEstimated,
        isRegular: signal.isRegular,
        isRegularShort: signal.isRegularShort,
        isRegularLong: signal.isRegularLong,
        isActiveTenured: signal.isActiveTenured,
        isSlipping: signal.isSlipping,
        isDormantTenured: signal.isDormantTenured,
        medianInterval: signal.medianInterval,
        cv: signal.cv,
        madRatio: signal.madRatio,
        segment: signal.segment,
        insufficientData: signal.insufficientData,
      },
      matched,
      coupons: coupons.map((c: any) => ({ code: c.code, schemeCode: c.schemeCodeDenorm, status: c.status, expiresAt: c.expiresAt })),
    });
  } catch (e) {
    console.error('eligible failed', e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
