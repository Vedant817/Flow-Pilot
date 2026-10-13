import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { PromotionScheme } from '@/models/PromotionScheme';
import { PromotionAudit } from '@/models/PromotionAudit';
import { requirePermission } from '@/lib/auth';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let authCtx: any;
  try { authCtx = await requirePermission('promotions:approve'); } catch (e: any) { return NextResponse.json({ error: e.message }, { status: e.status || 401 }); }
  const { id } = await params;
  await dbConnect();
  const scheme = await PromotionScheme.findOne({ _id: id, orgId: authCtx.orgId });
  if (!scheme) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (scheme.status !== 'pending_approval') {
    return NextResponse.json({ error: `Can only approve from pending_approval, current ${scheme.status}` }, { status: 400 });
  }
  if (scheme.createdBy === authCtx.userId) {
    return NextResponse.json({ error: 'Approver must differ from creator (two-person rule)' }, { status: 400 });
  }
  const before = scheme.status;
  scheme.status = 'active';
  scheme.approvedBy = authCtx.userId;
  scheme.approvedAt = new Date();
  scheme.version = (scheme.version || 0) + 1;
  scheme.updatedBy = authCtx.userId;
  await scheme.save();

  await PromotionAudit.create({
    orgId: scheme.orgId,
    schemeId: scheme._id,
    actorClerkId: authCtx.userId,
    actorEmail: authCtx.email || 'unknown',
    action: 'approve',
    before: { status: before },
    after: { status: scheme.status },
    at: new Date(),
  });

  return NextResponse.json({ scheme: { ...scheme.toObject(), _id: String(scheme._id) } });
}
