jest.mock('mongoose', () => ({
  __esModule: true, default: { startSession: jest.fn() },
}));
jest.mock('../lib/mongodb', () => ({ __esModule: true, default: jest.fn(async () => ({})) }));
jest.mock('../models/Order', () => ({ Order: { findOne: jest.fn() } }));
jest.mock('../lib/promotions/pricing', () => ({ priceOrder: jest.fn() }));
jest.mock('../lib/orders/create', () => ({
  persistCanonicalOrder: jest.fn(async () => ({ _id: 'order-a' })),
  CanonicalOrderError: class extends Error { readonly status = 409; },
}));

import mongoose from 'mongoose';
import { Order } from '../models/Order';
import { priceOrder } from '../lib/promotions/pricing';
import { persistCanonicalOrder } from '../lib/orders/create';
import { createInboundOrder, inboundIntentHash } from '../lib/orders/inbound';

const input = {
  orgId: 'org_a', actorId: 'integration:gmail', messageId: 'message-a', name: 'Buyer', email: 'buyer@example.test',
  placedAt: new Date('2026-03-31T18:45:00Z'), requestedDeliveryDate: '2026-04-03', requestedDeliveryTime: '10:00',
  products: [{ name: 'Widget', quantity: 2 }],
};
beforeEach(() => {
  jest.clearAllMocks();
  (Order.findOne as jest.Mock).mockReturnValue({ select: () => ({ session: async () => null }) });
  (priceOrder as jest.Mock).mockResolvedValue({
    orderValueMinor: 2000, priceSource: 'inventory',
    productsWithSnapshot: [{ productId: 'sku-a', name: 'Widget', quantity: 2, unitPriceMinor: 1000, lineValueMinor: 2000 }],
  });
  (mongoose.startSession as jest.Mock).mockResolvedValue({
    withTransaction: async (callback: () => Promise<void>) => callback(), endSession: async () => undefined,
  });
});
test('inbound orders get tenant catalog identity, money snapshots and consistent IST placement time', async () => {
  await createInboundOrder(input);
  expect(priceOrder).toHaveBeenCalledWith('org_a', input.products);
  expect(persistCanonicalOrder).toHaveBeenCalledWith(expect.objectContaining({
    date: '2026-04-01', time: '00:15', products: [expect.objectContaining({ productId: 'sku-a' })],
    pricing: expect.objectContaining({ finalMinor: 2000, currency: 'INR' }),
  }), 'integration:gmail', expect.anything());
});
test('review confirmation reuses its caller transaction without nesting or ending it', async () => {
  const session = {};
  await createInboundOrder(input, session as never);
  expect(mongoose.startSession).not.toHaveBeenCalled();
  expect(persistCanonicalOrder).toHaveBeenCalledWith(expect.anything(), 'integration:gmail', session);
});
test('unresolved catalog records remain failures instead of inventing prices or writing orders', async () => {
  (priceOrder as jest.Mock).mockRejectedValue(Object.assign(new Error('Catalog price unavailable'), { status: 409 }));
  await expect(createInboundOrder(input)).rejects.toMatchObject({ status: 409 });
  expect(persistCanonicalOrder).not.toHaveBeenCalled();
});
test('a concurrent unique-key winner is returned only when its immutable intent matches', async () => {
  (persistCanonicalOrder as jest.Mock).mockRejectedValueOnce({ code: 11000 });
  const winner = { _id: 'winner-order', requestHash: inboundIntentHash(input) };
  (Order.findOne as jest.Mock)
    .mockReturnValueOnce({ select: () => ({ session: async () => null }) })
    .mockReturnValueOnce({ select: async () => winner });
  expect(await createInboundOrder(input)).toEqual(winner);
});
