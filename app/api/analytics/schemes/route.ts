import { NextRequest, NextResponse } from 'next/server';
import { getSchemeAnalytics } from '@/lib/promotions/analytics';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const orgId = 'default';
    const data = await getSchemeAnalytics(orgId);
    const totalIssued = data.reduce((s, r) => s + r.issued, 0);
    const totalRedeemed = data.reduce((s, r) => s + r.redeemed, 0);
    const totalIncremental = data.reduce((s, r) => s + r.incrementalRevenueMinor, 0);
    return NextResponse.json({
      schemes: data,
      summary: {
        totalIssued,
        totalRedeemed,
        redemptionRate: totalIssued ? Math.round((totalRedeemed / totalIssued) * 10000) / 100 : 0,
        totalIncrementalMinor: totalIncremental,
        totalIncrementalFormatted: `₹${(totalIncremental / 100).toLocaleString('en-IN')}`,
      },
    });
  } catch (e) {
    console.error('analytics/schemes failed', e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
