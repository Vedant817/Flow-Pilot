/** @jest-environment node */
jest.mock('mongoose', () => ({
  __esModule: true, default: { Types: { ObjectId: { isValid: () => true } } },
}));
jest.mock('../lib/auth', () => ({
  requirePermission: jest.fn(async () => ({ orgId: 'org_a', userId: 'operator' })),
  requireWorkspace: jest.fn(),
  AuthorizationError: class extends Error { constructor(message: string, public status: number) { super(message); } },
}));
jest.mock('../lib/mongodb', () => ({ __esModule: true, default: jest.fn(async () => ({})) }));
jest.mock('../models/Inventory', () => ({
  Inventory: { findOne: jest.fn(), findOneAndUpdate: jest.fn(), findOneAndDelete: jest.fn() },
}));
jest.mock('../models/InventoryMovement', () => ({ InventoryMovement: { exists: jest.fn() } }));

import { NextRequest } from 'next/server';
import { PUT, DELETE } from '../app/api/inventory/[id]/route';
import { Inventory } from '../models/Inventory';
import { InventoryMovement } from '../models/InventoryMovement';
import { requirePermission, AuthorizationError } from '../lib/auth';

const context = { params: Promise.resolve({ id: 'sku-a' }) };
const request = (body: unknown) => new NextRequest('https://app.example/api/inventory/sku-a', {
  method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});
beforeEach(() => {
  jest.clearAllMocks();
  (requirePermission as jest.Mock).mockResolvedValue({ orgId: 'org_a', userId: 'operator' });
  (Inventory.findOne as jest.Mock).mockReturnValue({ lean: async () => ({
    _id: 'sku-a', price: 10, quantity: 0, reservedQuantity: 0, __v: 2,
  }) });
  (Inventory.findOneAndUpdate as jest.Mock).mockResolvedValue({ _id: 'sku-a' });
  (InventoryMovement.exists as jest.Mock).mockResolvedValue(null);
});

test('metadata writes cannot bypass the inventory ledger', async () => {
  expect((await PUT(request({ quantity: 100, expectedVersion: 2 }), context)).status).toBe(400);
  expect(Inventory.findOneAndUpdate).not.toHaveBeenCalled();
});

test('metadata changes enforce version fencing and do not rewrite unchanged prices', async () => {
  expect((await PUT(request({ name: 'Renamed SKU', price: 10, expectedVersion: 2 }), context)).status).toBe(200);
  const [filter, update] = (Inventory.findOneAndUpdate as jest.Mock).mock.calls[0];
  expect(filter.orgId).toBe('org_a');
  expect(filter.$expr).toEqual({ $eq: [{ $ifNull: ['$__v', 0] }, 2] });
  expect(update.$inc).toEqual({ __v: 1 });
  expect(update.$set.price).toBeUndefined();
});

test('price changes require pricing permission in addition to inventory permission', async () => {
  (requirePermission as jest.Mock)
    .mockResolvedValueOnce({ orgId: 'org_a', userId: 'operator' })
    .mockRejectedValueOnce(new AuthorizationError('Missing pricing permission', 403));
  expect((await PUT(request({ price: 20, expectedVersion: 2 }), context)).status).toBe(403);
  expect(requirePermission).toHaveBeenLastCalledWith('pricing:write');
  expect(Inventory.findOneAndUpdate).not.toHaveBeenCalled();
});

test('stale metadata is refused rather than overwriting a stock/price update', async () => {
  expect((await PUT(request({ name: 'Old edit', expectedVersion: 1 }), context)).status).toBe(409);
  expect(Inventory.findOneAndUpdate).not.toHaveBeenCalled();
});

test('audited inventory cannot be destructively deleted', async () => {
  (InventoryMovement.exists as jest.Mock).mockResolvedValue({ _id: 'movement-a' });
  expect((await DELETE(request({}), context)).status).toBe(409);
  expect(Inventory.findOneAndDelete).not.toHaveBeenCalled();
});
