import { dbConnect } from '@/lib/mongodb';
import { normalizeEmail, normalizeNameKey } from '@/lib/auth';

// --- Regularity math (winsorized, population stddev, even-n median) ---

export interface RegularityResult {
  insufficient: boolean;
  cv: number;
  madRatio: number;
  median: number;
  mean: number;
  maxInterval: number;
  p90: number;
  isRegularStrict: boolean;
  isRegularRelaxed: boolean;
  seasonality: 'stable' | 'bursty' | 'seasonal' | 'insufficient';
}

export function computeRegularity(distinctIntervalsDays: number[]): RegularityResult {
  if (distinctIntervalsDays.length < 3) {
    return {
      insufficient: true,
      cv: Infinity,
      madRatio: Infinity,
      median: 0,
      mean: 0,
      maxInterval: distinctIntervalsDays.length ? Math.max(...distinctIntervalsDays) : 0,
      p90: 0,
      isRegularStrict: false,
      isRegularRelaxed: false,
      seasonality: 'insufficient',
    };
  }
  const sorted = [...distinctIntervalsDays].sort((a, b) => a - b);
  const n = sorted.length;
  // Winsorization: for small n (<10) clamp 1 smallest + 1 largest to avoid outlier skew (e.g., 30,30,30,30,90)
  let lo: number;
  let hi: number;
  if (n < 10) {
    lo = sorted[1] ?? sorted[0];
    hi = sorted[n - 2] ?? sorted[n - 1];
  } else {
    lo = sorted[Math.floor(n * 0.1)];
    hi = sorted[Math.floor(n * 0.9)];
  }
  const winsorized = distinctIntervalsDays.map((x) => Math.min(hi, Math.max(lo, x)));
  const mean = winsorized.reduce((a, b) => a + b, 0) / winsorized.length;
  if (mean === 0) {
    return {
      insufficient: true,
      cv: Infinity,
      madRatio: Infinity,
      median: 0,
      mean: 0,
      maxInterval: Math.max(...distinctIntervalsDays),
      p90: hi,
      isRegularStrict: false,
      isRegularRelaxed: false,
      seasonality: 'bursty',
    };
  }
  const variance = winsorized.reduce((s, x) => s + (x - mean) ** 2, 0) / winsorized.length;
  const cv = Math.sqrt(variance) / mean;
  // even-n median avg
  const mid = sorted.length / 2;
  const median =
    sorted.length % 2 === 1 ? sorted[Math.floor(mid)] : (sorted[mid - 1] + sorted[mid]) / 2;
  const absDevs = winsorized.map((x) => Math.abs(x - median)).sort((a, b) => a - b);
  const mad =
    absDevs.length % 2 === 1
      ? absDevs[Math.floor(mid)]
      : (absDevs[mid - 1] + absDevs[mid]) / 2;
  const madRatio = median ? mad / median : Infinity;
  const maxInterval = Math.max(...distinctIntervalsDays);
  const p90 = sorted[Math.floor(sorted.length * 0.9)];

  const strict = cv < 0.35 && madRatio < 0.25 && maxInterval < 2.5 * median;
  const relaxed = cv < 0.5 && madRatio < 0.35 && maxInterval < 3.5 * median;

  const isRegularStrict = strict && median >= 7 && median <= 60;
  const isRegularRelaxed = relaxed && median >= 7 && median <= 120;
  // Long-cycle quarterly: 61-120 inclusive closes dead zone 61-74; requires robust thresholds
  const isRegularLongStrict = cv < 0.35 && madRatio < 0.25 && maxInterval < 2.5 * median && median >= 61 && median <= 120;
  const isSeasonal = (median >= 61 && median <= 120 && cv < 0.35) || (median >= 75 && median <= 120 && cv < 0.5);

  const seasonality: RegularityResult['seasonality'] = isSeasonal
    ? 'seasonal'
    : cv > 0.6
      ? 'bursty'
      : 'stable';

  // isRegularRelaxed now covers 7-120 for relaxed preset; isRegularStrict stays 7-60 for strict
  return {
    insufficient: false,
    cv,
    madRatio,
    median,
    mean,
    maxInterval,
    p90,
    isRegularStrict,
    isRegularRelaxed,
    seasonality,
  };
}

export function parseIST(dateStr: string, timeStr: string): Date {
  try {
    const d = (dateStr || new Date().toISOString().slice(0, 10)).trim();
    const t = (timeStr || '00:00').trim();
    const iso = `${d}T${t}:00+05:30`;
    const dt = new Date(iso);
    if (isNaN(dt.getTime())) return new Date(`${d}T00:00:00.000Z`);
    return dt;
  } catch {
    return new Date();
  }
}

export function distinctDatesToIntervals(dateTimes: Date[]): number[] {
  if (dateTimes.length < 2) return [];
  // collapse same IST day — orderedAt is UTC, bucket by Asia/Kolkata midnight
  const byDay = new Map<string, number>();
  for (const d of dateTimes) {
    // IST offset +5:30 = 19800000 ms
    const key = new Date(d.getTime() + 19800000).toISOString().slice(0, 10);
    if (!byDay.has(key)) byDay.set(key, d.getTime());
  }
  const sortedDays = [...byDay.keys()].sort();
  if (sortedDays.length < 2) return [];
  const intervals: number[] = [];
  for (let i = 1; i < sortedDays.length; i++) {
    const prev = new Date(sortedDays[i - 1] + 'T00:00:00Z').getTime();
    const cur = new Date(sortedDays[i] + 'T00:00:00Z').getTime();
    const diffDays = Math.round((cur - prev) / 86400000);
    intervals.push(diffDays);
  }
  return intervals;
}

export interface CustomerSignalInput {
  orgId: string;
  email: string;
  emailNormalized: string;
  name: string;
  orders: Array<{ orderedAt: Date; date: string; time: string; products: Array<{ quantity: number; unitPrice?: number; nameKey?: string }> }>;
  priceEstimated?: boolean;
}

export interface ComputedSignal {
  firstOrder: Date;
  lastOrder: Date;
  tenureDays: number;
  recencyDays: number;
  frequency: number;
  monetaryUnits: number;
  monetaryValueMinor: number;
  priceEstimated: boolean;
  intervals: number[];
  meanInterval: number;
  medianInterval: number;
  stddev: number;
  cv: number;
  mad: number;
  madRatio: number;
  maxInterval: number;
  p90Interval: number;
  expectedInterval: number;
  expectedIntervalsExcludedLast: number | null;
  isRegular: boolean;
  isRegularShort: boolean;
  isRegularLong: boolean;
  isActiveTenured: boolean;
  isSlipping: boolean;
  isDormantTenured: boolean;
  seasonalityFlag: 'stable' | 'bursty' | 'seasonal' | 'insufficient';
  insufficientData: boolean;
  r: number;
  f: number;
  m: number;
  segment: string;
}

export function computeSignals(
  input: CustomerSignalInput,
  opts?: {
    minTenureDays?: number;
    maxRecencyDays?: number;
    monetaryThresholdMinor?: number;
    rfm?: { r: number; f: number; m: number; segment: string };
    now?: Date;
  }
): ComputedSignal {
  const now = opts?.now ?? new Date();
  const ordersSorted = [...input.orders].sort((a, b) => {
    const da = a.orderedAt ?? parseIST(a.date, a.time);
    const db = b.orderedAt ?? parseIST(b.date, b.time);
    return da.getTime() - db.getTime();
  });
  const dateTimes = ordersSorted.map((o) => o.orderedAt ?? parseIST(o.date, o.time));
  const firstOrder = dateTimes[0] ?? now;
  const lastOrder = dateTimes[dateTimes.length - 1] ?? now;

  const tenureDays = Math.max(0, Math.floor((now.getTime() - firstOrder.getTime()) / 86400000));
  const recencyDays = Math.max(0, Math.floor((now.getTime() - lastOrder.getTime()) / 86400000));

  let monetaryUnits = 0;
  let monetaryValueMinor = 0;
  let priceEstimated = false;
  for (const o of ordersSorted) {
    for (const p of o.products || []) {
      const qty = Number(p.quantity) || 0;
      monetaryUnits += qty;
      const unitPrice = p.unitPrice;
      if (unitPrice != null && Number.isFinite(unitPrice)) {
        monetaryValueMinor += Math.round(qty * unitPrice * 100);
      } else {
        monetaryValueMinor += qty * 50 * 100;
        priceEstimated = true;
      }
    }
  }

  const frequency = ordersSorted.length;
  const intervals = distinctDatesToIntervals(dateTimes);
  const regularity = computeRegularity(intervals);

  // expected intervals
  let expectedInterval = regularity.median || 0;
  let expectedExcludedLast: number | null = null;
  if (intervals.length >= 4) {
    const excl = intervals.slice(0, -1);
    const r2 = computeRegularity(excl);
    if (!r2.insufficient && r2.median > 0) expectedExcludedLast = r2.median;
    else expectedExcludedLast = null;
  }
  // use excluded if we have support, else full median
  const frozenExpected = expectedExcludedLast != null && !regularity.insufficient ? expectedExcludedLast : regularity.median;

  const isRegularShort = !regularity.insufficient && regularity.isRegularStrict;
  const isRegularLong =
    !regularity.insufficient &&
    regularity.median >= 61 &&
    regularity.median <= 120 &&
    regularity.cv < 0.35 &&
    regularity.madRatio < 0.25 &&
    regularity.maxInterval < 2.5 * regularity.median;
  const isRegular = isRegularShort || isRegularLong;

  const minTenure = opts?.minTenureDays ?? 180;
  const maxRecency = opts?.maxRecencyDays ?? 90;
  const monetaryThreshold = opts?.monetaryThresholdMinor ?? 0;

  const hasValue = monetaryValueMinor >= monetaryThreshold;
  const wasTenuredBase = tenureDays >= minTenure && hasValue;

  const rfm = opts?.rfm ?? { r: 1, f: 1, m: 1, segment: 'Needs Attention' };

  const isActiveTenured = wasTenuredBase && recencyDays <= maxRecency && (rfm.segment === 'Champions' || rfm.segment === 'Loyal Accounts' || hasValue);
  const isDormantTenured = tenureDays >= minTenure && recencyDays > 90 && hasValue && !regularity.insufficient;

  // slipping uses frozen expected (excluded last gap) default tolerance 1.5, recomputed at match time if scheme overrides
  const tolerance = 1.5;
  const isSlipping = isRegular && frozenExpected > 0 && recencyDays > frozenExpected * tolerance;

  // stddev derived from cv*mean if not separately computed; for storage we compute directly
  const stddev = regularity.cv !== Infinity ? regularity.cv * regularity.mean : 0;

  return {
    firstOrder,
    lastOrder,
    tenureDays,
    recencyDays,
    frequency,
    monetaryUnits,
    monetaryValueMinor,
    priceEstimated: priceEstimated || !!input.priceEstimated,
    intervals,
    meanInterval: regularity.mean,
    medianInterval: regularity.median,
    stddev,
    cv: regularity.cv,
    mad: regularity.madRatio * regularity.median,
    madRatio: regularity.madRatio,
    maxInterval: regularity.maxInterval,
    p90Interval: regularity.p90,
    expectedInterval,
    expectedIntervalsExcludedLast: expectedExcludedLast,
    isRegular,
    isRegularShort,
    isRegularLong,
    isActiveTenured,
    isSlipping,
    isDormantTenured,
    seasonalityFlag: regularity.seasonality,
    insufficientData: frequency < 4 || regularity.insufficient,
    r: rfm.r,
    f: rfm.f,
    m: rfm.m,
    segment: rfm.segment,
  };
}

// Fetch single customer signals from customer_signals or fallback to orders
export async function fetchCustomerSignals(orgId: string, emailNormalized: string): Promise<any | null> {
  const conn = await dbConnect();
  const doc = await conn.connection.db!.collection('customer_signals').findOne({ orgId, emailNormalized });
  if (doc) return doc;

  // fallback: build from orders for this email (bounded)
  const normalized = emailNormalized.toLowerCase().trim();
  const orders = await conn.connection.db!
    .collection('orders')
    .find({ $or: [{ emailNormalized: normalized }, { email: { $regex: `^${normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } }], status: { $ne: 'canceled' } })
    .project({ date: 1, time: 1, orderedAt: 1, products: 1, name: 1, email: 1, emailNormalized: 1 })
    .sort({ orderedAt: 1, date: 1 })
    .limit(1000)
    .toArray();

  if (!orders.length) return null;

  const normalizedOrders = orders.map((o: any) => ({
    orderedAt: o.orderedAt ? new Date(o.orderedAt) : parseIST(o.date, o.time),
    date: o.date,
    time: o.time,
    products: o.products || [],
  }));

  const name = (orders[0] as any).name || emailNormalized;
  const sig = computeSignals({
    orgId,
    email: emailNormalized,
    emailNormalized,
    name,
    orders: normalizedOrders,
  });
  return {
    orgId,
    email: emailNormalized,
    emailNormalized,
    name,
    ...sig,
    updatedAt: new Date(),
  };
}
