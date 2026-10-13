import type { ClientSession } from 'mongoose';
import { Order, type IOrder } from '@/models/Order';
import { OutboxEvent } from '@/models/OutboxEvent';
import { OrderEvent } from '@/models/OrderEvent';
import { Inventory } from '@/models/Inventory';

export type CanonicalOrderInput = Pick<IOrder,
  'orgId' | 'name' | 'email' | 'phone' | 'date' | 'time' | 'orderedAt' | 'products'
> & Partial<Pick<IOrder, 'emailNormalized' | 'placedAt' | 'requestedDeliveryDate' | 'requestedDeliveryTime' | 'appliedCoupon'>> & {
  pricing: NonNullable<IOrder['pricing']>;
  idempotencyKey: string;
  requestHash: string;
  trackingTokenHash: string;
};

export class CanonicalOrderError extends Error {
  readonly status = 409;
}

/** The single persistence boundary for every order creation channel. */
export async function persistCanonicalOrder(input: CanonicalOrderInput, actorId: string, session: ClientSession) {
  if (!session || !input.orgId || !actorId || !input.idempotencyKey || !input.requestHash ||
    !input.trackingTokenHash || !input.products.length || input.products.length > 50) {
    throw new CanonicalOrderError('Canonical order identity, session and line snapshots are required');
  }
  let total = 0;
  for (const line of input.products) {
    if (!line.productId || !/^[a-fA-F0-9]{24}$/.test(line.productId) || !Number.isSafeInteger(line.quantity) || line.quantity < 1 ||
      !Number.isSafeInteger(line.unitPriceMinor) || (line.unitPriceMinor ?? 0) <= 0 ||
      line.lineValueMinor !== line.quantity * line.unitPriceMinor!) {
      throw new CanonicalOrderError('Canonical product identity and integer money snapshots are required');
    }
    total += line.lineValueMinor;
  }
  const price = input.pricing;
  if (!Number.isSafeInteger(total) || price.originalMinor !== total ||
    !Number.isSafeInteger(price.discountMinor) || price.discountMinor < 0 || price.discountMinor > total ||
    price.finalMinor !== total - price.discountMinor || price.currency !== 'INR' ||
    !['inventory', 'snapshot'].includes(price.priceSource)) {
    throw new CanonicalOrderError('Order money snapshots are inconsistent');
  }
  const products = input.products.map(line => ({ ...line, productId: line.productId!.toLowerCase() }));
  const productIds = [...new Set(products.map(line => line.productId))];
  const references = await Inventory.updateMany(
    { _id: { $in: productIds }, orgId: input.orgId }, { $inc: { __v: 1 } }, { session }
  );
  if (references.matchedCount !== productIds.length) throw new CanonicalOrderError('Canonical SKU does not exist in this workspace');
  const [order] = await Order.create([{
    ...input, products, emailNormalized: input.email.toLowerCase().trim(),
    status: 'pending fulfillment', orderLink: '',
  }], { session });
  await OutboxEvent.create([{
    orgId: input.orgId, type: 'order.created', aggregateId: String(order._id),
    eventKey: `order.created:${order._id}`,
  }], { session });
  await OrderEvent.create([{
    orgId: input.orgId, orderId: String(order._id), actorId,
    type: 'created', toStatus: 'pending fulfillment',
  }], { session });
  return order;
}
