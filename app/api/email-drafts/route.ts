import { NextRequest, NextResponse } from 'next/server';
import { requireWorkspace, AuthorizationError } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import { InboundOrderDraft } from '@/models/InboundOrderDraft';

export async function GET(request: NextRequest) {
  let ctx;
  try { ctx = await requireWorkspace(); }
  catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unauthorized' },
      { status: error instanceof AuthorizationError ? error.status : 500 });
  }
  const status = new URL(request.url).searchParams.get('status') ?? 'draft';
  if (!['draft', 'confirmed', 'dismissed'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }
  try {
    await dbConnect();
    const drafts = await InboundOrderDraft.find({ orgId: ctx.orgId, status: status as 'draft' | 'confirmed' | 'dismissed' })
      .sort({ createdAt: -1 }).limit(100).lean();
    return NextResponse.json({ drafts });
  } catch (error) {
    console.error('Failed to list inbound order drafts:', error);
    return NextResponse.json({ error: 'Could not load drafts' }, { status: 500 });
  }
}
