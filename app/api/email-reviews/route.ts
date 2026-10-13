import { NextRequest, NextResponse } from 'next/server';
import { requireWorkspace, AuthorizationError } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import { EmailReview } from '@/models/EmailReview';

export async function GET(request: NextRequest) {
  let ctx;
  try { ctx = await requireWorkspace(); }
  catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unauthorized' },
      { status: error instanceof AuthorizationError ? error.status : 500 });
  }
  const status = new URL(request.url).searchParams.get('status') || 'open';
  if (!['open', 'resolved', 'dismissed'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }
  try {
    await dbConnect();
    const reviews = await EmailReview.find({ orgId: ctx.orgId, status: status as 'open' | 'resolved' | 'dismissed' })
      .sort({ createdAt: -1 }).limit(100).lean();
    return NextResponse.json({ reviews });
  } catch (error) {
    console.error('Failed to list email reviews:', error);
    return NextResponse.json({ error: 'Could not load reviews' }, { status: 500 });
  }
}
