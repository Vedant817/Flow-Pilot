import { dbConnect } from '@/lib/mongodb';
import { computeSignals, parseIST } from '@/lib/promotions/eligibility';

export async function rebuildCustomerSignalsForOrg(orgId: string = 'default'): Promise<{ total: number; updated: number }> {
  const conn = await dbConnect();
  const db = conn.connection.db!;
  // Use aggregation to get per-email groups; we do it in chunks via cursor to avoid Vercel timeout for large sets
  // For moderate size (<100k), single aggregate is fine; we fallback to distinct+per-email if needed
  // Preferred: staging pattern via $merge is ideal on Atlas; here we implement iterative approach for serverless safety

  // First, ensure orderedAt exists for query; fallback to date+time parse in JS per email
  const emails: string[] = await db.collection('orders').distinct('emailNormalized' as any, { status: { $ne: 'canceled' } } as any);
  // fallback to email if emailNormalized not backfilled
  let distinct = emails.filter(Boolean) as string[];
  if (distinct.length === 0) {
    distinct = (await db.collection('orders').distinct('email', { status: { $ne: 'canceled' } } as any)) as string[];
    distinct = distinct.map((e: string) => e?.toLowerCase().trim()).filter(Boolean);
  }

  let updated = 0;
  for (const emailNormalized of distinct) {
    const orders = await db
      .collection('orders')
      .find({ $or: [{ emailNormalized }, { email: { $regex: `^${emailNormalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } }], status: { $ne: 'canceled' } })
      .project({ name: 1, emailNormalized: 1, email: 1, date: 1, time: 1, orderedAt: 1, products: 1 })
      .sort({ orderedAt: 1, date: 1 })
      .limit(2000)
      .toArray();
    if (!orders.length) continue;
    const name = (orders[0] as any).name || emailNormalized;
    const normalizedOrders = orders.map((o: any) => ({
      orderedAt: o.orderedAt ? new Date(o.orderedAt) : parseIST(o.date, o.time),
      date: o.date,
      time: o.time,
      products: o.products || [],
    }));
    const sig = computeSignals(
      {
        orgId,
        email: emailNormalized,
        emailNormalized,
        name,
        orders: normalizedOrders,
      },
      {}
    );
    await db.collection('customer_signals').updateOne(
      { orgId, emailNormalized },
      {
        $set: {
          orgId,
          email: emailNormalized,
          emailNormalized,
          name,
          firstOrder: sig.firstOrder,
          lastOrder: sig.lastOrder,
          tenureDays: sig.tenureDays,
          recencyDays: sig.recencyDays,
          frequency: sig.frequency,
          monetaryUnits: sig.monetaryUnits,
          monetaryValueMinor: sig.monetaryValueMinor,
          priceEstimated: sig.priceEstimated,
          intervals: sig.intervals,
          meanInterval: sig.meanInterval,
          medianInterval: sig.medianInterval,
          stddev: sig.stddev,
          cv: sig.cv,
          mad: sig.mad,
          madRatio: sig.madRatio,
          maxInterval: sig.maxInterval,
          p90Interval: sig.p90Interval,
          expectedInterval: sig.expectedInterval,
          expectedIntervalsExcludedLast: sig.expectedIntervalsExcludedLast,
          isRegular: sig.isRegular,
          isRegularShort: sig.isRegularShort,
          isRegularLong: sig.isRegularLong,
          isActiveTenured: sig.isActiveTenured,
          isSlipping: sig.isSlipping,
          isDormantTenured: sig.isDormantTenured,
          seasonalityFlag: sig.seasonalityFlag,
          r: sig.r,
          f: sig.f,
          m: sig.m,
          segment: sig.segment,
          rfmThresholdVersion: 'v1',
          insufficientData: sig.insufficientData,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );
    updated++;
  }
  return { total: distinct.length, updated };
}

export async function refreshCustomerSignalForEmail(emailNormalized: string, orgId: string = 'default'): Promise<void> {
  const conn = await dbConnect();
  const db = conn.connection.db!;
  const normalized = emailNormalized.toLowerCase().trim();
  const orders = await db
    .collection('orders')
    .find({ $or: [{ emailNormalized: normalized }, { email: { $regex: `^${normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } }], status: { $ne: 'canceled' } })
    .project({ name: 1, emailNormalized: 1, email: 1, date: 1, time: 1, orderedAt: 1, products: 1 })
    .sort({ orderedAt: 1, date: 1 })
    .limit(2000)
    .toArray();
  if (!orders.length) {
    await db.collection('customer_signals').deleteOne({ orgId, emailNormalized: normalized });
    return;
  }
  const name = (orders[0] as any).name || normalized;
  const normalizedOrders = orders.map((o: any) => ({
    orderedAt: o.orderedAt ? new Date(o.orderedAt) : parseIST(o.date, o.time),
    date: o.date,
    time: o.time,
    products: o.products || [],
  }));
  const sig = computeSignals(
    { orgId, email: normalized, emailNormalized: normalized, name, orders: normalizedOrders },
    {}
  );
  await db.collection('customer_signals').updateOne(
    { orgId, emailNormalized: normalized },
    {
      $set: {
        orgId,
        email: normalized,
        emailNormalized: normalized,
        name,
        firstOrder: sig.firstOrder,
        lastOrder: sig.lastOrder,
        tenureDays: sig.tenureDays,
        recencyDays: sig.recencyDays,
        frequency: sig.frequency,
        monetaryUnits: sig.monetaryUnits,
        monetaryValueMinor: sig.monetaryValueMinor,
        priceEstimated: sig.priceEstimated,
        intervals: sig.intervals,
        meanInterval: sig.meanInterval,
        medianInterval: sig.medianInterval,
        stddev: sig.stddev,
        cv: sig.cv,
        mad: sig.mad,
        madRatio: sig.madRatio,
        maxInterval: sig.maxInterval,
        p90Interval: sig.p90Interval,
        expectedInterval: sig.expectedInterval,
        expectedIntervalsExcludedLast: sig.expectedIntervalsExcludedLast,
        isRegular: sig.isRegular,
        isRegularShort: sig.isRegularShort,
        isRegularLong: sig.isRegularLong,
        isActiveTenured: sig.isActiveTenured,
        isSlipping: sig.isSlipping,
        isDormantTenured: sig.isDormantTenured,
        seasonalityFlag: sig.seasonalityFlag,
        r: sig.r,
        f: sig.f,
        m: sig.m,
        segment: sig.segment,
        rfmThresholdVersion: 'v1',
        insufficientData: sig.insufficientData,
        updatedAt: new Date(),
      },
    },
    { upsert: true }
  );
}
