'use client';
import { useCallback, useEffect, useState } from 'react';

type Prediction = { horizon: number; value: number; lower: number | null; upper: number | null; calibrationSamples: number };
type Forecast = {
  product: string; productId: string; current_stock: number; recommended_stock: number;
  urgency_level: string; days_until_stockout: number | null; confidence_score: number | null;
  historicalEvidenceDays: number; predictions: Prediction[];
  validation: { samples: number; mae: number | null; wape: number | null; empiricalCoverage: number | null };
  reasons: string[]; recommendations: string[];
};
type Report = { urgent_restocking: Forecast[]; pagination: { nextCursor: string | null };
  generated_at: string; scope: { basis: string; confidenceBasis: string; costBasis: string; leadTimeAssumptionDays: number } };

export default function InventoryForecasting() {
  const [report, setReport] = useState<Report | null>(null);
  const [rows, setRows] = useState<Forecast[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const load = useCallback(async (after?: string) => {
    setLoading(true); setError('');
    try {
      const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || '/api';
      const response = await fetch(`${base}/analytics/forecasting${after ? `?after=${encodeURIComponent(after)}` : ''}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Forecast unavailable');
      setReport(data); setRows(previous => after ? [...previous, ...data.urgent_restocking] : data.urgent_restocking);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Forecast unavailable'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  return <section className="mx-auto max-w-6xl space-y-5 p-4 md:p-8">
    <a href="/inventory" className="text-sm underline">Back to inventory</a>
    <header className="flex items-center justify-between gap-3">
      <h1 className="text-2xl font-semibold">Demand forecasts and validation</h1>
      <button disabled={loading} onClick={() => void load()} className="rounded border border-border px-4 py-2">Refresh</button>
    </header>
    {error && <p role="alert" className="rounded border border-red-500 p-3">{error}</p>}
    {loading && <p role="status">Computing forecasts…</p>}
    {report && <div className="space-y-2 rounded-xl border border-border bg-card p-4 text-sm">
      <p>{report.scope.basis}. Loaded catalog items: {rows.length}.</p>
      <p>{report.scope.confidenceBasis}. Intervals are empirical, not guaranteed probabilities.</p>
      <p>Unmapped legacy order lines are excluded and require catalog reconciliation. Historical zeros are filled only after known item existence or first observed demand.</p>
      <p>Planning lead-time assumption: {report.scope.leadTimeAssumptionDays} days. {report.scope.costBasis}.</p>
      <p>Generated: {new Date(report.generated_at).toLocaleString()}</p>
    </div>}
    <div className="grid gap-4 lg:grid-cols-2">
      {rows.map(row => <article key={row.productId} className="space-y-3 rounded-xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-3"><h2 className="font-semibold">{row.product}</h2>
          <span className="rounded border px-2 py-1 text-xs">{row.urgency_level}</span></div>
        <p className="text-sm">Available stock: {row.current_stock} · Historical evidence: {row.historicalEvidenceDays} days</p>
        <p className="text-sm">Projected stockout: {row.days_until_stockout === null ? 'Unavailable / no observed positive demand' : `${row.days_until_stockout} days`}</p>
        <p className="text-sm">Held-out MAE: {row.validation.mae?.toFixed(2) ?? 'Unavailable'} · samples: {row.validation.samples}</p>
        <p className="text-sm">Empirical interval coverage: {row.confidence_score === null ? 'Unavailable' : `${Math.round(row.confidence_score * 100)}%`}</p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs"><caption className="mb-2 text-left">Forecast horizons (units)</caption>
            <thead><tr><th>Day</th><th>Expected</th><th>Lower</th><th>Upper</th><th>Calibration samples</th></tr></thead>
            <tbody>{row.predictions.filter(value => [1, 7, 14, 30].includes(value.horizon)).map(value =>
              <tr key={value.horizon}><td>{value.horizon}</td><td>{value.value.toFixed(1)}</td>
                <td>{value.lower?.toFixed(1) ?? 'N/A'}</td><td>{value.upper?.toFixed(1) ?? 'N/A'}</td><td>{value.calibrationSamples}</td></tr>)}</tbody>
          </table>
        </div>
        {row.reasons.map(reason => <p key={reason} className="text-xs text-muted-foreground">{reason}</p>)}
        {row.recommendations.map(reason => <p key={reason} className="text-xs text-muted-foreground">{reason}</p>)}
        <a href={`/inventory/${row.productId}/stock`} className="text-sm underline">Inspect stock ledger</a>
      </article>)}
    </div>
    {report && !rows.length && !loading && !error && <p>No catalog items on this page.</p>}
    {report?.pagination.nextCursor && <button disabled={loading}
      onClick={() => void load(report.pagination.nextCursor!)} className="rounded border border-border px-4 py-2">Load next catalog page</button>}
  </section>;
}
