jest.mock('../models/Order', () => ({
  Order: { findOne: jest.fn() },
}));
jest.mock('../models/OutboxEvent', () => ({
  OutboxEvent: {
    findOneAndUpdate: jest.fn(),
    updateOne: jest.fn(),
  },
}));
jest.mock('../lib/analytics/rollup', () => ({
  applyOrderDeltaOnce: jest.fn(),
}));
jest.mock('../lib/ai/memory', () => ({
  ingestDocument: jest.fn(),
}));
jest.mock('../lib/promotions/signals', () => ({
  refreshCustomerSignalForEmail: jest.fn(),
}));

import { Order } from '../models/Order';
import { OutboxEvent } from '../models/OutboxEvent';
import { applyOrderDeltaOnce } from '../lib/analytics/rollup';
import { ingestDocument } from '../lib/ai/memory';
import { refreshCustomerSignalForEmail } from '../lib/promotions/signals';
import { drainOutbox, processNextOutboxEvent } from '../lib/orders/outbox';

const claim = OutboxEvent.findOneAndUpdate as jest.Mock;
const update = OutboxEvent.updateOne as jest.Mock;
const findOrder = Order.findOne as jest.Mock;
const rollup = applyOrderDeltaOnce as jest.Mock;
const memory = ingestDocument as jest.Mock;
const signal = refreshCustomerSignalForEmail as jest.Mock;

describe('durable order outbox', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    claim.mockResolvedValue({
      _id: 'event-1', type: 'order.created', orgId: 'org_a',
      aggregateId: 'order-1', attempts: 1,
    });
    update.mockResolvedValue({ modifiedCount: 1 });
    findOrder.mockReturnValue({
      lean: async () => ({
        _id: 'order-1', date: '2026-04-01', status: 'pending fulfillment',
        email: 'buyer@example.com',
        products: [{ name: 'Widget', quantity: 2 }],
      }),
    });
    rollup.mockResolvedValue(true);
    memory.mockResolvedValue(undefined);
    signal.mockResolvedValue(undefined);
  });

  it('claims only tenant events and fences completion to the lease owner', async () => {
    expect(await processNextOutboxEvent('org_a')).toBe('processed');
    expect(claim.mock.calls[0][0]).toMatchObject({ orgId: 'org_a' });
    const owner = claim.mock.calls[0][1].$set.leaseOwner;
    expect(findOrder).toHaveBeenCalledWith({ _id: 'order-1', orgId: 'org_a' });
    expect(rollup).toHaveBeenCalledWith(
      'event-1', 'org_a', '2026-04-01', [{ name: 'Widget', quantity: 2 }], 1
    );
    expect(update.mock.calls[0][0]).toEqual({
      _id: 'event-1', orgId: 'org_a', leaseOwner: owner,
    });
    expect(update.mock.calls[0][1].$set.status).toBe('completed');
    expect(memory.mock.calls[0][3]).not.toContain('buyer@example.com');
  });

  it('persists retry state when a downstream consumer fails', async () => {
    rollup.mockRejectedValue(new Error('projection unavailable'));
    expect(await processNextOutboxEvent('org_a')).toBe('failed');
    expect(update.mock.calls[0][1].$set).toMatchObject({
      status: 'pending', lastError: 'projection unavailable',
    });
    expect(signal).not.toHaveBeenCalled();
    expect(memory).not.toHaveBeenCalled();
  });

  it('retains exhausted events for operator recovery', async () => {
    claim.mockResolvedValue({
      _id: 'event-1', type: 'order.created', orgId: 'org_a',
      aggregateId: 'order-1', attempts: 10,
    });
    rollup.mockRejectedValue(new Error('projection unavailable'));
    expect(await processNextOutboxEvent('org_a')).toBe('failed');
    expect(update.mock.calls[0][1].$set.status).toBe('failed');
  });

  it('does not execute consumers when no event can be claimed', async () => {
    claim.mockResolvedValue(null);
    expect(await drainOutbox('org_a')).toEqual({ processed: 0, failed: 0 });
    expect(findOrder).not.toHaveBeenCalled();
  });
});
