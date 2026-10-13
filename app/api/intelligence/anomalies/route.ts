import { NextResponse } from 'next/server';
import { detectDemandAnomalies } from '@/lib/intelligence/anomaly';
import { AuthorizationError, requireWorkspace } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const authCtx = await requireWorkspace();
    const report = await detectDemandAnomalies(authCtx.orgId, 60);
    return NextResponse.json({
      anomalies: report.anomalies,
      latest: report.series[report.series.length - 1] ?? null,
      baselineMean: report.baselineMean,
      lambda: report.lambda,
      kSigma: report.kSigma,
      series: report.series.slice(-30),
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Anomaly detection failed:', error);
    return NextResponse.json({ error: 'Anomaly detection failed' }, { status: 500 });
  }
}
