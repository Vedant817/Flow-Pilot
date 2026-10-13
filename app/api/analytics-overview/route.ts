import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { AuthorizationError, requireWorkspace } from '@/lib/auth';
import { buildOverview } from '@/lib/analytics/overview';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireWorkspace();
    const days = Math.min(365, Math.max(7, Math.floor(Number(request.nextUrl.searchParams.get('days')) || 30)));
    const conn = await dbConnect();
    const customerDetails = ['admin', 'finance', 'commercial', 'warehouse', 'operator'].includes(auth.role);
    return NextResponse.json(await buildOverview(conn.connection.db!, auth.orgId, days, customerDetails),
      { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Analytics overview unavailable', error instanceof Error ? error.name : 'UnknownError');
    return NextResponse.json({ error: 'Analytics could not be verified' }, { status: 503 });
  }
}
