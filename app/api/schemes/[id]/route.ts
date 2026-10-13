import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { PromotionScheme } from '@/models/PromotionScheme';
import { PromotionAudit } from '@/models/PromotionAudit';
import { AuthorizationError, requirePermission, requireWorkspace } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authCtx = await requireWorkspace();
    const { id } = await params;
    await dbConnect();
    const scheme = await PromotionScheme.findOne({ _id: id, orgId: authCtx.orgId }).lean();
    if (!scheme) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ scheme: { ...scheme, _id: String((scheme as any)._id) } });
  } catch (e) {
    if (e instanceof AuthorizationError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let authCtx: any;
  try {
    authCtx = await requirePermission('promotions:write');
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 401 });
  }
  const { id } = await params;
  const body = await req.json();
  const { version, ...updates } = body ?? {};

  await dbConnect();
  const scheme = await PromotionScheme.findOne({ _id: id, orgId: authCtx.orgId });
  if (!scheme) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (version != null && Number(version) !== scheme.version) {
    return NextResponse.json({ error: 'Version conflict — stale data', currentVersion: scheme.version }, { status: 409 });
  }

  // Prevent status transition via PATCH unless it's draft; use dedicated endpoints
  if (updates.status && updates.status !== scheme.status) {
    if (!['draft', 'paused', 'archived'].includes(updates.status) || !['draft', 'paused'].includes(scheme.status)) {
      return NextResponse.json(
        { error: 'Use the dedicated workflow endpoint for this status transition' },
        { status: 400 }
      );
    }
  }

  const before = scheme.toObject();
  // whitelist fields
  const allowed: any = {};
  const fields = ['title', 'description', 'benefitValueMinor', 'maxDiscountMinor', 'minimumOrderValueMinor', 'setupFeeMinor', 'mode', 'priority', 'stackable', 'holdoutPercent', 'eligibility', 'limits', 'status', 'exclusiveGroup'];
  for (const f of fields) if (updates[f] !== undefined) allowed[f] = updates[f];
  // code immutable after creation
  // increment version
  allowed.version = (scheme.version || 0) + 1;
  allowed.updatedBy = authCtx.userId;

  if (allowed.limits?.validFrom && allowed.limits?.validUntil) {
    const vf = new Date(allowed.limits.validFrom);
    const vu = new Date(allowed.limits.validUntil);
    if (vf >= vu) return NextResponse.json({ error: 'validFrom must be before validUntil' }, { status: 400 });
    allowed.limits.validFrom = vf;
    allowed.limits.validUntil = vu;
  }

  Object.assign(scheme, allowed);
  await scheme.save();

  await PromotionAudit.create({
    orgId: scheme.orgId,
    schemeId: scheme._id,
    actorClerkId: authCtx.userId,
    actorEmail: authCtx.email || 'unknown',
    action: 'update',
    before,
    after: scheme.toObject(),
    at: new Date(),
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
  });

  return NextResponse.json({ scheme: { ...scheme.toObject(), _id: String(scheme._id) } });
}
