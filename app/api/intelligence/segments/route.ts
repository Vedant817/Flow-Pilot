import { NextResponse } from 'next/server';
import { computeSegments } from '@/lib/intelligence/rfm';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const segments = await computeSegments();
    const bySegment: Record<string, number> = {};
    for (const s of segments) bySegment[s.segment] = (bySegment[s.segment] ?? 0) + 1;

    return NextResponse.json({
      totalCustomers: segments.length,
      bySegment,
      topByMonetary: segments.slice(0, 10),
      atRisk: segments.filter((s) => s.segment === 'At Risk').slice(0, 15),
    });
  } catch (error) {
    console.error('RFM segmentation failed:', error);
    return NextResponse.json({ error: 'Segmentation failed' }, { status: 500 });
  }
}
