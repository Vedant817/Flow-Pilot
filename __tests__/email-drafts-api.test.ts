import type { NextRequest } from 'next/server';
import { GET } from '../app/api/email-drafts/route';
import { PATCH } from '../app/api/email-drafts/[id]/route';
import { requireWorkspace, requirePermission, AuthorizationError } from '../lib/auth';
import { InboundOrderDraft } from '../models/InboundOrderDraft';
import { Order } from '../models/Order';
import { createInboundOrder } from '../lib/orders/inbound';

jest.mock('next/server', () => ({ NextResponse: {
  json: (body: unknown, init?: { status?: number }) => ({ status: init?.status ?? 200, body }),
} }));
jest.mock('mongoose', () => ({ __esModule: true, default: {
  isValidObjectId: (id: string) => /^[a-f0-9]{24}$/.test(id),
  startSession: jest.fn(async () => ({ withTransaction: async (cb: () => Promise<void>) => cb(), endSession: async () => undefined })),
} }));
jest.mock('../lib/auth', () => ({
  requireWorkspace: jest.fn(), requirePermission: jest.fn(),
  AuthorizationError: class extends Error { constructor(message: string, public status: number) { super(message); } },
}));
jest.mock('../lib/mongodb', () => ({ __esModule: true, default: jest.fn(async () => ({})) }));
jest.mock('../lib/analytics/rollup', () => ({ applyOrderDelta: jest.fn(async () => undefined) }));
jest.mock('../lib/orders/inbound', () => ({
  createInboundOrder: jest.fn(async () => ({ _id: 'order-id' })),
}));
jest.mock('../models/InboundOrderDraft', () => ({ InboundOrderDraft: {
  find: jest.fn(() => ({ sort: () => ({ limit: () => ({ lean: async () => [] }) }) })),
  findOne: jest.fn(() => ({ session: async () => ({
    senderName: 'Buyer', senderEmail: 'buyer@example.com', gmailMessageId: 'gmail-one', placedAt: new Date('2026-09-26T14:35:00Z'),
  }) })),
  updateOne: jest.fn(async () => ({ modifiedCount: 1 })),
  findOneAndUpdate: jest.fn(async () => ({ status: 'dismissed' })),
} }));
jest.mock('../models/Order', () => ({ Order: {
  create: jest.fn(async () => ([{ _id: 'order-id', date: '2026-09-26', products: [{ name: 'Rice', quantity: 50 }] }])),
} }));

const auth = requireWorkspace as jest.Mock;
const editAuth = requirePermission as jest.Mock;
const draft = InboundOrderDraft as jest.Mocked<typeof InboundOrderDraft>;
const order = Order as jest.Mocked<typeof Order>;
const id = '507f1f77bcf86cd799439011';

describe('inbound draft API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    auth.mockResolvedValue({ userId: 'clerk-1', orgId: 'default' });
    editAuth.mockResolvedValue({ userId: 'clerk-1', orgId: 'default' });
  });

  it('rejects missing workspace and unauthorized editors before reading or writing', async () => {
    auth.mockRejectedValueOnce(new AuthorizationError('No workspace', 403));
    expect((await GET({ url: 'http://localhost/api/email-drafts' } as NextRequest)).status).toBe(403);
    expect(draft.find).not.toHaveBeenCalled();
    editAuth.mockRejectedValueOnce(new AuthorizationError('Forbidden', 403));
    expect((await PATCH({} as NextRequest, { params: Promise.resolve({ id }) })).status).toBe(403);
    expect(editAuth).toHaveBeenCalledWith('orders:write');
    expect(order.create).not.toHaveBeenCalled();
  });

  it('scopes the draft list by organization', async () => {
    const response = await GET({ url: 'http://localhost/api/email-drafts' } as NextRequest);
    expect(response.status).toBe(200);
    expect(draft.find).toHaveBeenCalledWith({ orgId: 'default', status: 'draft' });
  });

  it('validates before any order write', async () => {
    const response = await PATCH({ json: async () => ({ action: 'confirm', products: [{ name: 'Rice', quantity: 50 }],
      requestedDeliveryDate: '2026-02-30', requestedDeliveryTime: '10:00' }) } as NextRequest,
    { params: Promise.resolve({ id }) });
    expect(response.status).toBe(409);
    expect(order.create).not.toHaveBeenCalled();
  });

  it('creates a verified order and resolves the draft in one transaction', async () => {
    const response = await PATCH({ json: async () => ({ action: 'confirm', products: [{ name: 'Rice', quantity: 50 }],
      requestedDeliveryDate: '2026-10-05', requestedDeliveryTime: '10:00' }) } as NextRequest,
    { params: Promise.resolve({ id }) });
    expect(response.status).toBe(200);
    expect(createInboundOrder).toHaveBeenCalledWith(expect.objectContaining({
      orgId: 'default', actorId: 'clerk-1', messageId: 'gmail-one',
      requestedDeliveryDate: '2026-10-05', requestedDeliveryTime: '10:00',
    }), expect.anything());
    expect(draft.updateOne).toHaveBeenCalledWith(expect.objectContaining({ status: 'draft' }),
      expect.objectContaining({ $set: expect.objectContaining({ status: 'confirmed', confirmedOrderId: 'order-id' }) }),
      expect.objectContaining({ session: expect.anything() }));
  });
});
