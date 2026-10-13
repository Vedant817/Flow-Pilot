jest.mock('mongoose', () => ({
  __esModule: true,
  default: { isValidObjectId: () => true, startSession: jest.fn(), connection: { db: { collection: jest.fn() } } },
}));
jest.mock('../lib/mongodb', () => ({ __esModule: true, default: jest.fn(async () => ({})) }));
jest.mock('../models/Inventory', () => ({
  Inventory: { findOne: jest.fn(), updateOne: jest.fn() },
}));
jest.mock('../models/InventoryMovement', () => ({
  InventoryMovement: { findOne: jest.fn(), updateOne: jest.fn(), create: jest.fn() },
}));
jest.mock('../models/Order', () => ({
  Order: { findOne: jest.fn(), updateOne: jest.fn() },
}));
jest.mock('../models/OrderEvent', () => ({ OrderEvent: { create: jest.fn() } }));

import mongoose from 'mongoose';
import { Inventory } from '../models/Inventory';
import { InventoryMovement } from '../models/InventoryMovement';
import { Order } from '../models/Order';
import { OrderEvent } from '../models/OrderEvent';
import { executeStockCommand, releaseOrderReservations, type StockCommand } from '../lib/inventory/commands';

const command: StockCommand = {
  orgId: 'org_a', actorId: 'warehouse_a', productId: 'sku-a',
  kind: 'receipt', units: 5, reason: 'Received purchase order', eventKey: 'stock:12345678',
};
let session: { withTransaction: jest.Mock; endSession: jest.Mock };
const reservationFind = jest.fn();
const reservationUpdate = jest.fn();
const reservationRows = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  session = { withTransaction: jest.fn(async callback => callback()), endSession: jest.fn(async () => undefined) };
  (mongoose.startSession as jest.Mock).mockResolvedValue(session);
  (InventoryMovement.findOne as jest.Mock).mockReturnValue({ session: async () => null });
  (Inventory.findOne as jest.Mock).mockReturnValue({
    session: async () => ({ quantity: 10, reservedQuantity: 4 }),
  });
  (Inventory.updateOne as jest.Mock).mockResolvedValue({ modifiedCount: 1 });
  (InventoryMovement.create as jest.Mock).mockImplementation(async rows => [{ toObject: () => rows[0] }]);
  (mongoose.connection.db!.collection as jest.Mock).mockReturnValue({
    findOne: reservationFind, updateOne: reservationUpdate,
    find: () => ({ toArray: reservationRows }),
  });
  (Order.findOne as jest.Mock).mockReturnValue({
    session: async () => ({
      _id: 'order-a', status: 'pending fulfillment', get: () => 0,
      products: [{ productId: 'sku-a', quantity: 6 }],
    }),
  });
  (Order.updateOne as jest.Mock).mockResolvedValue({ modifiedCount: 1 });
  reservationFind.mockResolvedValue({ reservedUnits: 4, fulfilledUnits: 0, returnedUnits: 0 });
  reservationRows.mockResolvedValue([{ productId: 'sku-a', fulfilledUnits: 2 }]);
});

test('receipt commits balance, opening provenance and movement under one session', async () => {
  const result = await executeStockCommand(command);
  expect(result.dedup).toBe(false);
  expect((Inventory.findOne as jest.Mock).mock.calls[0][0]).toEqual({ _id: 'sku-a', orgId: 'org_a' });
  expect((Inventory.updateOne as jest.Mock).mock.calls[0][2]).toMatchObject({ session });
  expect((InventoryMovement.updateOne as jest.Mock).mock.calls[0][2]).toMatchObject({ session, upsert: true });
  expect((InventoryMovement.create as jest.Mock).mock.calls[0][1]).toEqual({ session });
  expect((InventoryMovement.create as jest.Mock).mock.calls[0][0][0]).toMatchObject({
    quantityDelta: 5, balanceAfter: { quantity: 15, reservedQuantity: 4 },
  });
});

test('matching command retry does not change stock again', async () => {
  await executeStockCommand(command);
  const record = (InventoryMovement.create as jest.Mock).mock.calls[0][0][0];
  (InventoryMovement.findOne as jest.Mock).mockReturnValue({ session: async () => ({ ...record, toObject: () => record }) });
  (Inventory.updateOne as jest.Mock).mockClear();
  expect((await executeStockCommand(command)).dedup).toBe(true);
  expect(Inventory.updateOne).not.toHaveBeenCalled();
  await expect(executeStockCommand({ ...command, units: 6 })).rejects.toThrow('different stock command');
});

test('does not retry an uncertain transaction through a non-transactional path', async () => {
  (Inventory.updateOne as jest.Mock).mockRejectedValue(new Error('write interrupted'));
  await expect(executeStockCommand(command)).rejects.toThrow('write interrupted');
  expect(Inventory.updateOne).toHaveBeenCalledTimes(1);
  expect(InventoryMovement.create).not.toHaveBeenCalled();
  expect(session.endSession).toHaveBeenCalled();
});

test('fulfillment must own reserved units on the same order, not another order’s stock', async () => {
  reservationFind.mockResolvedValue({ reservedUnits: 1, fulfilledUnits: 0, returnedUnits: 0 });
  await expect(executeStockCommand({ ...command, kind: 'fulfill', units: 2, orderId: 'order-a' }, session as never))
    .rejects.toThrow('does not own enough');
  expect(Inventory.updateOne).not.toHaveBeenCalled();
  expect(reservationFind).toHaveBeenCalledWith({
    orgId: 'org_a', orderId: 'order-a', productId: 'sku-a',
  }, { session });
});

test('order cancellation/status races fail before allocation balances are changed', async () => {
  (Order.updateOne as jest.Mock).mockResolvedValue({ modifiedCount: 0 });
  await expect(executeStockCommand({ ...command, kind: 'reserve', units: 1, orderId: 'order-a' }))
    .rejects.toThrow('Order changed');
  expect(reservationUpdate).not.toHaveBeenCalled();
  expect(Inventory.updateOne).not.toHaveBeenCalled();
});

test('returns cannot exceed actually fulfilled units', async () => {
  (Order.findOne as jest.Mock).mockReturnValue({ session: async () => ({
    _id: 'order-a', status: 'fulfilled', get: () => 0,
    products: [{ productId: 'sku-a', quantity: 6 }],
  }) });
  reservationFind.mockResolvedValue({ reservedUnits: 0, fulfilledUnits: 2, returnedUnits: 1 });
  await expect(executeStockCommand({ ...command, kind: 'return', units: 2, orderId: 'order-a' }, session as never))
    .rejects.toThrow('Return exceeds');
  expect(Inventory.updateOne).not.toHaveBeenCalled();
});

test('partial fulfillment advances the order and appends its timeline atomically', async () => {
  await executeStockCommand({ ...command, kind: 'fulfill', units: 2, orderId: 'order-a' }, session as never);
  expect(Order.updateOne).toHaveBeenCalledWith(
    expect.objectContaining({ orgId: 'org_a', status: 'pending fulfillment' }),
    { $set: { status: 'partially fulfilled' } }, { session }
  );
  expect(OrderEvent.create).toHaveBeenCalledWith(
    [expect.objectContaining({ toStatus: 'partially fulfilled', orgId: 'org_a' })], { session }
  );
});

test('complete fulfillment derives terminal status from all canonical line quantities', async () => {
  reservationFind.mockResolvedValue({ reservedUnits: 4, fulfilledUnits: 2, returnedUnits: 0 });
  reservationRows.mockResolvedValue([{ productId: 'sku-a', fulfilledUnits: 6 }]);
  await executeStockCommand({ ...command, kind: 'fulfill', units: 4, orderId: 'order-a' }, session as never);
  expect(OrderEvent.create).toHaveBeenCalledWith(
    [expect.objectContaining({ toStatus: 'fulfilled' })], { session }
  );
});

test('cancellation releases owned reservations inside the caller transaction without nesting sessions', async () => {
  reservationRows.mockResolvedValue([{
    orgId: 'org_a', orderId: 'order-a', productId: 'sku-a',
    reservedUnits: 4, fulfilledUnits: 0, returnedUnits: 0,
  }]);
  (Order.findOne as jest.Mock).mockReturnValue({ session: async () => ({
    _id: 'order-a', status: 'canceled', get: () => 1,
    products: [{ productId: 'sku-a', quantity: 6 }],
  }) });
  await releaseOrderReservations('org_a', 'order-a', 'warehouse-a', 'Customer canceled', session as never);
  expect(mongoose.startSession).not.toHaveBeenCalled();
  expect(session.withTransaction).not.toHaveBeenCalled();
  expect(session.endSession).not.toHaveBeenCalled();
  expect(Inventory.updateOne).toHaveBeenCalledWith(expect.anything(),
    expect.objectContaining({ $set: { quantity: 10, reservedQuantity: 0 } }), expect.objectContaining({ session }));
});

test('cancellation refuses previously fulfilled units', async () => {
  reservationRows.mockResolvedValue([{ productId: 'sku-a', reservedUnits: 1, fulfilledUnits: 1 }]);
  await expect(releaseOrderReservations('org_a', 'order-a', 'warehouse-a', 'Cancel', session as never))
    .rejects.toThrow('Already fulfilled');
  expect(Inventory.updateOne).not.toHaveBeenCalled();
});
