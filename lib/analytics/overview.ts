import type { Db } from 'mongodb';
import { businessDateTime, BUSINESS_TIME_ZONE } from '@/lib/orders/time';

const DAY = 86_400_000;
export const VERIFIED_PRICE = { $and: [
  { $isNumber: '$pricing.finalMinor' },
  { $isNumber: '$pricing.originalMinor' },
  { $isNumber: '$pricing.discountMinor' },
  { $gte: ['$pricing.originalMinor', 0] },
  { $gte: ['$pricing.discountMinor', 0] },
  { $eq: ['$pricing.originalMinor', { $convert: { input: '$pricing.originalMinor', to: 'long', onError: null, onNull: null } }] },
  { $eq: ['$pricing.discountMinor', { $convert: { input: '$pricing.discountMinor', to: 'long', onError: null, onNull: null } }] },
  { $eq: ['$pricing.currency', 'INR'] },
  { $in: ['$pricing.priceSource', ['inventory', 'snapshot']] },
  { $gte: ['$pricing.finalMinor', 0] },
  { $eq: ['$pricing.finalMinor', { $convert: { input: '$pricing.finalMinor', to: 'long', onError: null, onNull: null } }] },
  { $eq: ['$pricing.finalMinor', { $subtract: [
    { $convert: { input: '$pricing.originalMinor', to: 'long', onError: null, onNull: null } },
    { $convert: { input: '$pricing.discountMinor', to: 'long', onError: null, onNull: null } },
  ] }] },
] };
const ACTIVE_PRICE = { $and: [{ $ne: ['$status', 'canceled'] }, VERIFIED_PRICE] };
const eligible = { $ne: ['$status', 'canceled'] };
function number(value: unknown): number {
  const result = Number(value ?? 0);
  if (!Number.isSafeInteger(result)) throw new Error('Analytics exceeds supported integer range');
  return result;
}
export function overviewWindow(days: number, now = new Date()) {
  const today = businessDateTime(now).date;
  const midnight = new Date(`${today}T00:00:00Z`).getTime();
  const date = (offset: number) => new Date(midnight + offset * DAY).toISOString().slice(0, 10);
  return { today, currentStart: date(1 - days), previousStart: date(1 - 2 * days), tomorrow: date(1),
    dates: Array.from({ length: days }, (_, index) => date(index + 1 - days)) };
}
type Daily = { _id: string; orders: number; fulfilled: number; bookedMinor: number; priced: number; unpriced: number };
type CreditDay = { _id: string; amountMinor: number; invalid: number };
type InventoryFacet = { totals: Array<{ products: number; lowStock: number }>; categories: Array<{ _id: string; units: number }> };
type CustomerFacet = { totals: Array<{ customers: number; single: number; repeat: number }>; top: Array<{ name?: string; spendMinor: number }> };

export async function buildOverview(db: Db, orgId: string, days: number, customerDetails: boolean) {
  const window = overviewWindow(days);
  const dateFilter = { $gte: window.previousStart, $lte: window.today };
  const [daily, credits, statusRows, inventoryRows, customerRows, topRows] = await Promise.all([
    db.collection('orders').aggregate<Daily>([
      { $match: { orgId, date: dateFilter } },
      { $group: { _id: '$date', orders: { $sum: 1 },
        fulfilled: { $sum: { $cond: [{ $eq: ['$status', 'fulfilled'] }, 1, 0] } },
        bookedMinor: { $sum: { $cond: [ACTIVE_PRICE, '$pricing.finalMinor', 0] } },
        priced: { $sum: { $cond: [ACTIVE_PRICE, 1, 0] } },
        unpriced: { $sum: { $cond: [{ $and: [eligible, { $not: [VERIFIED_PRICE] }] }, 1, 0] } },
      } },
    ], { maxTimeMS: 8000 }).toArray(),
    db.collection('financial_credits').aggregate<CreditDay>([
      { $match: { orgId, createdAt: { $gte: new Date(`${window.previousStart}T00:00:00+05:30`),
        $lt: new Date(`${window.tomorrow}T00:00:00+05:30`) } } },
      { $set: { valid: { $and: [
        { $eq: ['$kind', 'credit_memo'] }, { $eq: ['$currency', 'INR'] },
        { $isNumber: '$amountMinor' }, { $gte: ['$amountMinor', 0] },
        { $eq: ['$amountMinor', { $convert: { input: '$amountMinor', to: 'long', onError: null, onNull: null } }] },
      ] } } },
      { $group: { _id: { $dateToString: { date: '$createdAt', format: '%Y-%m-%d', timezone: BUSINESS_TIME_ZONE } },
        amountMinor: { $sum: { $cond: ['$valid', '$amountMinor', 0] } },
        invalid: { $sum: { $cond: ['$valid', 0, 1] } },
      } },
    ], { maxTimeMS: 8000 }).toArray(),
    db.collection('orders').aggregate<{ _id: string; count: number }>([
      { $match: { orgId } }, { $group: { _id: '$status', count: { $sum: 1 } } },
    ], { maxTimeMS: 8000 }).toArray(),
    db.collection('inventory').aggregate<InventoryFacet>([
      { $match: { orgId } }, { $facet: {
        totals: [{ $group: { _id: null, products: { $sum: 1 }, lowStock: { $sum: { $cond: [
          { $lte: [{ $subtract: ['$quantity', { $ifNull: ['$reservedQuantity', 0] }] }, '$stock_alert_level'] }, 1, 0,
        ] } } } }],
        categories: [{ $group: { _id: '$category', units: { $sum: '$quantity' } } }, { $sort: { units: -1, _id: 1 } }, { $limit: 201 }],
      } },
    ], { maxTimeMS: 8000 }).toArray(),
    db.collection('orders').aggregate<CustomerFacet>([
      { $match: { orgId, date: { $gte: window.currentStart, $lte: window.today }, status: { $ne: 'canceled' } } },
      { $group: { _id: { $toLower: { $convert: { input: '$email', to: 'string', onError: '', onNull: '' } } },
        name: { $first: '$name' }, orderCount: { $sum: 1 },
        spendMinor: { $sum: { $cond: [VERIFIED_PRICE, '$pricing.finalMinor', 0] } },
      } },
      { $match: { _id: { $ne: '' } } },
      { $facet: {
        totals: [{ $group: { _id: null, customers: { $sum: 1 },
          single: { $sum: { $cond: [{ $eq: ['$orderCount', 1] }, 1, 0] } },
          repeat: { $sum: { $cond: [{ $gt: ['$orderCount', 1] }, 1, 0] } },
        } }],
        top: [{ $sort: { spendMinor: -1, _id: 1 } }, { $limit: 5 }, { $project: { _id: 0, name: 1, spendMinor: 1 } }],
      } },
    ], { maxTimeMS: 8000 }).toArray(),
    db.collection('orders').aggregate<{ _id: string; units: number }>([
      { $match: { orgId, date: { $gte: window.currentStart, $lte: window.today }, status: { $ne: 'canceled' } } },
      { $unwind: '$products' }, { $group: { _id: '$products.name', units: { $sum: '$products.quantity' } } },
      { $sort: { units: -1, _id: 1 } }, { $limit: 1 },
    ], { maxTimeMS: 8000 }).toArray(),
  ]);
  const current = daily.filter(row => row._id >= window.currentStart);
  const previous = daily.filter(row => row._id < window.currentStart);
  const sum = (rows: Daily[], field: keyof Omit<Daily, '_id'>) => number(rows.reduce((total, row) => total + number(row[field]), 0));
  const creditSum = (isCurrent: boolean) => credits.filter(row => (row._id >= window.currentStart) === isCurrent)
    .reduce((total, row) => number(total + number(row.amountMinor)), 0);
  const gross = sum(current, 'bookedMinor');
  const net = gross - creditSum(true);
  const priorNet = sum(previous, 'bookedMinor') - creditSum(false);
  const count = sum(current, 'orders');
  const priced = sum(current, 'priced');
  const unpriced = sum(current, 'unpriced');
  const comparisonComplete = unpriced === 0 && sum(previous, 'unpriced') === 0 && credits.every(row => number(row.invalid) === 0);
  const inventory = inventoryRows[0] ?? { totals: [], categories: [] };
  const customers = customerRows[0] ?? { totals: [], top: [] };
  const categoryRows = inventory.categories.slice(0, 200);
  const status = new Map(statusRows.map(row => [row._id, number(row.count)]));
  const dayMap = new Map(current.map(row => [row._id, row]));
  const creditMap = new Map(credits.map(row => [row._id, number(row.amountMinor)]));
  const growth = (value: number, prior: number) => prior > 0 ? Math.round((value - prior) / prior * 10000) / 100 : null;
  return {
    summary: { totalOrders: count, totalRevenue: net / 100,
      averageOrderValue: priced ? gross / priced / 100 : null,
      totalProducts: number(inventory.totals[0]?.products), totalCustomers: number(customers.totals[0]?.customers),
      revenueGrowth: comparisonComplete ? growth(net, priorNet) : null, orderGrowth: growth(count, sum(previous, 'orders')),
      topSellingProduct: topRows[0]?._id ?? 'No accepted order data',
    },
    monetaryCoverage: {
      pricedOrders: priced, unpricedOrders: unpriced, invalidCreditRecords: credits.reduce((total, row) => total + number(row.invalid), 0),
      complete: unpriced === 0 && credits.every(row => number(row.invalid) === 0),
      currency: 'INR', basis: 'Verified booked order value less credit memos posted in the period; not recognized revenue or cash receipts',
      grossBookedMinor: gross, creditMemoMinor: creditSum(true),
    },
    freshness: { generatedAt: new Date().toISOString(), timeZone: BUSINESS_TIME_ZONE, currentStart: window.currentStart, endDate: window.today },
    recentActivity: { recentOrders: count, pendingOrders: (status.get('pending') ?? 0) + (status.get('pending fulfillment') ?? 0),
      fulfilledOrders: status.get('fulfilled') ?? 0, lowStockItems: number(inventory.totals[0]?.lowStock) },
    performanceMetrics: { conversionRate: null, fulfillmentRate: count ? sum(current, 'fulfilled') / count * 100 : null,
      averageProcessingTime: null, customerSatisfaction: null },
    chartData: {
      orderTrends: { dates: window.dates.map(date => new Date(`${date}T00:00:00+05:30`).toLocaleDateString('en-US', { timeZone: BUSINESS_TIME_ZONE, month: 'short', day: 'numeric' })),
        orders: window.dates.map(date => number(dayMap.get(date)?.orders)),
        revenue: window.dates.map(date => (number(dayMap.get(date)?.bookedMinor) - (creditMap.get(date) ?? 0)) / 100) },
      productPerformance: { categories: categoryRows.map(row => row._id ?? 'Uncategorized'), sales: categoryRows.map(row => number(row.units)), truncated: inventory.categories.length > 200 },
      customerInsights: { newCustomers: number(customers.totals[0]?.single), returningCustomers: number(customers.totals[0]?.repeat),
        basis: 'Single-order and repeat-order accounts within this period, not lifetime new customers',
        topSpenders: customers.top.map(row => ({ name: customerDetails ? row.name || 'Customer' : 'Restricted customer', amount: number(row.spendMinor) / 100 })) },
    },
  };
}
