jest.mock('mongoose', () => ({
  __esModule: true, default: { isValidObjectId: () => true, startSession: jest.fn(), connection: { db: { collection: jest.fn() } } },
}));
jest.mock('../lib/mongodb', () => ({ __esModule: true, default: jest.fn(async () => ({})) }));
jest.mock('../models/Order', () => ({ Order: { findOne: jest.fn(), updateOne: jest.fn() } }));
jest.mock('../models/OrderEvent', () => ({ OrderEvent: { create: jest.fn() } }));
jest.mock('../models/Shipment', () => ({ Shipment: { findOne: jest.fn(), create: jest.fn(), findOneAndUpdate: jest.fn() } }));
jest.mock('../models/ReturnAuthorization', () => ({ ReturnAuthorization: { findOne: jest.fn(), find: jest.fn(), create: jest.fn() } }));
jest.mock('../lib/inventory/commands', () => ({ executeStockCommand: jest.fn(async () => ({ dedup: false })) }));

import mongoose from 'mongoose';
import { Order } from '../models/Order';
import { Shipment } from '../models/Shipment';
import { ReturnAuthorization } from '../models/ReturnAuthorization';
import { executeStockCommand } from '../lib/inventory/commands';
import { createShipment, decideReturn, receiveReturn } from '../lib/orders/operations';

const actor = { orgId: 'org_a', userId: 'warehouse-a', role: 'warehouse' as const };
const session = { withTransaction: jest.fn(async callback => callback()), endSession: jest.fn(async () => undefined) };
const findOne = jest.fn();
const insertOne = jest.fn();
const id = '507f1f77bcf86cd799439011';
const order = {
  _id: 'order-a', status: 'fulfilled', get: () => 0,
  products: [{ productId: id, quantity: 2, lineValueMinor: 2000 }],
  pricing: { finalMinor: 1800, currency: 'INR', priceSource: 'inventory' },
};
beforeEach(() => {
  jest.clearAllMocks();
  (mongoose.startSession as jest.Mock).mockResolvedValue(session);
  (Order.findOne as jest.Mock).mockReturnValue({ session: async () => order });
  (Order.updateOne as jest.Mock).mockResolvedValue({ modifiedCount: 1 });
  (Shipment.findOne as jest.Mock).mockReturnValue({ session: async () => null });
  (Shipment.create as jest.Mock).mockImplementation(async rows => [{ _id: 'shipment-a', toObject: () => rows[0] }]);
  (mongoose.connection.db!.collection as jest.Mock).mockImplementation(name => ({
    findOne: name === 'financial_credits' ? async () => null : findOne, insertOne,
  }));
  findOne.mockResolvedValue({ reservedUnits: 0, fulfilledUnits: 2, returnedUnits: 0 });
});
test('dispatch inventory movements and the shipment share one transaction', async () => {
  await createShipment(actor, 'order-a', { lines: [{ productId: id, quantity: 1 }], carrier: 'Local carrier', trackingNumber: 'tracking-1', key: 'ship:12345678' });
  expect(executeStockCommand).toHaveBeenCalledWith(expect.objectContaining({ orgId: 'org_a', orderId: 'order-a', kind: 'fulfill' }), session);
  expect(Shipment.create).toHaveBeenCalledWith(expect.anything(), { session });
});
test('stock dispatch failure never creates a shipment outside the transaction', async () => {
  (executeStockCommand as jest.Mock).mockRejectedValueOnce(new Error('stock conflict'));
  await expect(createShipment(actor, 'order-a', { lines: [{ productId: id, quantity: 1 }], carrier: 'Carrier', trackingNumber: 'tracking-1', key: 'ship:12345678' })).rejects.toThrow('stock conflict');
  expect(Shipment.create).not.toHaveBeenCalled();
});
test('return authorization requires a different approver from the request author', async () => {
  (ReturnAuthorization.findOne as jest.Mock).mockReturnValue({ session: async () => ({ status: 'requested', requestedBy: actor.userId }) });
  await expect(decideReturn({ ...actor, role: 'finance' }, 'order-a', 'return-a', true, 'Approved')).rejects.toThrow('different approver');
  expect(executeStockCommand).not.toHaveBeenCalled();
});
test('damaged received goods go through quarantine and create an exact credit memo, not a payment refund', async () => {
  const record = { status: 'authorized', lines: [{ productId: id, quantity: 1, received: 0 }], save: jest.fn() };
  (ReturnAuthorization.findOne as jest.Mock).mockReturnValue({ session: async () => record });
  const result = await receiveReturn(actor, 'order-a', 'return-a', {
    lines: [{ productId: id, quantity: 1, disposition: 'damaged' }], note: 'Inspection confirms damage', key: 'receive:12345678',
  });
  expect(executeStockCommand).toHaveBeenCalledWith(expect.objectContaining({ kind: 'return_damaged', units: 1 }), session);
  expect(result.credit).toMatchObject({ amountMinor: 900, kind: 'credit_memo', currency: 'INR' });
  expect(result.credit).not.toHaveProperty('refunded');
  expect(record.save).toHaveBeenCalledWith({ session });
  expect(insertOne).toHaveBeenCalledWith(expect.objectContaining({ amountMinor: 900, orgId: 'org_a' }), { session });
});
test('receipt is refused unless the return has been authorized', async () => {
  (ReturnAuthorization.findOne as jest.Mock).mockReturnValue({ session: async () => null });
  await expect(receiveReturn(actor, 'order-a', 'return-a', {
    lines: [{ productId: id, quantity: 1, disposition: 'restock' }], note: 'Received', key: 'receive:12345678',
  })).rejects.toThrow('authorized');
  expect(executeStockCommand).not.toHaveBeenCalled();
  expect(insertOne).not.toHaveBeenCalled();
});
