import { NextRequest } from 'next/server';
import { GET } from '../app/api/email-reviews/route';
import { PATCH } from '../app/api/email-reviews/[id]/route';
import { getAuthContext } from '../lib/auth';
import { EmailReview } from '../models/EmailReview';
import { Order } from '../models/Order';

jest.mock('../lib/auth', () => ({ getAuthContext: jest.fn() }));
jest.mock('next/server', () => ({ NextResponse: {
  json: (body: unknown, init?: { status?: number }) => ({ status: init?.status ?? 200, body }),
} }));
jest.mock('mongoose', () => ({ __esModule: true, default: {
  isValidObjectId: (id: string) => /^[a-f0-9]{24}$/.test(id),
  Types: { ObjectId: class { constructor(readonly value: string) {} toString() { return this.value; } } },
  startSession: jest.fn(async () => ({ withTransaction: async (cb: () => Promise<void>) => cb(), endSession: async () => undefined })),
} }));
jest.mock('../lib/mongodb', () => ({ __esModule: true, default: jest.fn(async () => ({})) }));
jest.mock('../models/EmailReview', () => ({ EmailReview: {
  find: jest.fn(() => ({ sort: () => ({ limit: () => ({ lean: async () => [] }) }) })),
  findOneAndUpdate: jest.fn(() => ({ lean: async () => ({ _id: 'review-id', status: 'resolved' }) })),
  findOne: jest.fn(() => ({ session: async () => ({
    classification: 'update_order', body: 'Masoor Dal: 20 bags revised to 12 bags', senderEmail: 'buyer@example.com',
  }) })),
  updateOne: jest.fn(async () => ({ modifiedCount: 1 })),
} }));
jest.mock('../models/Order', () => ({ Order: {
  findOne: jest.fn(() => ({ session: async () => ({
    _id: '507f1f77bcf86cd799439011', email: 'buyer@example.com', date: '2026-10-05', status: 'pending fulfillment',
    products: [{ name: 'Masoor Dal', quantity: 20 }, { name: 'Poha', quantity: 10 }],
    get: () => 0,
  }) })),
  updateOne: jest.fn(async () => ({ modifiedCount: 1 })),
} }));
jest.mock('../lib/analytics/rollup', () => ({ applyOrderDelta: jest.fn(async () => undefined) }));

const auth = getAuthContext as jest.Mock;
const review = EmailReview as jest.Mocked<typeof EmailReview>;
const id = '507f1f77bcf86cd799439011';

describe('email review API', () => {
  beforeEach(() => { jest.clearAllMocks(); auth.mockResolvedValue({ userId: 'clerk-1', orgId: 'default' }); });

  it('rejects unauthenticated reads', async () => {
    auth.mockResolvedValue({ userId: null });
    const response = await GET({ url: 'http://localhost/api/email-reviews' } as NextRequest);
    expect(response.status).toBe(401);
  });

  it('lists only the selected status and authenticated org', async () => {
    const response = await GET({ url: 'http://localhost/api/email-reviews?status=open' } as NextRequest);
    expect(response.status).toBe(200);
    expect(review.find).toHaveBeenCalledWith({ orgId: 'default', status: 'open' });
  });

  it('requires a note and atomically resolves only an open item', async () => {
    const context = { params: Promise.resolve({ id }) };
    const noNote = await PATCH({ json: async () => ({ status: 'resolved', note: '' }) } as NextRequest, context);
    expect(noNote.status).toBe(400);
    const response = await PATCH({ json: async () => ({ status: 'resolved', note: 'Handled in order screen.' }) } as NextRequest, context);
    expect(response.status).toBe(200);
    expect(review.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: id, orgId: 'default', status: 'open' },
      expect.objectContaining({ $set: expect.objectContaining({ status: 'resolved', reviewedBy: 'clerk-1' }) }),
      { new: true }
    );
  });

  it('applies only an explicit matched change within one transaction', async () => {
    const response = await PATCH({ json: async () => ({ status: 'apply', note: 'Confirmed with customer.', orderId: id }) } as NextRequest,
      { params: Promise.resolve({ id }) });
    expect(response.status).toBe(200);
    expect(Order.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: 'default', status: 'pending fulfillment' }),
      expect.objectContaining({ $set: expect.objectContaining({
        products: [{ name: 'Masoor Dal', quantity: 12 }, { name: 'Poha', quantity: 10 }],
      }) }),
      expect.objectContaining({ session: expect.anything() })
    );
    expect(EmailReview.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'open' }),
      expect.objectContaining({ $set: expect.objectContaining({ status: 'resolved', appliedOrderId: id }) }),
      expect.objectContaining({ session: expect.anything() })
    );
  });
});
