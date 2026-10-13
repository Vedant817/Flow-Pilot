jest.mock('../lib/mongodb', () => ({ dbConnect: jest.fn() }));
jest.mock('../lib/auth', () => ({
  normalizeNameKey: (name: string) => name.toLowerCase().trim().replace(/\s+/g, ' '),
}));

import { dbConnect } from '../lib/mongodb';
import { priceOrder } from '../lib/promotions/pricing';

const connect = dbConnect as jest.Mock;

describe('authoritative order pricing', () => {
  const find = jest.fn();
  beforeEach(() => {
    jest.clearAllMocks();
    connect.mockResolvedValue({
      connection: { db: { collection: () => ({ find }) } },
    });
  });

  it('scopes price lookup to the active tenant and snapshots integer money', async () => {
    find.mockReturnValue({
      toArray: async () => [{ _id: 'sku-a', name: 'Widget', nameKey: 'widget', price: 12.34 }],
    });
    const priced = await priceOrder('org_a', [{ name: 'Widget', quantity: 3 }]);
    expect(find.mock.calls[0][0].orgId).toBe('org_a');
    expect(priced.orderValueMinor).toBe(3702);
    expect(priced.productsWithSnapshot[0]).toMatchObject({
      productId: 'sku-a',
      unitPriceMinor: 1234,
      lineValueMinor: 3702,
    });
  });

  it('does not invent prices for missing products', async () => {
    find.mockReturnValue({ toArray: async () => [] });
    await expect(priceOrder('org_a', [{ name: 'Missing', quantity: 1 }]))
      .rejects.toThrow('Catalog price unavailable');
  });

  it('does not convert a database failure into estimated revenue', async () => {
    connect.mockRejectedValue(new Error('database unavailable'));
    await expect(priceOrder('org_a', [{ name: 'Widget', quantity: 1 }]))
      .rejects.toThrow('database unavailable');
  });

  it.each([null, '', false, 0, -1, NaN])('rejects invalid stored catalog price %s', async (price) => {
    find.mockReturnValue({
      toArray: async () => [{ _id: 'sku-a', name: 'Widget', nameKey: 'widget', price }],
    });
    await expect(priceOrder('org_a', [{ name: 'Widget', quantity: 1 }]))
      .rejects.toThrow('Catalog price unavailable');
  });

  it('rejects invalid quantities instead of silently coercing them', async () => {
    await expect(priceOrder('org_a', [{ name: 'Widget', quantity: -2 }]))
      .rejects.toThrow('positive integer');
  });
});
