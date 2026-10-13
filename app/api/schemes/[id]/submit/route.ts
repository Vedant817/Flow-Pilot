import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { PromotionScheme } from '@/models/PromotionScheme';
import { PromotionAudit } from '@/models/PromotionAudit';
import { requirePermission } from '@/lib/auth';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let authCtx: any;
  try { authCtx = await requirePermission('promotions:write'); } catch (e: any) { return NextResponse.json({ error: e.message }, { status: e.status || 401 }); }
  const { id } = await params;
  await dbConnect();
  const scheme = await PromotionScheme.findOne({ _id: id, orgId: authCtx.orgId });
  if (!scheme) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (scheme.status !== 'draft' && scheme.status !== 'paused') {
    return NextResponse.json({ error: `Cannot submit from status ${scheme.status}` }, { status: 400 });
  }
  const before = scheme.status;
  scheme.status = 'pending_approval';
  scheme.version = (scheme.version || 0) + 1;
  scheme.updatedBy = authCtx.userId;
  await scheme.save();

  await PromotionAudit.create({
    orgId: scheme.orgId,
    schemeId: scheme._id,
    actorClerkId: authCtx.userId,
    actorEmail: authCtx.email || 'unknown',
    action: 'submit_for_approval',
    before: { status: before },
    after: { status: scheme.status },
    at: new Date(),
  });

  return NextResponse.json({ scheme: { ...scheme.toObject(), _id: String(scheme._id) } });
}
