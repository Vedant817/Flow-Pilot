import mongoose, { type ClientSession } from 'mongoose';
import { createHash } from 'crypto';
import dbConnect from '@/lib/mongodb';
import { Order } from '@/models/Order';
import { OrderEvent } from '@/models/OrderEvent';
import { Shipment } from '@/models/Shipment';
import { ReturnAuthorization } from '@/models/ReturnAuthorization';
import { executeStockCommand } from '@/lib/inventory/commands';
import { StockConflict } from '@/lib/inventory/ledger';
import { creditForReturnedUnits } from './credits';
import { hasPermission, type AppRole, type Permission } from '@/lib/authorization';

export type OperationActor = Readonly<{ orgId: string; userId: string; role: AppRole }>;
export type OperationLine = { productId: string; quantity: number };
type Allocation = { orgId: string; orderId: string; productId: string; reservedUnits: number; fulfilledUnits: number; returnedUnits: number };
type CreditMemo = {
  orgId: string; orderId: string; returnId: string; requestKey: string; requestHash: string;
  amountMinor: number; currency: 'INR'; kind: 'credit_memo'; createdAt: Date; actorId: string;
  lines: Array<OperationLine & { disposition: 'restock' | 'damaged' }>;
};

export function validateOperationLines(lines: unknown): asserts lines is OperationLine[] {
  if (!Array.isArray(lines) || !lines.length || lines.length > 50 ||
    lines.some(line => !line || typeof line.productId !== 'string' || !mongoose.isValidObjectId(line.productId) ||
      !Number.isSafeInteger(line.quantity) || line.quantity < 1 || line.quantity > 100_000) ||
    new Set(lines.map(line => line.productId)).size !== lines.length) {
    throw new StockConflict('Use 1-50 unique canonical product lines with positive whole quantities', 400);
  }
}
function requiredText(value: unknown, name: string, limit = 500): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > limit) throw new StockConflict(`Invalid ${name}`, 400);
}
function requireKey(key: string) {
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(key)) throw new StockConflict('Invalid operation idempotency key', 400);
}
function capability(actor: OperationActor, ...permissions: Permission[]) {
  if (!actor.orgId || !actor.userId || permissions.some(permission => !hasPermission(actor.role, permission))) {
    throw new StockConflict('Operational capability is not authorized', 403);
  }
}
function hash(value: unknown) { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function stockKey(kind: string, key: string, productId: string) { return `${kind}:${hash(key).slice(0, 32)}:${productId}`; }
async function transaction<T>(apply: (session: ClientSession) => Promise<T>): Promise<T> {
  await dbConnect();
  const session = await mongoose.startSession();
  const result: { value?: T } = {};
  try { await session.withTransaction(async () => { result.value = await apply(session); }); }
  finally { await session.endSession(); }
  if (result.value === undefined) throw new Error('Operation did not commit');
  return result.value;
}
async function lockOrder(actor: OperationActor, orderId: string, session: ClientSession) {
  if (!mongoose.isValidObjectId(orderId)) throw new StockConflict('Invalid order ID', 400);
  const order = await Order.findOne({ _id: orderId, orgId: actor.orgId }).session(session);
  if (!order) throw new StockConflict('Order not found', 404);
  const locked = await Order.updateOne({ _id: order._id, orgId: actor.orgId, __v: order.get('__v') },
    { $inc: { __v: 1 } }, { session });
  if (locked.modifiedCount !== 1) throw new StockConflict('Order changed; reload before retrying');
  return order;
}
async function timeline(actor: OperationActor, orderId: string, type: 'shipment.created' | 'shipment.delivered' | 'return.requested' | 'return.authorized' | 'return.rejected' | 'return.received', reason: string, session: ClientSession) {
  const order = await Order.findOne({ _id: orderId, orgId: actor.orgId }).session(session);
  if (!order) throw new StockConflict('Order not found', 404);
  await OrderEvent.create([{ orgId: actor.orgId, orderId, actorId: actor.userId, type, toStatus: order.status, reason: reason.slice(0, 500) }], { session });
}

export async function createShipment(actor: OperationActor, orderId: string, input: {
  lines: OperationLine[]; carrier: string; trackingNumber: string; key: string;
}) {
  capability(actor, 'orders:write', 'inventory:write');
  validateOperationLines(input.lines); requiredText(input.carrier, 'carrier', 80);
  requiredText(input.trackingNumber, 'tracking reference', 160); requireKey(input.key);
  const requestHash = hash({ orderId, lines: input.lines, carrier: input.carrier.trim(), trackingNumber: input.trackingNumber.trim() });
  return transaction(async session => {
    const existing = await Shipment.findOne({ orgId: actor.orgId, requestKey: input.key }).session(session);
    if (existing) {
      if (existing.requestHash !== requestHash) throw new StockConflict('Shipment key has a different intent');
      return { shipment: existing.toObject(), dedup: true };
    }
    await lockOrder(actor, orderId, session);
    for (const line of input.lines) await executeStockCommand({
      orgId: actor.orgId, actorId: actor.userId, orderId, productId: line.productId,
      kind: 'fulfill', units: line.quantity, reason: `Dispatch via ${input.carrier.trim()}`,
      eventKey: stockKey('ship', input.key, line.productId),
    }, session);
    const [shipment] = await Shipment.create([{
      orgId: actor.orgId, orderId, requestKey: input.key, requestHash,
      lines: input.lines, carrier: input.carrier.trim(), trackingNumber: input.trackingNumber.trim(),
      status: 'shipped', shippedAt: new Date(), createdBy: actor.userId,
    }], { session });
    await timeline(actor, orderId, 'shipment.created', `Shipment ${shipment._id}`, session);
    return { shipment: shipment.toObject(), dedup: false };
  });
}

export async function markShipmentDelivered(actor: OperationActor, orderId: string, shipmentId: string, proof: string) {
  capability(actor, 'orders:write');
  requiredText(proof, 'delivery proof'); if (!mongoose.isValidObjectId(shipmentId)) throw new StockConflict('Invalid shipment ID', 400);
  return transaction(async session => {
    const existing = await Shipment.findOne({ _id: shipmentId, orgId: actor.orgId, orderId }).session(session);
    if (existing?.status === 'delivered') {
      if (existing.deliveryProof !== proof.trim()) throw new StockConflict('Delivery has different recorded proof');
      return { shipment: existing.toObject(), dedup: true };
    }
    const updated = await Shipment.findOneAndUpdate({ _id: shipmentId, orgId: actor.orgId, orderId, status: 'shipped' },
      { $set: { status: 'delivered', deliveredAt: new Date(), deliveryProof: proof.trim() } }, { session, new: true });
    if (!updated) throw new StockConflict('Shipment not found or already delivered');
    await timeline(actor, orderId, 'shipment.delivered', proof.trim(), session);
    return { shipment: updated.toObject() };
  });
}

export async function requestReturn(actor: OperationActor, orderId: string, input: { lines: OperationLine[]; reason: string; key: string }) {
  capability(actor, 'orders:write');
  validateOperationLines(input.lines); requiredText(input.reason, 'return reason'); requireKey(input.key);
  const requestHash = hash({ orderId, lines: input.lines, reason: input.reason.trim() });
  return transaction(async session => {
    const existing = await ReturnAuthorization.findOne({ orgId: actor.orgId, requestKey: input.key }).session(session);
    if (existing) {
      if (existing.requestHash !== requestHash) throw new StockConflict('Return key has a different intent');
      return { authorization: existing.toObject(), dedup: true };
    }
    await lockOrder(actor, orderId, session);
    const allocations = mongoose.connection.db!.collection<Allocation>('inventory_reservations');
    for (const line of input.lines) {
      const allocation = await allocations.findOne({ orgId: actor.orgId, orderId, productId: line.productId }, { session });
      if (!allocation || allocation.fulfilledUnits - allocation.returnedUnits < line.quantity) throw new StockConflict('Return request exceeds fulfilled units');
    }
    const [authorization] = await ReturnAuthorization.create([{
      orgId: actor.orgId, orderId, requestKey: input.key, requestHash, status: 'requested',
      lines: input.lines.map(line => ({ ...line, received: 0 })), reason: input.reason.trim(),
      requestedBy: actor.userId, requestedAt: new Date(),
    }], { session });
    await timeline(actor, orderId, 'return.requested', input.reason.trim(), session);
    return { authorization: authorization.toObject(), dedup: false };
  });
}

export async function decideReturn(actor: OperationActor, orderId: string, returnId: string, authorize: boolean, note: string) {
  capability(actor, 'returns:approve');
  requiredText(note, 'decision note'); if (!mongoose.isValidObjectId(returnId)) throw new StockConflict('Invalid return ID', 400);
  return transaction(async session => {
    const authorization = await ReturnAuthorization.findOne({ _id: returnId, orgId: actor.orgId, orderId }).session(session);
    if (!authorization) throw new StockConflict('Return not found', 404);
    if (authorization.status !== 'requested') {
      if (authorization.decidedBy === actor.userId && authorization.decisionNote === note.trim() &&
        (authorize ? ['authorized', 'received'].includes(authorization.status) : authorization.status === 'rejected')) {
        return { authorization: authorization.toObject(), dedup: true };
      }
      throw new StockConflict('Return is not awaiting authorization');
    }
    if (authorization.requestedBy === actor.userId) throw new StockConflict('A different approver must decide this return', 403);
    await lockOrder(actor, orderId, session);
    if (authorize) {
      const outstanding = await ReturnAuthorization.find({ orgId: actor.orgId, orderId, status: 'authorized' }).session(session).lean();
      for (const line of authorization.lines) {
        const allocation = await mongoose.connection.db!.collection<Allocation>('inventory_reservations')
          .findOne({ orgId: actor.orgId, orderId, productId: line.productId }, { session });
        const held = outstanding.reduce((sum, row) => sum + row.lines.filter(value => value.productId === line.productId)
          .reduce((count, value) => count + value.quantity - value.received, 0), 0);
        if (!allocation || allocation.fulfilledUnits - allocation.returnedUnits - held < line.quantity) {
          throw new StockConflict('Other authorized returns already hold these units');
        }
      }
    }
    authorization.status = authorize ? 'authorized' : 'rejected';
    authorization.decidedBy = actor.userId; authorization.decidedAt = new Date(); authorization.decisionNote = note.trim();
    await authorization.save({ session });
    await timeline(actor, orderId, authorize ? 'return.authorized' : 'return.rejected', note.trim(), session);
    return { authorization: authorization.toObject() };
  });
}

export async function receiveReturn(actor: OperationActor, orderId: string, returnId: string, input: {
  lines: Array<OperationLine & { disposition: 'restock' | 'damaged' }>; note: string; key: string;
}) {
  capability(actor, 'orders:write', 'inventory:write');
  validateOperationLines(input.lines); requiredText(input.note, 'inspection note'); requireKey(input.key);
  if (!mongoose.isValidObjectId(returnId) || input.lines.some(line => !['restock', 'damaged'].includes(line.disposition))) throw new StockConflict('Invalid return receipt', 400);
  const requestHash = hash({ orderId, returnId, lines: input.lines, note: input.note.trim() });
  return transaction(async session => {
    const credits = mongoose.connection.db!.collection<CreditMemo>('financial_credits');
    const existing = await credits.findOne({ orgId: actor.orgId, requestKey: input.key }, { session });
    if (existing) {
      if (existing.requestHash !== requestHash) throw new StockConflict('Receipt key has a different intent');
      return { credit: existing, dedup: true };
    }
    const authorization = await ReturnAuthorization.findOne({ _id: returnId, orgId: actor.orgId, orderId, status: 'authorized' }).session(session);
    if (!authorization) throw new StockConflict('Return must be authorized before goods are received');
    const order = await lockOrder(actor, orderId, session);
    if (!order.pricing || order.pricing.currency !== 'INR' || order.pricing.priceSource === 'estimated') throw new StockConflict('Verified price snapshots are required for credits');
    let amountMinor = 0;
    for (const line of input.lines) {
      const approved = authorization.lines.find(row => row.productId === line.productId);
      if (!approved || approved.quantity - approved.received < line.quantity) throw new StockConflict('Receipt exceeds authorized units');
      const allocation = await mongoose.connection.db!.collection<Allocation>('inventory_reservations')
        .findOne({ orgId: actor.orgId, orderId, productId: line.productId }, { session });
      if (!allocation) throw new StockConflict('Fulfillment proof is missing');
      amountMinor += creditForReturnedUnits(order.products, order.pricing.finalMinor, line.productId, allocation.returnedUnits, line.quantity);
      await executeStockCommand({
        orgId: actor.orgId, actorId: actor.userId, orderId, productId: line.productId,
        kind: line.disposition === 'restock' ? 'return' : 'return_damaged', units: line.quantity,
        reason: input.note.trim(), eventKey: stockKey('return', input.key, line.productId),
      }, session);
      approved.received += line.quantity;
    }
    if (authorization.lines.every(line => line.received === line.quantity)) {
      authorization.status = 'received'; authorization.receivedAt = new Date();
    }
    await authorization.save({ session });
    const credit: CreditMemo = {
      orgId: actor.orgId, orderId, returnId, requestKey: input.key, requestHash,
      amountMinor, currency: 'INR', kind: 'credit_memo', createdAt: new Date(), actorId: actor.userId, lines: input.lines,
    };
    await credits.insertOne(credit, { session });
    await timeline(actor, orderId, 'return.received', `Credit memo ${amountMinor} minor units; ${input.note.trim()}`, session);
    return { credit, dedup: false };
  });
}
