import { dbConnect } from '@/lib/mongodb';
import { getDailySeries } from '@/lib/analytics/rollup';

export interface ToolResult {
  tool: string;
  summary: string;
  facts: Record<string, unknown>;
}

export interface ToolContext {
  orgId: string;
}

const DAY_MS = 86_400_000;

export async function toolOrdersOverview(context: ToolContext, days = 30): Promise<ToolResult> {
  const conn = await dbConnect();
  const db = conn.connection.db!;
  const since = new Date(Date.now() - days * DAY_MS).toISOString().slice(0, 10);

  const [totals, statusRows] = await Promise.all([
    db
      .collection('orders')
      .aggregate([{ $match: { orgId: context.orgId, date: { $gte: since } } }, { $count: 'orders' }])
      .toArray(),
    db
      .collection('orders')
      .aggregate([
        { $match: { orgId: context.orgId, date: { $gte: since } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ])
      .toArray(),
  ]);

  const byStatus: Record<string, number> = {};
  for (const r of statusRows) byStatus[String(r._id)] = r.count;

  return {
    tool: 'orders_overview',
    summary: `Last ${days} days: ${totals[0]?.orders ?? 0} orders. Status mix: ${statusRows
      .map((r) => `${r._id}=${r.count}`)
      .join(', ') || 'none'}.`,
    facts: { windowDays: days, totalOrders: totals[0]?.orders ?? 0, byStatus },
  };
}

export async function toolRevenueSeries(context: ToolContext, days = 30): Promise<ToolResult> {
  const series = await getDailySeries(context.orgId, days);
  const totalUnits = series.reduce((s, p) => s + p.units, 0);
  const totalOrders = series.reduce((s, p) => s + p.orders, 0);
  const last7 = series.slice(-7).reduce((s, p) => s + p.units, 0);
  const prev7 = series.slice(-14, -7).reduce((s, p) => s + p.units, 0);
  const wowDelta = prev7 > 0 ? ((last7 - prev7) / prev7) * 100 : null;

  return {
    tool: 'revenue_series',
    summary: `Last ${days} days from daily rollups: ${totalOrders} orders, ${totalUnits} units sold. Week-over-week unit delta: ${
      wowDelta === null ? 'n/a' : `${wowDelta > 0 ? '+' : ''}${wowDelta.toFixed(1)}%`
    }.`,
    facts: { totalUnits, totalOrders, weekOverWeekPct: wowDelta, seriesTail: series.slice(-14) },
  };
}

export async function toolTopProducts(context: ToolContext, days = 30, limit = 8): Promise<ToolResult> {
  const series = await getDailySeries(context.orgId, days);
  const byProduct = new Map<string, number>();
  for (const p of series) byProduct.set(p.product, (byProduct.get(p.product) ?? 0) + p.units);
  const top = [...byProduct.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);

  return {
    tool: 'top_products',
    summary: top.length
      ? `Top products by units (${days}d): ${top.map(([n, u]) => `${n}=${u}`).join(', ')}.`
      : `No sales recorded in the last ${days} days.`,
    facts: { top: top.map(([name, units]) => ({ name, units })) },
  };
}

export async function toolLowStock(context: ToolContext, limit = 10): Promise<ToolResult> {
  const conn = await dbConnect();
  const rows = await conn.connection.db!
    .collection('inventory')
    .find(
      { orgId: context.orgId, $expr: { $lte: ['$quantity', '$stock_alert_level'] } },
      { projection: { name: 1, quantity: 1, price: 1, stock_alert_level: 1 }, limit }
    )
    .sort({ quantity: 1 })
    .toArray();

  return {
    tool: 'low_stock',
    summary: rows.length
      ? `Low stock: ${rows.map((r) => `${r.name} (${r.quantity}/${r.stock_alert_level})`).join(', ')}.`
      : 'No items at or below alert level.',
    facts: { items: rows },
  };
}

export async function toolCustomerProfile(context: ToolContext, term: string): Promise<ToolResult> {
  const conn = await dbConnect();
  const db = conn.connection.db!;
  const rx = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

  const agg = await db
    .collection('orders')
    .aggregate([
      { $match: { orgId: context.orgId, $or: [{ name: rx }, { email: rx }] } },
      {
        $group: {
          _id: '$email',
          name: { $first: '$name' },
          orderCount: { $sum: 1 },
          firstOrder: { $min: '$date' },
          lastOrder: { $max: '$date' },
          units: { $sum: { $sum: '$products.quantity' } },
        },
      },
      { $limit: 5 },
    ])
    .toArray();

  if (agg.length === 0) {
    return { tool: 'customer_profile', summary: `No customers matching "${term}".`, facts: {} };
  }

  return {
    tool: 'customer_profile',
    summary: agg
      .map(
        (c) =>
          `${c.name} (${c._id}): ${c.orderCount} orders, last on ${c.lastOrder}, ${c.units} units.`
      )
      .join(' | '),
    facts: { matches: agg },
  };
}

export async function toolInventoryValue(context: ToolContext): Promise<ToolResult> {
  const conn = await dbConnect();
  const agg = await conn.connection.db!
    .collection('inventory')
    .aggregate([
      { $match: { orgId: context.orgId } },
      {
        $group: {
          _id: null,
          skus: { $sum: 1 },
          units: { $sum: '$quantity' },
          value: { $sum: { $multiply: ['$quantity', '$price'] } },
        },
      },
    ])
    .toArray();

  const v = agg[0] ?? { skus: 0, units: 0, value: 0 };
  return {
    tool: 'inventory_value',
    summary: `Inventory: ${v.skus} SKUs, ${v.units} units, ₹${Number(v.value).toLocaleString('en-IN')} at cost.`,
    facts: v,
  };
}

export async function toolDealerNetwork(_context: ToolContext): Promise<ToolResult> {
  const conn = await dbConnect();
  const db = conn.connection.db!;
  const sourceId = 'uci-online-retail-352';

  const [summary, territories, riskAccounts] = await Promise.all([
    db.collection('demo_uci_dealers').aggregate([
      { $match: { sourceId } },
      { $group: {
        _id: null,
        dealers: { $sum: 1 },
        revenue: { $sum: '$revenue' },
        outstanding: { $sum: '$outstanding' },
        overdue: { $sum: '$overdue' },
        returns: { $sum: '$returnValue' },
        highRisk: { $sum: { $cond: [{ $in: ['$riskLevel', ['high', 'critical']] }, 1, 0] } },
        serviceLevel: { $avg: '$serviceLevel' },
      } },
    ]).next(),
    db.collection('demo_uci_dealers').aggregate([
      { $match: { sourceId } },
      { $group: { _id: '$country', revenue: { $sum: '$revenue' }, overdue: { $sum: '$overdue' }, dealers: { $sum: 1 } } },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
    ]).toArray(),
    db.collection('demo_uci_dealers').find(
      { sourceId, riskLevel: { $in: ['high', 'critical'] } },
      { projection: { dealerCode: 1, country: 1, overdue: 1, creditUtilization: 1, riskScore: 1 }, sort: { riskScore: -1 }, limit: 5 }
    ).toArray(),
  ]);

  if (!summary) {
    return {
      tool: 'dealer_network',
      summary: 'The UCI public dealer workspace has not been imported yet.',
      facts: { importCommand: 'npm run data:import:uci -- --reset' },
    };
  }

  return {
    tool: 'dealer_network',
    summary: `Public dealer network: ${summary.dealers} accounts, £${Math.round(summary.revenue).toLocaleString('en-GB')} revenue, £${Math.round(summary.overdue).toLocaleString('en-GB')} overdue, ${summary.highRisk} high-risk accounts, ${Number(summary.serviceLevel).toFixed(1)}% average service level.`,
    facts: { summary, topTerritories: territories, highestRiskAccounts: riskAccounts, source: 'UCI Online Retail, CC BY 4.0' },
  };
}

export async function toolSchemeEligibility(context: ToolContext, email: string): Promise<ToolResult> {
  const conn = await dbConnect();
  const db = conn.connection.db!;
  const orgId = context.orgId;
  const normalized = email.toLowerCase().trim();
  // Try customer_signals first (O(1)), fallback to orders aggregation
  let signal: any = await db.collection('customer_signals').findOne({ orgId, emailNormalized: normalized });
  if (!signal) {
    // fallback simple
    const orders = await db.collection('orders').countDocuments({ $or: [{ emailNormalized: normalized }, { email: { $regex: `^${normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } }] });
    if (orders === 0) return { tool: 'scheme_eligibility', summary: `No customer found for ${email}.`, facts: {} };
    signal = { email: normalized, frequency: orders };
  }

  const now = new Date();
  const activeSchemes = await db.collection('promotion_schemes').find({ orgId, status: 'active', 'limits.validFrom': { $lte: now }, 'limits.validUntil': { $gte: now } }).limit(20).toArray();
  const matched: any[] = [];
  // Use matchesSignals if available — dynamic import to avoid cycle
  let matchesFn: any = null;
  try {
    const mod = await import('@/lib/promotions/engine');
    matchesFn = mod.matchesSignals;
  } catch {}

  for (const s of activeSchemes) {
    if (matchesFn) {
      try {
        if (!matchesFn(signal, (s as any).eligibility, { toleranceOverride: (s as any).eligibility?.cadence?.toleranceMultiplier })) continue;
      } catch { continue; }
    }
    matched.push({ code: (s as any).code, title: (s as any).title, benefitType: (s as any).benefitType });
  }

  const summary = matched.length
    ? `${email} is eligible for ${matched.length} scheme(s): ${matched.map((m) => m.code).join(', ')}. Signal: recency ${signal.recencyDays ?? '?'}d, freq ${signal.frequency ?? '?'}, regular ${signal.isRegular ?? '?'}.`
    : `${email} has no active eligible schemes. Signal: ${signal.segment || ''} recency ${signal.recencyDays ?? '?'}d.`;

  // Budget ≤600 chars
  const facts = { email: normalized, matched: matched.slice(0, 5), signal: { recencyDays: signal.recencyDays, frequency: signal.frequency, isRegular: signal.isRegular, isActiveTenured: signal.isActiveTenured, segment: signal.segment } };
  return { tool: 'scheme_eligibility', summary: summary.slice(0, 600), facts };
}

export async function toolCouponLookup(context: ToolContext, code: string): Promise<ToolResult> {
  const conn = await dbConnect();
  const normalized = code.toUpperCase().trim();
  const coupon = await conn.connection.db!.collection('coupons').findOne({ orgId: context.orgId, code: normalized });
  if (!coupon) return { tool: 'coupon_lookup', summary: `No coupon found for ${code}.`, facts: {} };
  const masked = `${String((coupon as any).email)[0]}***@${String((coupon as any).email).split('@')[1]}`;
  return {
    tool: 'coupon_lookup',
    summary: `Coupon ${coupon.code} status ${coupon.status}, scheme ${coupon.schemeCodeDenorm}, expires ${new Date(coupon.expiresAt).toLocaleDateString()}, email ${masked}.`,
    facts: { code: coupon.code, status: coupon.status, scheme: coupon.schemeCodeDenorm, expiresAt: coupon.expiresAt },
  };
}

export async function toolSchemeAnalytics(context: ToolContext): Promise<ToolResult> {
  try {
    const { getSchemeAnalytics } = await import('@/lib/promotions/analytics');
    const data = await getSchemeAnalytics(context.orgId);
    const totalIssued = data.reduce((s, r) => s + r.issued, 0);
    const totalRedeemed = data.reduce((s, r) => s + r.redeemed, 0);
    const rate = totalIssued ? Math.round((totalRedeemed / totalIssued) * 100) : 0;
    const top = data.slice(0, 3).map((r) => `${r.code}=${r.redeemed}/${r.issued}`).join(', ');
    return {
      tool: 'scheme_analytics',
      summary: `Schemes: ${data.length}, issued ${totalIssued}, redeemed ${totalRedeemed} (${rate}%). Top: ${top || 'none'}.`,
      facts: { totalIssued, totalRedeemed, schemes: data.slice(0, 5) },
    };
  } catch {
    return { tool: 'scheme_analytics', summary: 'No scheme analytics available.', facts: {} };
  }
}
