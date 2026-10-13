import { getDailySeries } from '@/lib/analytics/rollup';

/**
 * EWMA control-chart anomaly detection on daily demand.
 * s_t = λ·x_t + (1−λ)·s_{t−1}; alert when |s_t − μ_s| > k·σ_s.
 * λ=0.3 balances responsiveness vs noise suppression for retail cadence.
 */

export interface AnomalyPoint {
  date: string;
  units: number;
  ewma: number;
  upperLimit: number;
  lowerLimit: number;
  zScore: number;
  direction: 'spike' | 'drop' | null;
}

export interface AnomalyReport {
  series: AnomalyPoint[];
  anomalies: AnomalyPoint[];
  lambda: number;
  kSigma: number;
  baselineMean: number;
}

const LAMBDA = 0.3;
const K_SIGMA = 3;

export function detectAnomalies(dailyUnits: number[], dates: string[]): AnomalyReport {
  const n = dailyUnits.length;
  if (n === 0) {
    return { series: [], anomalies: [], lambda: LAMBDA, kSigma: K_SIGMA, baselineMean: 0 };
  }

  // Welford statistics of prior EWMA values only. The first observation seeds
  // the chart; seven prior observations are required before emitting alerts.
  let ewma = dailyUnits[0];
  let meanEwma = 0;
  let m2 = 0;
  const series: AnomalyPoint[] = dailyUnits.map((units, i) => {
    const center = i === 0 ? 0 : meanEwma;
    const sigma = Math.sqrt(m2 / Math.max(1, i - 1)) || Math.sqrt(Math.max(0, center)) || 1;
    if (i > 0) ewma = LAMBDA * units + (1 - LAMBDA) * ewma;
    const z = i === 0 ? 0 : (ewma - center) / sigma;
    const breached = i >= 7 && Math.abs(z) > K_SIGMA;
    const point: AnomalyPoint = {
      date: dates[i],
      units,
      ewma: round2(ewma),
      upperLimit: round2(center + K_SIGMA * sigma),
      lowerLimit: round2(Math.max(0, center - K_SIGMA * sigma)),
      zScore: round2(z),
      direction: breached ? (z > 0 ? 'spike' : 'drop') : null,
    };
    const delta = ewma - meanEwma;
    meanEwma += delta / (i + 1);
    m2 += delta * (ewma - meanEwma);
    return point;
  });

  return {
    series,
    anomalies: series.filter((p) => p.direction !== null),
    lambda: LAMBDA,
    kSigma: K_SIGMA,
    baselineMean: round2(meanEwma),
  };
}

async function loadDailyTotals(orgId: string, days: number): Promise<{ dates: string[]; units: number[] }> {
  const points = await getDailySeries(orgId, days);
  const byDate = new Map<string, number>();
  for (const p of points) byDate.set(p.date, (byDate.get(p.date) ?? 0) + p.units);

  const dates: string[] = [];
  const units: number[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    dates.push(d);
    units.push(byDate.get(d) ?? 0);
  }
  return { dates, units };
}

export async function detectDemandAnomalies(orgId: string, days = 60): Promise<AnomalyReport> {
  const { dates, units } = await loadDailyTotals(orgId, days);
  return detectAnomalies(units, dates);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
