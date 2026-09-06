import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { PromotionScheme } from '@/models/PromotionScheme';
import { Coupon } from '@/models/Coupon';
import { SchemeIssueJob } from '@/models/SchemeIssueJob';
import { PromotionAudit } from '@/models/PromotionAudit';
import { matchesSignals } from '@/lib/promotions/engine';
import { isHoldout, generateCouponCode } from '@/lib/promotions/hash';
import { getAuthContext, isAdminSecretValid } from '@/lib/auth';
import { rateLimitAsync } from '@/lib/rate-limit';
import { acquireLock, releaseLock, refreshLock } from '@/lib/distributed-lock';

async function requireAuth(req: NextRequest) {
  const ctx = await getAuthContext().catch(() => ({ userId: null as any, email: undefined, orgId: 'default' }));
  if (ctx.userId) return ctx;
  if (isAdminSecretValid(req)) return { userId: 'cron', email: 'cron@system', orgId: 'default' };
  if (process.env.NODE_ENV === 'development' && !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) return { userId: 'dev', email: 'dev@local', orgId: 'default' };
  const err: any = new Error('Unauthorized'); err.status = 401; throw err;
}

export async function POST(req: NextRequest) {
  const limited = await rateLimitAsync(req, { windowMs: 60_000, max: 5, keyPrefix: 'issue' });
  if (!limited.ok) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers: { 'Retry-After': String(limited.retryAfterSec) } as any });

  let authCtx: any;
  try { authCtx = await requireAuth(req); } catch (e: any) { return NextResponse.json({ error: e.message }, { status: e.status || 401 }); }

  const body = await req.json().catch(() => ({}));
  const schemeId = body.schemeId;
  if (!schemeId) return NextResponse.json({ error: 'schemeId required' }, { status: 400 });

  const lockKey = `issue:${schemeId}`;
  const owner = String(authCtx.userId);
  const locked = await acquireLock(lockKey, 300_000, owner);
  if (!locked) {
    return NextResponse.json({ error: 'Job already running for this scheme' }, { status: 409 });
  }

  try {
    await dbConnect();
    const scheme = await PromotionScheme.findById(schemeId);
    if (!scheme) return NextResponse.json({ error: 'Scheme not found' }, { status: 404 });
    if (scheme.status !== 'active') return NextResponse.json({ error: `Scheme must be active, current ${scheme.status}` }, { status: 400 });

    // Check global cap
    if (scheme.limits.maxRedemptionsGlobal != null && scheme.counters.redeemed >= scheme.limits.maxRedemptionsGlobal) {
      return NextResponse.json({ error: 'Global cap already reached' }, { status: 400 });
    }

    const orgId = (scheme as any).orgId || 'default';

    // Create job
    const job = await SchemeIssueJob.create({
      orgId,
      schemeId: scheme._id,
      status: 'running',
      totalEligible: 0,
      issued: 0,
      holdout: 0,
      failed: 0,
      startedBy: authCtx.userId,
      startedAt: new Date(),
    });

    // Background issuance — we run synchronously but in chunks to avoid 60s timeout for moderate size
    // For large 50k, this would need background worker; we implement chunked with yield
    const conn = (await dbConnect()).connection.db!;
    const signals = await conn
      .collection('customer_signals')
      .find({ orgId })
      .project({
        emailNormalized: 1,
        isRegular: 1,
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
      })
      .limit(50000)
      .toArray();

    let eligible: any[] = [];
    for (const sig of signals) {
      if ((scheme as any).eligibility.excludeEstimated && (sig as any).priceEstimated) continue;
      const tol = (scheme as any).eligibility?.cadence?.toleranceMultiplier ?? 1.5;
      if (!matchesSignals(sig as any, (scheme as any).eligibility, { toleranceOverride: tol })) continue;
      eligible.push(sig);
    }

    // Apply global cap limit: don't issue beyond maxGlobal
    const remainingGlobal = scheme.limits.maxRedemptionsGlobal != null ? scheme.limits.maxRedemptionsGlobal - scheme.counters.redeemed : Infinity;
    if (eligible.length > remainingGlobal) {
      // deterministic sort by email to have stable selection
      eligible.sort((a: any, b: any) => String(a.emailNormalized).localeCompare(String(b.emailNormalized)));
      eligible = eligible.slice(0, remainingGlobal);
    }

    job.totalEligible = eligible.length;
    await job.save();

    let issued = 0;
    let holdout = 0;
    let failed = 0;
    const failedEmails: string[] = [];
    const BATCH = 500;

    // Pre-check existing coupons for this scheme to respect per-customer cap
    const existingCoupons = await conn
      .collection('coupons')
      .find({ orgId, schemeId: scheme._id, status: { $in: ['issued', 'redeemed', 'holdout'] } }, { projection: { emailNormalized: 1 } })
      .toArray();
    const existingSet = new Set(existingCoupons.map((c: any) => String(c.emailNormalized).toLowerCase()));

    // Chunked bulkWrite 500
    for (let i = 0; i < eligible.length; i += BATCH) {
      const chunk = eligible.slice(i, i + BATCH);
      const ops: any[] = [];
      let chunkHoldout = 0;
      let chunkIssued = 0;
      for (const sig of chunk) {
        const emailNorm = String((sig as any).emailNormalized).toLowerCase().trim();
        if (existingSet.has(emailNorm)) {
          continue; // already has coupon for this scheme (lifetime cap)
        }
        // Check maxSchemesPerCustomer: count active coupons across schemes for this email
        if ((scheme as any).maxSchemesPerCustomer != null) {
          const cnt = await conn.collection('coupons').countDocuments({ orgId, emailNormalized: emailNorm, status: { $in: ['issued', 'redeemed'] } });
          if (cnt >= (scheme as any).maxSchemesPerCustomer) continue;
        }

        const holdoutFlag = isHoldout(String(scheme._id), emailNorm, (scheme as any).holdoutPercent ?? 10);
        if (holdoutFlag) {
          ops.push({
            updateOne: {
              filter: { orgId, emailNormalized: emailNorm, schemeId: scheme._id },
              update: {
                $setOnInsert: {
                  code: `HOLDOUT-${emailNorm.slice(0, 6).toUpperCase()}`,
                  schemeId: scheme._id,
                  schemeCodeDenorm: (scheme as any).code,
                  orgId,
                  email: emailNorm,
                  emailNormalized: emailNorm,
                  benefitSnapshot: {
                    type: (scheme as any).benefitType,
                    valueMinor: (scheme as any).benefitValueMinor,
                    maxDiscountMinor: (scheme as any).maxDiscountMinor,
                    setupFeeMinor: (scheme as any).setupFeeMinor,
                  },
                  status: 'holdout',
                  issuedAt: new Date(),
                  expiresAt: (scheme as any).limits.validUntil,
                },
              },
              upsert: true,
            },
          });
          chunkHoldout++;
          existingSet.add(emailNorm);
        } else {
          let code: string;
          let attempts = 0;
          do {
            code = generateCouponCode((scheme as any).code, 12);
            attempts++;
          } while (attempts < 3 && existingSet.has(code)); // unlikely collision

          ops.push({
            updateOne: {
              filter: { orgId, emailNormalized: emailNorm, schemeId: scheme._id },
              update: {
                $setOnInsert: {
                  code,
                  schemeId: scheme._id,
                  schemeCodeDenorm: (scheme as any).code,
                  orgId,
                  email: emailNorm,
                  emailNormalized: emailNorm,
                  benefitSnapshot: {
                    type: (scheme as any).benefitType,
                    valueMinor: (scheme as any).benefitValueMinor,
                    maxDiscountMinor: (scheme as any).maxDiscountMinor,
                    setupFeeMinor: (scheme as any).setupFeeMinor,
                  },
                  status: 'issued',
                  issuedAt: new Date(),
                  expiresAt: (scheme as any).limits.validUntil,
                },
              },
              upsert: true,
            },
          });
          chunkIssued++;
          existingSet.add(emailNorm);
        }
      }

      if (ops.length === 0) continue;
      try {
        const res = await conn.collection('coupons').bulkWrite(ops as any, { ordered: false } as any);
        const inserted = (res as any).upsertedCount ?? 0;
        // Approximation: issued vs holdout proportion
        // We track via inserted; split ratio
        issued += chunkIssued > 0 ? Math.round((inserted * chunkIssued) / ops.length) : 0;
        holdout += chunkHoldout > 0 ? Math.round((inserted * chunkHoldout) / ops.length) : 0;
        // For more accuracy, we increment by inserted split
      } catch (e: any) {
        // bulkWrite duplicate key errors are expected for already-existing; count as failed
        if (e?.code === 11000) {
          // partial success already counted via upsertedCount; estimate failed
          failed += 1;
        } else {
          console.warn('bulkWrite chunk failed', e?.message);
          failed += chunk.length;
          failedEmails.push(...chunk.slice(0, 3).map((c: any) => c.emailNormalized));
        }
      }
      // heartbeat — extend lock TTL each batch
      await refreshLock(lockKey, 300_000, owner).catch(() => {});
    }

    // Update counters
    await PromotionScheme.updateOne(
      { _id: scheme._id },
      { $inc: { 'counters.issued': issued, 'counters.holdout': holdout } }
    );

    job.issued = issued;
    job.holdout = holdout;
    job.failed = failed;
    job.failedEmails = failedEmails.slice(0, 10);
    job.status = 'completed';
    job.completedAt = new Date();
    await job.save();

    await PromotionAudit.create({
      orgId,
      schemeId: scheme._id,
      actorClerkId: authCtx.userId,
      actorEmail: authCtx.email || 'unknown',
      action: 'issue_batch',
      after: { issued, holdout, totalEligible: eligible.length },
      at: new Date(),
      jobId: String(job._id),
    });

    return NextResponse.json({
      jobId: String(job._id),
      totalEligible: eligible.length,
      issued,
      holdout,
      failed,
    });
  } catch (e: any) {
    console.error('issue failed', e);
    return NextResponse.json({ error: e?.message || 'Issue failed' }, { status: 500 });
  } finally {
    await releaseLock(lockKey, owner).catch(() => {});
  }
}
