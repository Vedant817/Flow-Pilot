import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { PromotionScheme } from '@/models/PromotionScheme';
import { matchesSignals } from '@/lib/promotions/engine';
import { computeDiscount } from '@/lib/promotions/pricing';
import { rateLimitAsync } from '@/lib/rate-limit';
import { AuthorizationError, requirePermission } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const limited = await rateLimitAsync(req, { windowMs: 60_000, max: 5, keyPrefix: 'preview' });
  if (!limited.ok)
    return NextResponse.json({ error: 'Rate limit exceeded — preview is expensive, max 5/min' }, { status: 429, headers: { 'Retry-After': String(limited.retryAfterSec) } as any });

  try {
    const authCtx = await requirePermission('promotions:write');
    const body = await req.json();
    // body may be either { schemeId } or inline eligibility to test
    const { schemeId, eligibility } = body ?? {};
    const orgId = authCtx.orgId;

    await dbConnect();

    let scheme: any = null;
    let elig: any = eligibility;
    let benefitPreview: any = null;

    if (schemeId) {
      scheme = await PromotionScheme.findOne({ _id: schemeId, orgId }).lean();
      if (!scheme) return NextResponse.json({ error: 'Scheme not found' }, { status: 404 });
      elig = scheme.eligibility;
      benefitPreview = {
        benefitType: scheme.benefitType,
        benefitValueMinor: scheme.benefitValueMinor,
        maxDiscountMinor: scheme.maxDiscountMinor,
        minimumOrderValueMinor: scheme.minimumOrderValueMinor,
        setupFeeMinor: scheme.setupFeeMinor,
      };
    } else if (!elig) {
      return NextResponse.json({ error: 'Provide schemeId or eligibility' }, { status: 400 });
    } else {
      benefitPreview = {
        benefitType: body.benefitType || 'percent',
        benefitValueMinor: body.benefitValueMinor ?? 500,
        maxDiscountMinor: body.maxDiscountMinor,
        minimumOrderValueMinor: body.minimumOrderValueMinor,
        setupFeeMinor: body.setupFeeMinor,
      };
    }

    const conn = (await dbConnect()).connection.db!;
    const signals = await conn.collection('customer_signals').find({ orgId }).project({
      emailNormalized: 1,
      isRegular: 1,
      isRegularShort: 1,
      isRegularLong: 1,
      isActiveTenured: 1,
      isSlipping: 1,
      isDormantTenured: 1,
      priceEstimated: 1,
      medianInterval: 1,
      recencyDays: 1,
      tenureDays: 1,
      frequency: 1,
      monetaryUnits: 1,
      monetaryValueMinor: 1,
      cv: 1,
      madRatio: 1,
      segment: 1,
      expectedInterval: 1,
      expectedIntervalsExcludedLast: 1,
      insufficientData: 1,
    }).limit(50000).toArray();

    let matched = 0;
    const byCohort: Record<string, number> = { regular: 0, active_tenured: 0, slipping: 0, dormant_tenured: 0 };
    let priceEstimatedFiltered = 0;
    let estimatedLiabilityMinor = 0;
    const holdoutPercent = scheme?.holdoutPercent ?? 10;
    let holdoutCount = 0;
    let powerWarning: string | undefined;

    // Mock eligibility for preview: reuse matchesSignals
    for (const sig of signals) {
      if (elig.excludeEstimated && (sig as any).priceEstimated) {
        priceEstimatedFiltered++;
        continue;
      }
      const tol = elig.cadence?.toleranceMultiplier ?? 1.5;
      const ok = matchesSignals(sig as any, elig, { toleranceOverride: tol });
      if (!ok) continue;
      matched++;
      if ((sig as any).isRegular) byCohort.regular++;
      if ((sig as any).isActiveTenured) byCohort.active_tenured++;
      if ((sig as any).isSlipping) byCohort.slipping++;
      if ((sig as any).isDormantTenured) byCohort.dormant_tenured++;

      // estimate discount per customer
      const avgOrder = (sig as any).frequency > 0 ? Math.round((sig as any).monetaryValueMinor / (sig as any).frequency) : 50000;
      const disc = computeDiscount(
        {
          benefitType: benefitPreview.benefitType,
          benefitValueMinor: benefitPreview.benefitValueMinor,
          maxDiscountMinor: benefitPreview.maxDiscountMinor,
          setupFeeMinor: benefitPreview.setupFeeMinor,
          minimumOrderValueMinor: benefitPreview.minimumOrderValueMinor,
        },
        avgOrder
      );
      estimatedLiabilityMinor += disc;
    }

    holdoutCount = Math.round((matched * holdoutPercent) / 100);
    const treated = matched - holdoutCount;

    if (matched > 0 && matched < 100) powerWarning = `Only ${matched} eligible — CI too wide. Consider 0% holdout or larger cohort.`;
    else if (matched >= 100 && matched < 200) powerWarning = `Small sample (${matched}) — lift estimate noisy.`;

    let liabilityBlocked = false;
    if (estimatedLiabilityMinor > 10_00_000 * 100) { // 10L in paise = 10,00,000*100
      liabilityBlocked = true;
    }

    return NextResponse.json({
      matched,
      treated,
      holdoutCount,
      byCohort,
      priceEstimatedFiltered,
      estimatedLiabilityMinor,
      estimatedLiabilityFormatted: `₹${(estimatedLiabilityMinor / 100).toLocaleString('en-IN')}`,
      holdoutPercent,
      powerWarning,
      liabilityBlocked,
      scheme: scheme ? { _id: String(scheme._id), code: scheme.code, title: scheme.title } : null,
    });
  } catch (e) {
    if (e instanceof AuthorizationError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error('preview failed', e);
    return NextResponse.json({ error: 'Preview failed' }, { status: 500 });
  }
}
