import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';

const SOURCE_ID = 'uci-online-retail-352';
const MAX_PAGE_SIZE = 100;

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const page = Math.max(1, Number(params.get('page')) || 1);
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(10, Number(params.get('limit')) || 25));
    const risk = params.get('risk');
    const country = params.get('country');
    const q = params.get('q')?.trim();
    const sortKey = ['revenue', 'riskScore', 'outstanding', 'lastOrder'].includes(params.get('sort') ?? '')
      ? params.get('sort')!
      : 'revenue';

    const filter: Record<string, unknown> = { sourceId: SOURCE_ID };
    if (risk && ['low', 'medium', 'high', 'critical'].includes(risk)) filter.riskLevel = risk;
    if (country) filter.country = country;
    if (q) {
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { name: { $regex: escaped, $options: 'i' } },
        { dealerCode: { $regex: escaped, $options: 'i' } },
        { customerId: { $regex: escaped, $options: 'i' } },
      ];
    }

    const conn = await dbConnect();
    const collection = conn.connection.db!.collection('demo_uci_dealers');
    const [dealers, total, countries] = await Promise.all([
      collection.find(filter, {
        projection: {
          dealerCode: 1,
          name: 1,
          customerId: 1,
          country: 1,
          territory: 1,
          orderCount: 1,
          revenue: 1,
          returnRate: 1,
          serviceLevel: 1,
          creditLimit: 1,
          outstanding: 1,
          overdue: 1,
          creditUtilization: 1,
          riskScore: 1,
          riskLevel: 1,
          status: 1,
          lastOrder: 1,
        },
        sort: { [sortKey]: -1 },
        skip: (page - 1) * limit,
        limit,
      }).toArray(),
      collection.countDocuments(filter),
      collection.distinct('country', { sourceId: SOURCE_ID }),
    ]);

    return NextResponse.json({
      data: dealers,
      filters: { countries: countries.sort() },
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Dealer search failed:', error);
    return NextResponse.json({ error: 'Failed to load dealers' }, { status: 500 });
  }
}
