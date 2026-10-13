/** @jest-environment node */

jest.mock('mongoose', () => ({
  __esModule: true,
  default: { startSession: jest.fn(), isValidObjectId: () => true },
}));
jest.mock('../lib/auth', () => ({
  requirePermission: jest.fn(async () => ({ orgId: 'org_a', userId: 'operator' })),
  AuthorizationError: class extends Error {},
}));
jest.mock('../lib/mongodb', () => ({
  __esModule: true,
  default: jest.fn(async () => ({ connection: { db: {} } })),
}));
jest.mock('../lib/rate-limit', () => ({
  rateLimitAsync: jest.fn(async () => ({ ok: true })),
}));
jest.mock('../models/Order', () => ({
  Order: { findOne: jest.fn(), create: jest.fn(), findOneAndUpdate: jest.fn(), exists: jest.fn() },
}));
jest.mock('../models/PromotionScheme', () => ({
  PromotionScheme: { find: jest.fn() },
}));
jest.mock('../models/Coupon', () => ({ Coupon: {} }));
jest.mock('../models/PromotionAudit', () => ({ PromotionAudit: {} }));
jest.mock('../models/OutboxEvent', () => ({ OutboxEvent: { create: jest.fn() } }));
jest.mock('../models/OrderEvent', () => ({ OrderEvent: { create: jest.fn() } }));
jest.mock('../models/Inventory', () => ({ Inventory: { updateMany: jest.fn(async () => ({ matchedCount: 1 })) } }));
jest.mock('../lib/inventory/commands', () => ({ releaseOrderReservations: jest.fn(async () => undefined) }));
jest.mock('../lib/promotions/pricing', () => ({
  priceOrder: jest.fn(async () => ({
    orderValueMinor: 1000, priceSource: 'inventory',
    productsWithSnapshot: [{ productId: '507f1f77bcf86cd799439011', name: 'Widget', quantity: 1, unitPriceMinor: 1000, lineValueMinor: 1000 }],
  })),
  computeDiscount: jest.fn(),
  parseOrderDateToIST: jest.fn(),
}));

import mongoose from 'mongoose';
import { NextRequest } from 'next/server';
import { POST, PUT } from '../app/api/orders/route';
import { Order } from '../models/Order';
import { PromotionScheme } from '../models/PromotionScheme';
import { OutboxEvent } from '../models/OutboxEvent';
import { OrderEvent } from '../models/OrderEvent';
import { hashOrderRequest } from '../lib/orders/idempotency';

const intent = { name: 'Ada', email: 'ada@example.com', products: [{ name: 'Widget', quantity: 1 }] };
const request = (body: unknown = intent, key = 'checkout:12345678') => ({
  json: async () => body,
  headers: new Headers(key ? { 'idempotency-key': key } : {}),
}) as NextRequest;
const lookup = (row: unknown) => ({ select: () => ({ lean: async () => row }) });
const find = Order.findOne as jest.Mock;
const create = Order.create as jest.Mock;
const eventCreate = OutboxEvent.create as jest.Mock;
const timelineCreate = OrderEvent.create as jest.Mock;
const startSession = mongoose.startSession as jest.Mock;

describe('transactional order command', () => {
  let session: { withTransaction: jest.Mock; endSession: jest.Mock };
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    session = {
      withTransaction: jest.fn(async (callback) => callback()),
      endSession: jest.fn(async () => undefined),
    };
    startSession.mockResolvedValue(session);
    find.mockReturnValue(lookup(null));
    (PromotionScheme.find as jest.Mock).mockReturnValue({
      sort: () => ({ limit: () => ({ session: () => ({ lean: async () => [] }) }) }),
    });
    create.mockResolvedValue([{ _id: 'order-1', toObject: () => ({ ...intent }) }]);
    eventCreate.mockResolvedValue([]);
    timelineCreate.mockResolvedValue([]);
  });
  afterEach(() => jest.restoreAllMocks());

  it('rejects a missing key before business writes', async () => {
    const response = await POST(request(intent, ''));
    expect(response.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it.each([undefined, 'other-hash'])('rejects an unverifiable or changed intent (%s)', async (requestHash) => {
    find.mockReturnValue(lookup({ _id: 'existing', requestHash }));
    expect((await POST(request())).status).toBe(409);
    expect(create).not.toHaveBeenCalled();
  });

  it('returns the original matching order without new writes', async () => {
    find.mockReturnValue(lookup({ _id: 'existing', requestHash: hashOrderRequest(intent) }));
    expect((await POST(request())).status).toBe(200);
    expect(create).not.toHaveBeenCalled();
  });

  it('passes one transaction session to order, outbox and initial timeline', async () => {
    expect((await POST(request())).status).toBe(201);
    expect(create.mock.calls[0][1]).toEqual({ session });
    expect(eventCreate.mock.calls[0][1]).toEqual({ session });
    expect(timelineCreate.mock.calls[0][1]).toEqual({ session });
  });

  it('never retries failed writes outside the transaction', async () => {
    create.mockRejectedValue(new Error('database write failed: private internal detail'));
    const response = await POST(request());
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Failed to create order' });
    expect(create).toHaveBeenCalledTimes(1);
    expect(session.endSession).toHaveBeenCalledTimes(1);
  });

  it('rejects malformed JSON without echoing payload details', async () => {
    const malformed = request();
    malformed.json = async () => { throw new SyntaxError('private payload fragment'); };
    const response = await POST(malformed);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Invalid JSON payload' });
    expect(create).not.toHaveBeenCalled();
  });

  it('fails closed on a legacy key in the duplicate-key race too', async () => {
    find.mockReturnValueOnce(lookup(null)).mockReturnValueOnce(lookup({ _id: 'legacy' }));
    create.mockRejectedValue({ code: 11000 });
    expect((await POST(request())).status).toBe(409);
  });

  it('rejects terminal reversals before database writes', async () => {
    expect((await PUT(request({
      orderId: 'order-1', expectedStatus: 'fulfilled', status: 'pending fulfillment',
    }))).status).toBe(409);
    expect(Order.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('detects stale status updates without appending an event', async () => {
    (Order.findOneAndUpdate as jest.Mock).mockResolvedValue(null);
    (Order.exists as jest.Mock).mockReturnValue({ session: async () => ({ _id: 'order-1' }) });
    expect((await PUT(request({
      orderId: 'order-1', expectedStatus: 'pending', status: 'pending fulfillment',
    }))).status).toBe(409);
    expect(timelineCreate).not.toHaveBeenCalled();
  });
});
