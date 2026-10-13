/** @jest-environment node */
import { dbConnect } from '@/lib/mongodb';
import { getSchemeAnalytics } from '../lib/promotions/analytics';

jest.mock('@/lib/mongodb', () => ({ dbConnect: jest.fn() }));

it('scopes every analytics read, including shared holdout emails and foreign redeemed order IDs', async () => {
  const queries: Array<{ collection: string; filter: Record<string, any> }> = [];
  const createdAt = new Date('2026-01-01');
  const data: Record<string, any[]> = {
    promotion_schemes: [{ orgId: 'tenant_a', _id: 'scheme', code: 'A', createdAt }],
    coupons: [
      { orgId: 'tenant_a', schemeId: 'scheme', status: 'redeemed', redeemedOrderId: 'foreign_order' },
      { orgId: 'tenant_a', schemeId: 'scheme', status: 'holdout', emailNormalized: 'shared@example.com', issuedAt: createdAt },
      { orgId: 'tenant_b', schemeId: 'scheme', status: 'redeemed', redeemedOrderId: 'foreign_order' },
    ],
    orders: [
      { orgId: 'tenant_b', _id: 'foreign_order', emailNormalized: 'shared@example.com', orderedAt: createdAt, pricing: { finalMinor: 999999 } },
      { orgId: 'tenant_a', _id: 'local_order', emailNormalized: 'shared@example.com', orderedAt: createdAt, pricing: { finalMinor: 100 } },
    ],
    scheme_daily_stats: [],
  };
  function select(collection: string, filter: Record<string, any>) {
    queries.push({ collection, filter });
    return data[collection].filter(doc => Object.entries(filter).every(([key, value]) => {
      if (value && typeof value === 'object') {
        if ('$in' in value) return value.$in.includes(doc[key]);
        if ('$exists' in value) return (doc[key] !== undefined) === value.$exists;
        return doc[key] >= value.$gte && doc[key] <= value.$lte;
      }
      return doc[key] === value;
    }));
  }
  function cursor(docs: any[]) {
    return { limit: jest.fn().mockReturnThis(), sort: jest.fn().mockReturnThis(), toArray: async () => docs };
  }
  const db = { collection: (name: string) => ({
    find: (filter: Record<string, any>) => cursor(select(name, filter)),
    aggregate: (pipeline: any[]) => {
      const docs = select(name, pipeline[0].$match);
      const statuses = [...new Set(docs.map(doc => doc.status))];
      return cursor(statuses.map(status => ({
        _id: status, count: docs.filter(doc => doc.status === status).length, discountSum: 0,
      })));
    },
  }) };
  (dbConnect as jest.Mock).mockResolvedValue({ connection: { db } });

  const [result] = await getSchemeAnalytics('tenant_a');
  expect(result).toMatchObject({
    redeemed: 1, holdout: 1, revenueMinor: 0, holdoutRevenueMinor: 100, holdoutOrders: 1,
  });
  expect(queries).toHaveLength(7);
  for (const query of queries) expect(query.filter.orgId).toBe('tenant_a');
});
