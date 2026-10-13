import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { PromotionScheme } from '@/models/PromotionScheme';
import { PromotionAudit } from '@/models/PromotionAudit';
import { AuthorizationError, requirePermission, requireWorkspace } from '@/lib/auth';
import { rateLimitAsync } from '@/lib/rate-limit';

const MAX_PAGE_SIZE = 100;

function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!domain) return '***';
  return `${user[0]}***@${domain}`;
}

export async function GET(request: NextRequest) {
  try {
    const authCtx = await requireWorkspace();
    await dbConnect();
    const sp = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(sp.get('page') ?? '1', 10) || 1);
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(sp.get('limit') ?? '25', 10) || 25));
    const status = sp.get('status');
    const cohort = sp.get('cohort');
    const q = sp.get('q')?.trim();

    const filter: Record<string, unknown> = { orgId: authCtx.orgId };
    if (status) filter.status = status;
    if (cohort) filter['eligibility.cohorts'] = cohort;
    if (q) {
      const rx = new RegExp(q.slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ code: rx }, { title: rx }];
    }

    const [schemes, total] = await Promise.all([
      PromotionScheme.find(filter)
        .sort({ 'limits.validUntil': -1, priority: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      PromotionScheme.countDocuments(filter),
    ]);

    return NextResponse.json({
      data: schemes.map((s: any) => ({ ...s, _id: String(s._id) })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (e) {
    if (e instanceof AuthorizationError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error('GET /api/schemes failed', e);
    return NextResponse.json({ error: 'Failed to fetch schemes' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const limited = await rateLimitAsync(req, { windowMs: 60_000, max: 10, keyPrefix: 'schemes_post' });
  if (!limited.ok) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers: { 'Retry-After': String(limited.retryAfterSec) } as any });
  }
  let authCtx: any;
  try {
    authCtx = await requirePermission('promotions:write');
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 });
  }

  try {
    const body = await req.json();
    const {
      code, title, description,
      benefitType, benefitValueMinor, maxDiscountMinor, currency,
      applicableProducts, applicableCategories, minimumOrderValueMinor, setupFeeMinor,
      mode, priority, stackable, maxSchemesPerCustomer, exclusiveGroup, holdoutPercent,
      eligibility, limits,
    } = body ?? {};

    if (!code || !title || !benefitType || benefitValueMinor == null || !eligibility || !limits) {
      return NextResponse.json({ error: 'code, title, benefitType, benefitValueMinor, eligibility, limits are required' }, { status: 400 });
    }
    const codeNorm = String(code).toUpperCase().trim();
    if (!/^[A-Z0-9_-]{3,30}$/.test(codeNorm)) {
      return NextResponse.json({ error: 'code must be 3-30 chars A-Z 0-9 _ -' }, { status: 400 });
    }
    if (benefitType === 'percent' && (benefitValueMinor < 0 || benefitValueMinor > 10000)) {
      return NextResponse.json({ error: 'percent benefitValueMinor must be 0-10000 (basis points)' }, { status: 400 });
    }
    if (holdoutPercent != null && (holdoutPercent < 0 || holdoutPercent > 15)) {
      return NextResponse.json({ error: 'holdoutPercent must be 0-15' }, { status: 400 });
    }
    const validFrom = limits.validFrom ? new Date(limits.validFrom) : null;
    const validUntil = limits.validUntil ? new Date(limits.validUntil) : null;
    if (!validFrom || !validUntil || isNaN(validFrom.getTime()) || isNaN(validUntil.getTime()) || validFrom >= validUntil) {
      return NextResponse.json({ error: 'validFrom must be before validUntil and valid dates' }, { status: 400 });
    }
    if (benefitType === 'free_setup' && setupFeeMinor == null && benefitValueMinor === 0) {
      // allow, but we need setupFeeMinor for capping; store 0
    }
    // Estimated liability guard: if percent/fixed without global cap and liability >10L block creation for non-finance (simplified: require maxRedemptionsGlobal if holdoutPercent)
    // For MVP we just warn; enforcement in preview gate.

    await dbConnect();

    const exists = await PromotionScheme.findOne({ orgId: authCtx.orgId, code: codeNorm }).lean();
    if (exists) return NextResponse.json({ error: 'code already exists' }, { status: 409 });

    const scheme = await PromotionScheme.create({
      orgId: authCtx.orgId,
      code: codeNorm,
      title: String(title).slice(0, 120),
      description: String(description || '').slice(0, 500),
      benefitType,
      benefitValueMinor: Number(benefitValueMinor),
      maxDiscountMinor: maxDiscountMinor != null ? Number(maxDiscountMinor) : undefined,
      currency: currency || 'INR',
      applicableProducts,
      applicableCategories,
      minimumOrderValueMinor: minimumOrderValueMinor != null ? Number(minimumOrderValueMinor) : undefined,
      setupFeeMinor: setupFeeMinor != null ? Number(setupFeeMinor) : undefined,
      mode: mode || 'code',
      priority: priority != null ? Number(priority) : 0,
      stackable: !!stackable,
      maxSchemesPerCustomer: maxSchemesPerCustomer != null ? Number(maxSchemesPerCustomer) : 2,
      exclusiveGroup: exclusiveGroup ? String(exclusiveGroup).trim() : undefined,
      holdoutPercent: holdoutPercent != null ? Number(holdoutPercent) : 10,
      eligibility: {
        cohorts: eligibility.cohorts,
        operator: eligibility.operator || 'OR',
        minOrders: Math.max(4, Number(eligibility.minOrders) || 4),
        minTenureDays: Number(eligibility.minTenureDays) || 180,
        maxRecencyDays: Number(eligibility.maxRecencyDays ?? 90),
        excludeEstimated: eligibility.excludeEstimated !== false,
        cadence: eligibility.cadence ? {
          preset: eligibility.cadence.preset || 'strict',
          maxCv: Number(eligibility.cadence.maxCv ?? 0.35),
          maxMadRatio: Number(eligibility.cadence.maxMadRatio ?? 0.25),
          expectedIntervalDays: eligibility.cadence.expectedIntervalDays ? Number(eligibility.cadence.expectedIntervalDays) : undefined,
          toleranceMultiplier: Number(eligibility.cadence.toleranceMultiplier ?? 1.5),
          medianIntervalMin: Number(eligibility.cadence.medianIntervalMin ?? 7),
          medianIntervalMax: Number(eligibility.cadence.medianIntervalMax ?? 60),
        } : {
          preset: 'strict',
          maxCv: 0.35,
          maxMadRatio: 0.25,
          toleranceMultiplier: 1.5,
          medianIntervalMin: 7,
          medianIntervalMax: 60,
        },
        rfmSegments: eligibility.rfmSegments,
        minMonetaryUnits: eligibility.minMonetaryUnits != null ? Number(eligibility.minMonetaryUnits) : undefined,
        minMonetaryValueMinor: eligibility.minMonetaryValueMinor != null ? Number(eligibility.minMonetaryValueMinor) : undefined,
        monetaryMode: eligibility.monetaryMode || 'value',
      },
      limits: {
        maxRedemptionsGlobal: limits.maxRedemptionsGlobal != null ? Number(limits.maxRedemptionsGlobal) : undefined,
        maxRedemptionsPerCustomer: Number(limits.maxRedemptionsPerCustomer ?? 1),
        validFrom,
        validUntil,
      },
      counters: { issued: 0, redeemed: 0, holdout: 0 },
      status: 'draft',
      version: 0,
      createdBy: authCtx.userId,
      createdByEmail: authCtx.email || 'unknown',
    });

    await PromotionAudit.create({
      orgId: authCtx.orgId,
      schemeId: scheme._id,
      actorClerkId: authCtx.userId,
      actorEmail: authCtx.email || 'unknown',
      action: 'create',
      after: scheme.toObject(),
      at: new Date(),
      ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
    });

    return NextResponse.json({ scheme: { ...scheme.toObject(), _id: String(scheme._id) } }, { status: 201 });
  } catch (e: any) {
    console.error('POST /api/schemes failed', e);
    if (e?.code === 11000) return NextResponse.json({ error: 'code already exists' }, { status: 409 });
    return NextResponse.json({ error: e?.message || 'Failed to create scheme' }, { status: 500 });
  }
}
