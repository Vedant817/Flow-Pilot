import mongoose, { type ClientSession } from 'mongoose';
import { createHash } from 'crypto';
import dbConnect from '@/lib/mongodb';
import { Order } from '@/models/Order';
import { priceOrder } from '@/lib/promotions/pricing';
import { businessDateTime } from './time';
import { createTrackingCredential } from '@/lib/order-tracking';
import { persistCanonicalOrder, CanonicalOrderError } from './create';

export type InboundOrderInput = {
  orgId: string; actorId: string; messageId: string; name: string; email: string;
  placedAt: Date; products: Array<{ name: string; quantity: number }>;
  requestedDeliveryDate: string; requestedDeliveryTime: string;
};

export function inboundIntentHash(input: InboundOrderInput) {
  return createHash('sha256').update(JSON.stringify({
    name: input.name.trim(), email: input.email.toLowerCase().trim(), placedAt: input.placedAt.toISOString(),
    products: input.products, deliveryDate: input.requestedDeliveryDate, deliveryTime: input.requestedDeliveryTime,
  })).digest('hex');
}
export async function createInboundOrder(input: InboundOrderInput, existingSession?: ClientSession) {
  const key = `gmail:${input.messageId}`;
  const requestHash = inboundIntentHash(input);
  await dbConnect();
  const session = existingSession ?? await mongoose.startSession();
  const result: { order?: Awaited<ReturnType<typeof persistCanonicalOrder>> } = {};
  const apply = async () => {
    const existing = await Order.findOne({ orgId: input.orgId, idempotencyKey: key }).select('+requestHash').session(session);
    if (existing) {
      if (existing.requestHash !== requestHash) throw new CanonicalOrderError('Inbound order key has a different or unverifiable intent');
      result.order = existing; return;
    }
    const priced = await priceOrder(input.orgId, input.products);
    const tracking = createTrackingCredential();
    const placement = businessDateTime(input.placedAt);
    result.order = await persistCanonicalOrder({
      orgId: input.orgId, name: input.name.trim(), email: input.email.toLowerCase().trim(), phone: '',
      ...placement, placedAt: input.placedAt, orderedAt: input.placedAt,
      requestedDeliveryDate: input.requestedDeliveryDate, requestedDeliveryTime: input.requestedDeliveryTime,
      products: priced.productsWithSnapshot,
      pricing: { originalMinor: priced.orderValueMinor, discountMinor: 0, finalMinor: priced.orderValueMinor, currency: 'INR', priceSource: priced.priceSource },
      idempotencyKey: key, requestHash, trackingTokenHash: tracking.tokenHash,
    }, input.actorId, session);
  };
  try {
    if (existingSession) await apply(); else await session.withTransaction(apply);
    if (!result.order) throw new Error('Inbound order transaction did not commit');
    return result.order;
  } catch (error) {
    if (existingSession || (error as { code?: number })?.code !== 11000) throw error;
    const existing = await Order.findOne({ orgId: input.orgId, idempotencyKey: key }).select('+requestHash');
    if (!existing || existing.requestHash !== requestHash) throw new CanonicalOrderError('Inbound order key has a different or unverifiable intent');
    return existing;
  } finally {
    if (!existingSession) await session.endSession();
  }
}
