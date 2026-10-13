import mongoose from 'mongoose';
import { createHash } from 'crypto';
import dbConnect from '@/lib/mongodb';
import { Inventory } from '@/models/Inventory';
import { InventoryMovement } from '@/models/InventoryMovement';
import { Order } from '@/models/Order';
import { OrderEvent } from '@/models/OrderEvent';
import { fulfillmentStatus } from '@/lib/orders/fulfillment';
import { assertOrderTransition } from '@/lib/orders/lifecycle';
import { planStockMovement, StockConflict, type StockMovementKind } from './ledger';

export type StockCommand = {
  orgId: string; actorId: string; productId: string; orderId?: string;
  kind: StockMovementKind; units: number; reason: string; eventKey: string;
};
type Reservation = {
  orgId: string; orderId: string; productId: string;
  reservedUnits: number; fulfilledUnits: number; returnedUnits: number;
};

function fingerprint(command: StockCommand) {
  return createHash('sha256').update(JSON.stringify({
    productId: command.productId, orderId: command.orderId ?? null,
    kind: command.kind, units: command.units, reason: command.reason.trim(),
  })).digest('hex');
}

export async function executeStockCommand(command: StockCommand, existingSession?: mongoose.ClientSession) {
  if (!command.orgId || !command.actorId || !mongoose.isValidObjectId(command.productId) ||
    typeof command.reason !== 'string' || !command.reason.trim() || command.reason.length > 500 ||
    !/^[A-Za-z0-9._:-]{8,128}$/.test(command.eventKey) || command.eventKey.startsWith('opening:')) {
    throw new StockConflict('Invalid inventory command identity, reason or idempotency key', 400);
  }
  const linked = ['reserve', 'release', 'fulfill', 'return', 'return_damaged'].includes(command.kind);
  if (['fulfill', 'return', 'return_damaged'].includes(command.kind) && !existingSession) {
    throw new StockConflict('Dispatch and returns require their authorized operational transaction');
  }
  if (linked && (!command.orderId || !mongoose.isValidObjectId(command.orderId))) {
    throw new StockConflict('A valid order ID is required for this movement', 400);
  }
  if (!linked && command.orderId) throw new StockConflict('Receipt/adjustment cannot claim an order', 400);
  const requestHash = fingerprint(command);
  await dbConnect();
  const session = existingSession ?? await mongoose.startSession();
  const result: { movement?: unknown; dedup: boolean } = { dedup: false };
  try {
    const apply = async () => {
      result.dedup = false;
      const existing = await InventoryMovement.findOne({ orgId: command.orgId, eventKey: command.eventKey }).session(session);
      if (existing) {
        if (existing.requestHash !== requestHash) throw new StockConflict('Idempotency key was used for a different stock command');
        result.movement = existing.toObject();
        result.dedup = true;
        return;
      }
      const stock = await Inventory.findOne({ _id: command.productId, orgId: command.orgId }).session(session);
      if (!stock) throw new StockConflict('Inventory item not found', 404);
      const before = { quantity: stock.quantity, reservedQuantity: stock.reservedQuantity ?? 0 };
      const next = planStockMovement(before, command.kind, command.units);
      const quarantined = stock.quarantinedQuantity ?? 0;
      if (!Number.isSafeInteger(quarantined) || quarantined < 0 ||
        !Number.isSafeInteger(quarantined + (command.kind === 'return_damaged' ? command.units : 0))) {
        throw new StockConflict('Invalid quarantined stock balance');
      }
      const db = mongoose.connection.db!;
      if (linked) {
        const order = await Order.findOne({ _id: command.orderId, orgId: command.orgId }).session(session);
        if (!order) throw new StockConflict('Order not found', 404);
        if (['reserve', 'fulfill'].includes(command.kind) &&
          !['pending fulfillment', 'partially fulfilled'].includes(order.status)) {
          throw new StockConflict('This order cannot receive allocations or fulfillment');
        }
        if (command.kind === 'release' &&
          !['pending fulfillment', 'partially fulfilled', 'canceled'].includes(order.status)) {
          throw new StockConflict('Reservations cannot be released in this order state');
        }
        if (['return', 'return_damaged'].includes(command.kind) && !['partially fulfilled', 'fulfilled'].includes(order.status)) {
          throw new StockConflict('Only orders with recorded fulfillment can receive returns');
        }
        const orderedUnits = order.products
          .filter(line => line.productId === command.productId)
          .reduce((sum, line) => sum + line.quantity, 0);
        if (!orderedUnits) throw new StockConflict('Order has no canonical line for this inventory item');
        // Serialize allocations against status changes/cancellation, not just stock.
        const lockedOrder = await Order.updateOne(
          { _id: order._id, orgId: command.orgId, status: order.status, __v: order.get('__v') },
          { $inc: { __v: 1 } }, { session }
        );
        if (lockedOrder.modifiedCount !== 1) throw new StockConflict('Order changed during stock allocation');
        const reservations = db.collection<Reservation>('inventory_reservations');
        const reservationFilter = { orgId: command.orgId, orderId: command.orderId!, productId: command.productId };
        const reservation = await reservations.findOne(reservationFilter, { session });
        const balances: Reservation = {
          ...reservationFilter, reservedUnits: reservation?.reservedUnits ?? 0,
          fulfilledUnits: reservation?.fulfilledUnits ?? 0, returnedUnits: reservation?.returnedUnits ?? 0,
        };
        if ([balances.reservedUnits, balances.fulfilledUnits, balances.returnedUnits]
          .some(value => !Number.isSafeInteger(value) || value < 0) ||
          balances.returnedUnits > balances.fulfilledUnits ||
          balances.reservedUnits + balances.fulfilledUnits > orderedUnits) throw new StockConflict('Invalid order allocation balances');
        if (command.kind === 'reserve') {
          if (balances.reservedUnits + balances.fulfilledUnits + command.units > orderedUnits) {
            throw new StockConflict('Allocation exceeds the ordered quantity');
          }
          balances.reservedUnits += command.units;
        } else if (command.kind === 'release' || command.kind === 'fulfill') {
          if (balances.reservedUnits < command.units) throw new StockConflict('This order does not own enough reserved stock');
          balances.reservedUnits -= command.units;
          if (command.kind === 'fulfill') balances.fulfilledUnits += command.units;
        } else {
          if (balances.fulfilledUnits - balances.returnedUnits < command.units) {
            throw new StockConflict('Return exceeds this order’s fulfilled units');
          }
          balances.returnedUnits += command.units;
        }
        await reservations.updateOne(reservationFilter, { $set: balances }, { upsert: true, session });
        if (command.kind === 'fulfill') {
          const allocations = await reservations.find({ orgId: command.orgId, orderId: command.orderId }, { session }).toArray();
          const status = fulfillmentStatus(order.products, allocations);
          if (status !== order.status) {
            assertOrderTransition(order.status, status);
            await Order.updateOne({ _id: order._id, orgId: command.orgId, status: order.status },
              { $set: { status } }, { session });
            await OrderEvent.create([{
              orgId: command.orgId, orderId: command.orderId, actorId: command.actorId,
              type: 'status.changed', fromStatus: order.status, toStatus: status,
              reason: `Stock fulfillment: ${command.reason.trim()}`.slice(0, 500),
            }], { session });
          }
        }
      }
      // Seed legacy stock once, preserving the pre-command balance as provenance.
      await InventoryMovement.updateOne(
        { orgId: command.orgId, eventKey: `opening:${command.productId}` },
        { $setOnInsert: {
          orgId: command.orgId, productId: command.productId, kind: 'opening',
          quantityDelta: before.quantity, reservedDelta: before.reservedQuantity,
          balanceAfter: before, actorId: command.actorId, reason: 'Initial audited stock snapshot',
          eventKey: `opening:${command.productId}`, requestHash: 'opening-v1', at: new Date(),
          provenance: 'legacy_snapshot',
        } }, { upsert: true, session }
      );
      const updated = await Inventory.updateOne(
        { _id: command.productId, orgId: command.orgId, quantity: before.quantity,
          $expr: { $eq: [{ $ifNull: ['$reservedQuantity', 0] }, before.reservedQuantity] } },
        { $set: { quantity: next.quantity, reservedQuantity: next.reservedQuantity },
          $inc: { __v: 1, ...(command.kind === 'return_damaged' ? { quarantinedQuantity: command.units } : {}) } },
        { session, runValidators: true }
      );
      if (updated.modifiedCount !== 1) throw new StockConflict('Stock changed; reload and retry the command');
      const [movement] = await InventoryMovement.create([{
        orgId: command.orgId, productId: command.productId, orderId: command.orderId,
        kind: command.kind, quantityDelta: next.quantityDelta, reservedDelta: next.reservedDelta,
        balanceAfter: { quantity: next.quantity, reservedQuantity: next.reservedQuantity },
        actorId: command.actorId, reason: command.reason.trim(),
        units: command.units, quarantinedDelta: command.kind === 'return_damaged' ? command.units : 0,
        eventKey: command.eventKey, requestHash,
      }], { session });
      result.movement = movement.toObject();
    };
    if (existingSession) await apply();
    else await session.withTransaction(apply);
  } catch (error) {
    if (existingSession) throw error;
    if ((error as { code?: number })?.code !== 11000) throw error;
    const existing = await InventoryMovement.findOne({ orgId: command.orgId, eventKey: command.eventKey }).lean();
    if (!existing || existing.requestHash !== requestHash) throw new StockConflict('Conflicting stock command');
    result.movement = existing;
    result.dedup = true;
  } finally {
    if (!existingSession) await session.endSession();
  }
  return result;
}

export async function releaseOrderReservations(
  orgId: string, orderId: string, actorId: string, reason: string, session: mongoose.ClientSession
): Promise<void> {
  const reservations = mongoose.connection.db!.collection<Reservation>('inventory_reservations');
  const rows = await reservations.find({ orgId, orderId }, { session }).toArray();
  if (rows.some(row => row.fulfilledUnits > 0)) {
    throw new StockConflict('Already fulfilled units cannot be canceled; use a return workflow');
  }
  for (const row of rows) {
    if (row.reservedUnits > 0) await executeStockCommand({
      orgId, actorId, orderId, productId: row.productId,
      kind: 'release', units: row.reservedUnits, reason,
      eventKey: `cancel:${orderId}:${row.productId}`,
    }, session);
  }
}
