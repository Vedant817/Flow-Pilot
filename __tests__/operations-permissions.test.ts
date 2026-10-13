/** @jest-environment node */
jest.mock('../lib/auth', () => ({
  requireWorkspace: jest.fn(async () => ({ orgId: 'org_a', userId: 'user-a', role: 'operator' })),
  requirePermission: jest.fn(),
  AuthorizationError: class extends Error { constructor(message: string, public status: number) { super(message); } },
}));
jest.mock('../lib/orders/operations', () => ({
  createShipment: jest.fn(async () => ({})), markShipmentDelivered: jest.fn(),
  requestReturn: jest.fn(), decideReturn: jest.fn(async () => ({})), receiveReturn: jest.fn(),
}));
jest.mock('mongoose', () => ({ __esModule: true, default: { isValidObjectId: () => true } }));
jest.mock('../models/Order', () => ({ Order: {} }));
jest.mock('../models/Shipment', () => ({ Shipment: {} }));
jest.mock('../models/ReturnAuthorization', () => ({ ReturnAuthorization: {} }));

import { NextRequest } from 'next/server';
import { POST } from '../app/api/orders/[id]/operations/route';
import { requirePermission, AuthorizationError } from '../lib/auth';
import { createShipment, decideReturn } from '../lib/orders/operations';

const request = (action: string) => new NextRequest('https://app.example/api/orders/order-a/operations', {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'operation:12345678' },
  body: JSON.stringify({ action, returnId: 'return-a', note: 'Decision', orgId: 'foreign-org', actorId: 'forged-actor' }),
});
beforeEach(() => {
  jest.clearAllMocks(); (requirePermission as jest.Mock).mockResolvedValue({});
});
test('dispatch requires both inventory and order capabilities before invoking commands', async () => {
  (requirePermission as jest.Mock).mockResolvedValueOnce({}).mockRejectedValueOnce(new AuthorizationError('Forbidden', 403));
  expect((await POST(request('shipment.create'), { params: Promise.resolve({ id: 'order-a' }) })).status).toBe(403);
  expect(createShipment).not.toHaveBeenCalled();
});
test('return decisions use a finance capability and derive actor/workspace only from the session', async () => {
  expect((await POST(request('return.authorize'), { params: Promise.resolve({ id: 'order-a' }) })).status).toBe(200);
  expect(requirePermission).toHaveBeenCalledWith('returns:approve');
  expect(decideReturn).toHaveBeenCalledWith({ orgId: 'org_a', userId: 'user-a', role: 'operator' }, 'order-a', 'return-a', true, 'Decision');
});
