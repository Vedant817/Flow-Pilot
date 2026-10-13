jest.mock('../models/Order', () => ({ Order: { create: jest.fn() } }));
jest.mock('../models/OutboxEvent', () => ({ OutboxEvent: { create: jest.fn() } }));
jest.mock('../models/OrderEvent', () => ({ OrderEvent: { create: jest.fn() } }));
jest.mock('../models/Inventory', () => ({ Inventory: { updateMany: jest.fn(async () => ({ matchedCount: 1 })) } }));

import { persistCanonicalOrder } from '../lib/orders/create';
import { Order } from '../models/Order';
import { OutboxEvent } from '../models/OutboxEvent';
import { OrderEvent } from '../models/OrderEvent';

const session = {} as never;
const input = {
  orgId: 'org_a', name: 'Buyer', phone: '', email: 'buyer@example.test', emailNormalized: 'buyer@example.test',
  date: '2026-04-01', time: '10:00', orderedAt: new Date('2026-04-01T04:30:00Z'),
  products: [{ productId: '507f1f77bcf86cd799439011', name: 'Widget', nameKey: 'widget', quantity: 2, unitPriceMinor: 1000, unitPrice: 10, lineValueMinor: 2000 }],
  pricing: { originalMinor: 2000, discountMinor: 100, finalMinor: 1900, currency: 'INR', priceSource: 'inventory' as const },
  idempotencyKey: 'checkout:12345678', requestHash: 'fixture-hash', trackingTokenHash: 'fixture-tracking-hash',
};
beforeEach(() => {
  jest.clearAllMocks();
  (Order.create as jest.Mock).mockResolvedValue([{ _id: 'order-a' }]);
});
test('all creation channels persist order, timeline and durable event under one session', async () => {
  await persistCanonicalOrder(input, 'actor-a', session);
  expect(Order.create).toHaveBeenCalledWith([expect.objectContaining({ status: 'pending fulfillment' })], { session });
  expect(OutboxEvent.create).toHaveBeenCalledWith([expect.objectContaining({ orgId: 'org_a', type: 'order.created', aggregateId: 'order-a' })], { session });
  expect(OrderEvent.create).toHaveBeenCalledWith([expect.objectContaining({ actorId: 'actor-a', type: 'created' })], { session });
});
test('rejects name-only lines or inconsistent money instead of producing unfulfillable orders', async () => {
  await expect(persistCanonicalOrder({ ...input, products: [{ ...input.products[0], productId: '' }] }, 'actor-a', session))
    .rejects.toThrow('Canonical');
  await expect(persistCanonicalOrder({ ...input, pricing: { ...input.pricing, finalMinor: 2000 } }, 'actor-a', session))
    .rejects.toThrow('money');
  expect(Order.create).not.toHaveBeenCalled();
});
