import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';

const SOURCE_ID = 'uci-online-retail-352';

export async function GET() {
  try {
    const conn = await dbConnect();
    const db = conn.connection.db!;

    const [dealerSummary, territories, trend, riskQueue, returns, products, importJob] = await Promise.all([
      db.collection('demo_uci_dealers').aggregate([
        { $match: { sourceId: SOURCE_ID } },
        { $group: {
          _id: null,
          dealers: { $sum: 1 },
          active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
          onCreditHold: { $sum: { $cond: [{ $eq: ['$status', 'credit hold'] }, 1, 0] } },
          revenue: { $sum: '$revenue' },
          returnValue: { $sum: '$returnValue' },
          outstanding: { $sum: '$outstanding' },
          overdue: { $sum: '$overdue' },
          creditLimit: { $sum: '$creditLimit' },
          avgServiceLevel: { $avg: '$serviceLevel' },
          highRisk: { $sum: { $cond: [{ $in: ['$riskLevel', ['high', 'critical']] }, 1, 0] } },
        } },
      ]).next(),
      db.collection('demo_uci_dealers').aggregate([
        { $match: { sourceId: SOURCE_ID } },
        { $group: {
          _id: '$country',
          dealers: { $sum: 1 },
          revenue: { $sum: '$revenue' },
          overdue: { $sum: '$overdue' },
          returns: { $sum: '$returnValue' },
          serviceLevel: { $avg: '$serviceLevel' },
        } },
        { $sort: { revenue: -1 } },
        { $limit: 12 },
      ]).toArray(),
      db.collection('demo_uci_daily').find(
        { sourceId: SOURCE_ID },
        { projection: { date: 1, revenue: 1, returnValue: 1, orders: 1, activeDealers: 1 }, sort: { date: -1 }, limit: 90 }
      ).toArray(),
      db.collection('demo_uci_dealers').find(
        { sourceId: SOURCE_ID, riskLevel: { $in: ['high', 'critical'] } },
        { projection: { dealerCode: 1, name: 1, country: 1, revenue: 1, outstanding: 1, overdue: 1, creditLimit: 1, riskScore: 1, riskLevel: 1, returnRate: 1, serviceLevel: 1 }, sort: { riskScore: -1 }, limit: 12 }
      ).toArray(),
      db.collection('demo_uci_returns').find(
        { sourceId: SOURCE_ID },
        { projection: { invoiceNo: 1, dealerCode: 1, customerId: 1, country: 1, activityDate: 1, grossValue: 1, units: 1 }, sort: { activityDate: -1 }, limit: 10 }
      ).toArray(),
      db.collection('demo_uci_products').find(
        { sourceId: SOURCE_ID },
        { projection: { sku: 1, name: 1, revenue: 1, units: 1, returnRate: 1, stockOnHand: 1 }, sort: { revenue: -1 }, limit: 10 }
      ).toArray(),
      db.collection('data_imports').findOne(
        { sourceId: SOURCE_ID },
        { sort: { startedAt: -1 }, projection: { status: 1, rowsRead: 1, invoicesWritten: 1, dealers: 1, products: 1, completedAt: 1, license: 1, sourceUrl: 1 } }
      ),
    ]);

    const summary = dealerSummary ?? {
      dealers: 0,
      active: 0,
      onCreditHold: 0,
      revenue: 0,
      returnValue: 0,
      outstanding: 0,
      overdue: 0,
      creditLimit: 0,
      avgServiceLevel: 0,
      highRisk: 0,
    };

    return NextResponse.json({
      source: {
        id: SOURCE_ID,
        name: 'UCI Online Retail',
        license: 'CC BY 4.0',
        doi: '10.24432/C5BW33',
        import: importJob,
      },
      available: Boolean(importJob?.status === 'completed'),
      summary: {
        ...summary,
        revenue: round(summary.revenue),
        returnValue: round(summary.returnValue),
        outstanding: round(summary.outstanding),
        overdue: round(summary.overdue),
        creditLimit: round(summary.creditLimit),
        returnRate: summary.revenue ? round(summary.returnValue / summary.revenue * 100) : 0,
        creditUtilization: summary.creditLimit ? round(summary.outstanding / summary.creditLimit * 100) : 0,
        avgServiceLevel: round(summary.avgServiceLevel),
      },
      territories: territories.map((row) => ({
        country: row._id,
        dealers: row.dealers,
        revenue: round(row.revenue),
        overdue: round(row.overdue),
        returns: round(row.returns),
        serviceLevel: round(row.serviceLevel),
      })),
      trend: trend.reverse(),
      riskQueue,
      recentReturns: returns,
      topProducts: products,
    });
  } catch (error) {
    console.error('Dealer network overview failed:', error);
    return NextResponse.json({ error: 'Failed to load dealer network' }, { status: 500 });
  }
}

function round(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}
