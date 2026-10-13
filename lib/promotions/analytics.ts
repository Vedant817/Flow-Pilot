import { dbConnect } from '@/lib/mongodb';

export interface SchemeAnalytics {
  schemeId: string;
  code: string;
  issued: number;
  redeemed: number;
  holdout: number;
  redemptionRate: number;
  treatedN: number;
  holdoutN: number;
  holdoutOrders: number;
  treatedOrders: number;
  reactivationRateTreated: number;
  reactivationRateHoldout: number;
  revenueMinor: number;
  holdoutRevenueMinor: number;
  scaledHoldoutRevenueMinor: number;
  discountCostMinor: number;
  incrementalRevenueMinor: number;
  roi: number;
  powerWarning?: string;
}

export async function getSchemeAnalytics(orgId: string): Promise<SchemeAnalytics[]> {
  const conn = await dbConnect();
  const db = conn.connection.db!;

  const schemes = await db.collection('promotion_schemes').find({ orgId }).toArray();
  const results: SchemeAnalytics[] = [];

  for (const s of schemes) {
    const schemeId = (s as any)._id;
    const code = (s as any).code;

    const couponAgg = await db
      .collection('coupons')
      .aggregate([
        { $match: { orgId, schemeId } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            discountSum: { $sum: { $ifNull: ['$benefitSnapshot.valueMinor', 0] } },
          },
        },
      ])
      .toArray();

    const byStatus = new Map<string, { count: number; discountSum: number }>();
    for (const r of couponAgg) byStatus.set(String(r._id), { count: r.count, discountSum: r.discountSum });

    const issued = byStatus.get('issued')?.count ?? 0;
    const redeemed = byStatus.get('redeemed')?.count ?? 0;
    const holdout = byStatus.get('holdout')?.count ?? 0;
    const treatedN = issued + redeemed;
    const holdoutN = holdout;
    const totalEligible = treatedN + holdoutN;

    // Redemption rate
    const redemptionRate = treatedN > 0 ? redeemed / treatedN : 0;

    // Revenue lift - join redeemed coupons to orders
    // Use SchemeDailyStat if available for pre-aggregated, else live calc for last 30d window
    const redeemedCoupons = await db
      .collection('coupons')
      .find({ orgId, schemeId, status: 'redeemed', redeemedOrderId: { $exists: true } }, { projection: { redeemedOrderId: 1, benefitSnapshot: 1, issuedAt: 1 } })
      .limit(5000)
      .toArray();

    let revenueMinor = 0;
    let discountCostMinor = 0;
    const issuedAtMap = new Map<string, Date>();
    for (const c of redeemedCoupons) {
      const oid = (c as any).redeemedOrderId;
      if (oid) {
        // approximate revenue via order pricing
        // We do per-order lookup batched
      }
    }

    // Batched order lookup
    const orderIds = redeemedCoupons.map((c: any) => c.redeemedOrderId).filter(Boolean);
    let orders: any[] = [];
    if (orderIds.length) {
      orders = await db.collection('orders').find({ orgId, _id: { $in: orderIds } }, { projection: { pricing: 1 } }).toArray();
      for (const o of orders) {
        const pricing = (o as any).pricing;
        if (pricing) {
          revenueMinor += Number(pricing.finalMinor || 0) + Number(pricing.discountMinor || 0);
          discountCostMinor += Number(pricing.discountMinor || 0);
        }
      }
    }

    // Holdout orders within 30d window
    // For v1, approximate holdout revenue via holdout customers who ordered within 30d after scheme creation
    const schemeCreated = (s as any).createdAt ? new Date((s as any).createdAt) : new Date();
    const windowEnd = new Date(schemeCreated.getTime() + 30 * 86400000);
    const holdoutCoupons = await db
      .collection('coupons')
      .find({ orgId, schemeId, status: 'holdout' }, { projection: { emailNormalized: 1, issuedAt: 1 } })
      .limit(5000)
      .toArray();
    let holdoutOrders = 0;
    let holdoutRevenueMinor = 0;
    for (const h of holdoutCoupons.slice(0, 100)) {
      const email = (h as any).emailNormalized;
      const issuedAt = (h as any).issuedAt ? new Date((h as any).issuedAt) : schemeCreated;
      const wEnd = new Date(issuedAt.getTime() + 30 * 86400000);
      const docs = await db
        .collection('orders')
        .find({ orgId, emailNormalized: email, orderedAt: { $gte: issuedAt, $lte: wEnd } }, { projection: { pricing: 1 } })
        .limit(10)
        .toArray();
      if (docs.length > 0) holdoutOrders++;
      for (const doc of docs) {
        const pricing = (doc as any).pricing;
        if (pricing) {
          holdoutRevenueMinor += Number(pricing.finalMinor || 0) + Number(pricing.discountMinor || 0);
        } else {
          // fallback estimate 50 per line if no pricing snapshot
          holdoutRevenueMinor += 5000;
        }
      }
    }
    // Treated orders within window
    let treatedOrders = 0;
    // redeemed count is within window by definition (redeemedOrder's date is near issuedAt), approximate
    treatedOrders = redeemed; // simplified

    // Also count treated customers who ordered within 30d (including non-redeemed but treated)
    // For simplicity, treatedOrders = redeemed (those who used coupon)
    const scaledHoldoutRevenueMinor =
      holdoutN > 0 ? Math.round((holdoutRevenueMinor * treatedN) / holdoutN) : 0;
    const incrementalRevenueMinor = revenueMinor - scaledHoldoutRevenueMinor - discountCostMinor;
    const roi = discountCostMinor > 0 ? incrementalRevenueMinor / discountCostMinor : 0;

    const reactivationRateTreated = treatedN > 0 ? treatedOrders / treatedN : 0;
    const reactivationRateHoldout = holdoutN > 0 ? holdoutOrders / holdoutN : 0;

    let powerWarning: string | undefined;
    if (totalEligible > 0 && totalEligible < 100) {
      powerWarning = `Only ${totalEligible} eligible — CI too wide. Consider 0% holdout or larger cohort.`;
    } else if (totalEligible >= 100 && totalEligible < 200) {
      powerWarning = `Small sample (${totalEligible}) — lift estimate noisy.`;
    }

    // Try to override with pre-aggregated stats if available
    const dailyStats = await db
      .collection('scheme_daily_stats')
      .find({ orgId, schemeId })
      .sort({ date: -1 })
      .limit(30)
      .toArray();
    // Could aggregate dailyStats here; for now keep live calc

    results.push({
      schemeId: String(schemeId),
      code,
      issued,
      redeemed,
      holdout,
      redemptionRate: Math.round(redemptionRate * 10000) / 100,
      treatedN,
      holdoutN,
      holdoutOrders,
      treatedOrders,
      reactivationRateTreated: Math.round(reactivationRateTreated * 10000) / 100,
      reactivationRateHoldout: Math.round(reactivationRateHoldout * 10000) / 100,
      revenueMinor,
      holdoutRevenueMinor,
      scaledHoldoutRevenueMinor,
      discountCostMinor,
      incrementalRevenueMinor,
      roi: Math.round(roi * 100) / 100,
      powerWarning,
    });
  }

  return results;
}
