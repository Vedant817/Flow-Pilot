import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { getDailySeries } from '@/lib/analytics/rollup';
import { AuthorizationError, requireWorkspace } from '@/lib/auth';

const DAY_MS = 86_400_000;

// TODO: full multi-tenancy — backfill orgId on orders/inventory then scope every
// aggregation below by ORG_ID (currently tolerated as missing for legacy rows).
const ORG_ID = 'default';
const ORG_OR_MISSING = { $or: [{ orgId: ORG_ID }, { orgId: { $exists: false } }] };

export async function GET(request: NextRequest) {
  try {
    const authCtx = await requireWorkspace();
    const days = Math.min(365, Math.max(7, Number(request.nextUrl.searchParams.get('days')) || 30));
    const currentStart = new Date(Date.now() - days * DAY_MS).toISOString().slice(0, 10);
    const previousStart = new Date(Date.now() - days * 2 * DAY_MS).toISOString().slice(0, 10);

    const conn = await dbConnect();
    const db = conn.connection.db!;

    const [rollups, orderDaily, statusRows, inventory, customerRows] = await Promise.all([
      getDailySeries(authCtx.orgId, days * 2),
      db.collection('orders').aggregate([
        { $match: { orgId: authCtx.orgId, date: { $gte: previousStart } } },
        { $group: { _id: '$date', orders: { $sum: 1 }, fulfilled: { $sum: { $cond: [{ $eq: ['$status', 'fulfilled'] }, 1, 0] } } } },
        { $sort: { _id: 1 } },
      ]).toArray(),
      db.collection('orders').aggregate([
        { $match: { orgId: authCtx.orgId } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]).toArray(),
      db.collection('inventory').find({ orgId: authCtx.orgId }, {
        projection: { name: 1, category: 1, quantity: 1, price: 1, stock_alert_level: 1 },
      }).limit(100_000).toArray(),
      db.collection('orders').aggregate([
        { $match: { orgId: authCtx.orgId, date: { $gte: currentStart } } },
        { $unwind: '$products' },
        {
          $lookup: {
            from: 'inventory',
            let: { productName: '$products.name', workspace: '$orgId' },
            pipeline: [
              { $match: { $expr: { $and: [
                { $eq: ['$orgId', '$$workspace'] },
                { $eq: ['$name', '$$productName'] },
              ] } } },
              { $project: { price: 1 } },
              { $limit: 1 },
            ],
            as: 'sku',
          },
        },
        { $set: { lineValue: { $multiply: ['$products.quantity', { $ifNull: [{ $first: '$sku.price' }, 50] }] } } },
        { $group: { _id: '$email', name: { $first: '$name' }, orders: { $addToSet: '$_id' }, spend: { $sum: '$lineValue' } } },
        { $set: { orderCount: { $size: '$orders' } } },
        { $sort: { spend: -1 } },
        { $limit: 5_000 },
      ], { maxTimeMS: 8_000 }).toArray(),
    ]);

    const priceByProduct = new Map(inventory.map((sku) => [String(sku.name), Number(sku.price) || 50]));
    const currentRollups = rollups.filter((row) => row.date >= currentStart);
    const previousRollups = rollups.filter((row) => row.date < currentStart);
    const revenue = (rows: typeof rollups) => rows.reduce(
      (sum, row) => sum + row.units * (priceByProduct.get(row.product) ?? 50),
      0
    );
    const currentRevenue = revenue(currentRollups);
    const previousRevenue = revenue(previousRollups);

    const currentOrderDays = orderDaily.filter((row) => String(row._id) >= currentStart);
    const previousOrderDays = orderDaily.filter((row) => String(row._id) < currentStart);
    const totalOrders = currentOrderDays.reduce((sum, row) => sum + Number(row.orders), 0);
    const previousOrders = previousOrderDays.reduce((sum, row) => sum + Number(row.orders), 0);
    const fulfilled = currentOrderDays.reduce((sum, row) => sum + Number(row.fulfilled), 0);

    const byDate = new Map<string, { orders: number; revenue: number }>();
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(Date.now() - i * DAY_MS).toISOString().slice(0, 10);
      byDate.set(date, { orders: 0, revenue: 0 });
    }
    for (const row of currentOrderDays) {
      const entry = byDate.get(String(row._id));
      if (entry) entry.orders = Number(row.orders);
    }
    for (const row of currentRollups) {
      const entry = byDate.get(row.date);
      if (entry) entry.revenue += row.units * (priceByProduct.get(row.product) ?? 50);
    }

    const productUnits = new Map<string, number>();
    for (const row of currentRollups) {
      productUnits.set(row.product, (productUnits.get(row.product) ?? 0) + row.units);
    }
    const topProduct = [...productUnits.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'No sales data';

    const categoryInventory = new Map<string, number>();
    for (const sku of inventory) {
      const category = String(sku.category ?? 'Uncategorized');
      categoryInventory.set(category, (categoryInventory.get(category) ?? 0) + Number(sku.quantity ?? 0));
    }

    const statusMap = new Map(statusRows.map((row) => [String(row._id), Number(row.count)]));
    const trend = [...byDate.entries()];

    return NextResponse.json({
      summary: {
        totalOrders,
        totalRevenue: Math.round(currentRevenue),
        averageOrderValue: totalOrders ? Math.round(currentRevenue / totalOrders) : 0,
        totalProducts: inventory.length,
        totalCustomers: customerRows.length,
        revenueGrowth: growth(currentRevenue, previousRevenue),
        orderGrowth: growth(totalOrders, previousOrders),
        topSellingProduct: topProduct,
      },
      recentActivity: {
        recentOrders: totalOrders,
        pendingOrders: (statusMap.get('pending fulfillment') ?? 0) + (statusMap.get('pending') ?? 0),
        fulfilledOrders: statusMap.get('fulfilled') ?? 0,
        lowStockItems: inventory.filter((sku) => Number(sku.quantity) <= Number(sku.stock_alert_level)).length,
      },
      performanceMetrics: {
        conversionRate: null,
        fulfillmentRate: totalOrders ? Math.round((fulfilled / totalOrders) * 100) : 0,
        averageProcessingTime: null,
        customerSatisfaction: null,
        notes: 'conversionRate, averageProcessingTime and customerSatisfaction are unavailable — no visitor/funnel, fulfillment-timestamp, or survey data is collected yet',
      },
      chartData: {
        orderTrends: {
          dates: trend.map(([date]) => new Date(`${date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
          orders: trend.map(([, value]) => value.orders),
          revenue: trend.map(([, value]) => Math.round(value.revenue)),
        },
        productPerformance: {
          categories: [...categoryInventory.keys()],
          sales: [...categoryInventory.values()],
        },
        customerInsights: {
          newCustomers: customerRows.filter((customer) => customer.orderCount === 1).length,
          returningCustomers: customerRows.filter((customer) => customer.orderCount > 1).length,
          topSpenders: customerRows.slice(0, 5).map((customer) => ({
            name: customer.name || customer._id,
            amount: Math.round(Number(customer.spend)),
          })),
        },
      },
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in analytics overview:', error);
    return NextResponse.json({ error: 'Failed to generate analytics overview' }, { status: 500 });
  }
}

function growth(current: number, previous: number): number {
  if (previous <= 0) return 0;
  return Math.round(((current - previous) / previous) * 10_000) / 100;
}
