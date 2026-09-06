import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { PromotionScheme } from '@/models/PromotionScheme';
import { PromotionAudit } from '@/models/PromotionAudit';
import { getAuthContext, isAdminSecretValid } from '@/lib/auth';

async function requireAuth(req: NextRequest) {
  const ctx = await getAuthContext().catch(() => ({ userId: null as any, email: undefined, orgId: 'default' }));
  if (ctx.userId) return ctx;
  if (isAdminSecretValid(req)) return { userId: 'admin', email: 'admin@system', orgId: 'default' };
  if (process.env.NODE_ENV === 'development' && !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) return { userId: 'dev', email: 'dev@local', orgId: 'default' };
  const err: any = new Error('Unauthorized'); err.status = 401; throw err;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let authCtx: any;
  try { authCtx = await requireAuth(req); } catch (e: any) { return NextResponse.json({ error: e.message }, { status: e.status || 401 }); }
  const { id } = await params;
  await dbConnect();
  const scheme = await PromotionScheme.findById(id);
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
