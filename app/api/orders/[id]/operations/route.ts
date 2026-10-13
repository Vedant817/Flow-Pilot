import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';
import { requireWorkspace, requirePermission, AuthorizationError } from '@/lib/auth';
import { hasPermission } from '@/lib/authorization';
import dbConnect from '@/lib/mongodb';
import { Order } from '@/models/Order';
import { Shipment } from '@/models/Shipment';
import { ReturnAuthorization } from '@/models/ReturnAuthorization';
import { StockConflict } from '@/lib/inventory/ledger';
import { resolveIdempotencyKey, IdempotencyError } from '@/lib/orders/idempotency';
import { createShipment, markShipmentDelivered, requestReturn, decideReturn, receiveReturn } from '@/lib/orders/operations';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireWorkspace();
    if (!hasPermission(auth.role, 'orders:write') && !hasPermission(auth.role, 'returns:approve')) throw new AuthorizationError('Operational access required', 403);
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) throw new StockConflict('Invalid order ID', 400);
    await dbConnect();
    const order = await Order.findOne({ _id: id, orgId: auth.orgId }).select('products pricing status date time').lean();
    if (!order) throw new StockConflict('Order not found', 404);
    const scope = { orgId: auth.orgId, orderId: id };
    const [shipments, returns, credits] = await Promise.all([
      Shipment.find(scope).sort({ shippedAt: -1 }).limit(100).lean(),
      ReturnAuthorization.find(scope).sort({ requestedAt: -1 }).limit(100).lean(),
      mongoose.connection.db!.collection('financial_credits').find(scope).sort({ createdAt: -1 }).limit(100).toArray(),
    ]);
    return NextResponse.json({ order, shipments, returns, credits, capabilities: {
      dispatch: hasPermission(auth.role, 'inventory:write') && hasPermission(auth.role, 'orders:write'),
      requestReturn: hasPermission(auth.role, 'orders:write'), approveReturn: hasPermission(auth.role, 'returns:approve'),
    } }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return failure(error); }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!request.headers.get('content-type')?.startsWith('application/json')) throw new StockConflict('JSON content type required', 415);
    if (request.headers.get('origin') && request.headers.get('origin') !== request.nextUrl.origin) throw new AuthorizationError('Cross-origin mutation refused', 403);
    const auth = await requireWorkspace();
    const { id } = await params;
    const body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new StockConflict('Invalid operation payload', 400);
    const actor = { orgId: auth.orgId, userId: auth.userId, role: auth.role };
    const key = () => resolveIdempotencyKey(request.headers.get('idempotency-key'), body.idempotencyKey);
    let result: unknown;
    switch (body.action) {
      case 'shipment.create':
        await requirePermission('orders:write'); await requirePermission('inventory:write');
        result = await createShipment(actor, id, { lines: body.lines, carrier: body.carrier, trackingNumber: body.trackingNumber, key: key() }); break;
      case 'shipment.deliver':
        await requirePermission('orders:write');
        result = await markShipmentDelivered(actor, id, body.shipmentId, body.note); break;
      case 'return.request':
        await requirePermission('orders:write');
        result = await requestReturn(actor, id, { lines: body.lines, reason: body.note, key: key() }); break;
      case 'return.authorize': case 'return.reject':
        await requirePermission('returns:approve');
        result = await decideReturn(actor, id, body.returnId, body.action === 'return.authorize', body.note); break;
      case 'return.receive':
        await requirePermission('orders:write'); await requirePermission('inventory:write');
        result = await receiveReturn(actor, id, body.returnId, { lines: body.lines, note: body.note, key: key() }); break;
      default: throw new StockConflict('Unknown order operation', 400);
    }
    return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return failure(error); }
}
function failure(error: unknown) {
  if (error instanceof AuthorizationError || error instanceof StockConflict || error instanceof IdempotencyError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof SyntaxError) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  console.error('Order operation failed', error instanceof Error ? error.name : 'UnknownError');
  return NextResponse.json({ error: 'Operation unavailable; retry with the same idempotency key' }, { status: 503 });
}
