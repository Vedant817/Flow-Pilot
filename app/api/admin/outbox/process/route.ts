import { NextRequest, NextResponse } from 'next/server';
import { AuthorizationError, requireMaintenanceAccess } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import { drainOutbox } from '@/lib/orders/outbox';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireMaintenanceAccess(request);
    const body = await request.json().catch(() => ({}));
    const limit =
      typeof body?.limit === 'number' && Number.isFinite(body.limit)
        ? Math.floor(body.limit)
        : 25;

    await dbConnect();
    const result = await drainOutbox(auth.orgId, limit);
    return NextResponse.json(result);
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error('Outbox processing failed', error);
    return NextResponse.json(
      { error: 'Outbox processing failed' },
      { status: 500 }
    );
  }
}
