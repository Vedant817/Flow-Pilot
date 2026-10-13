import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';
import { requireWorkspace, AuthorizationError } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import { forecastPage } from '@/lib/analytics/forecast-report';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireWorkspace();
    const cursor = request.nextUrl.searchParams.get('after') ?? undefined;
    if (cursor && !mongoose.isValidObjectId(cursor)) return NextResponse.json({ error: 'Invalid cursor' }, { status: 400 });
    const limit = Math.min(100, Math.max(1, Math.floor(Number(request.nextUrl.searchParams.get('limit')) || 50)));
    await dbConnect();
    return NextResponse.json(await forecastPage(auth.orgId, cursor, limit),
      { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Forecast unavailable', error instanceof Error ? error.name : 'UnknownError');
    return NextResponse.json({ error: 'Forecast could not be verified' }, { status: 503 });
  }
}
