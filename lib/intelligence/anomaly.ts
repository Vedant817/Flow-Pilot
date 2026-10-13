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

  // Phase 1: warm-up window establishes baseline μ/σ from first half.
  const warmup = Math.max(7, Math.floor(n / 2));
  let ewma = dailyUnits.slice(0, warmup).reduce((a, b) => a + b, 0) / warmup;
  const baselineMean = ewma;

  const ewmaValues: number[] = [];
  for (let i = 0; i < n; i++) {
    ewma = LAMBDA * dailyUnits[i] + (1 - LAMBDA) * ewma;
    ewmaValues.push(ewma);
  }

  const meanEwma = ewmaValues.reduce((a, b) => a + b, 0) / n;
  const variance =
    ewmaValues.reduce((acc, v) => acc + (v - meanEwma) ** 2, 0) / Math.max(1, n - 1);
  const sigma = Math.sqrt(variance) || Math.sqrt(baselineMean) || 1;

  const series: AnomalyPoint[] = dates.map((date, i) => {
    const z = sigma > 0 ? (ewmaValues[i] - meanEwma) / sigma : 0;
    const breached = Math.abs(z) > K_SIGMA;
    return {
      date,
      units: dailyUnits[i],
      ewma: round2(ewmaValues[i]),
      upperLimit: round2(meanEwma + K_SIGMA * sigma),
      lowerLimit: round2(Math.max(0, meanEwma - K_SIGMA * sigma)),
      zScore: round2(z),
      direction: breached ? (z > 0 ? 'spike' : 'drop') : null,
    };
  });

  return {
    series,
    anomalies: series.filter((p) => p.direction !== null),
    lambda: LAMBDA,
    kSigma: K_SIGMA,
    baselineMean: round2(baselineMean),
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
