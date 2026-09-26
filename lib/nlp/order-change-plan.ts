import type { Change } from './email-orders';

interface OrderSnapshot {
  date: string;
  placedAt?: Date;
  requestedDeliveryDate?: string;
  status: string;
  products: Array<{ name: string; quantity: number }>;
  pricing?: unknown;
}

/** Construct a proposed patch; never infer unspecified changes. */
export function planOrderChanges(order: OrderSnapshot, changes: Change[]):
  { ok: true; date: string; requestedDeliveryDate?: string; status: string; products: Array<{ name: string; quantity: number }> } |
  { ok: false; reason: string } {
  if (!changes.length) return { ok: false, reason: 'No explicit supported changes in this email' };
  if (order.status !== 'pending fulfillment') return { ok: false, reason: 'Order is not pending fulfillment' };
  if (changes.some((c) => c.op === 'cancel_order')) {
    if (changes.length !== 1) return { ok: false, reason: 'Cancellation mixed with other changes' };
    return { ok: true, date: order.date, requestedDeliveryDate: order.requestedDeliveryDate, products: order.products, status: 'canceled' };
  }
  const products = order.products.map((p) => ({ name: p.name, quantity: p.quantity }));
  let date = order.date;
  let requestedDeliveryDate = order.requestedDeliveryDate;
  const touched = new Set<string>();
  for (const change of changes) {
    if (change.op === 'cancel_order') continue;
    if (change.op === 'reschedule') {
      if (touched.has('date')) return { ok: false, reason: 'Conflicting delivery dates' };
      touched.add('date');
      if (order.placedAt) requestedDeliveryDate = change.date.value;
      else date = change.date.value; // legacy orders used date as delivery date
      continue;
    }
    if (order.pricing) return { ok: false, reason: 'Priced order needs manual repricing' };
    const key = change.product.value.trim().toLowerCase().replace(/\s+/g, ' ');
    if (touched.has(key)) return { ok: false, reason: 'Conflicting product changes' };
    touched.add(key);
    const matches = products.map((p, i) => ({ i, key: p.name.trim().toLowerCase().replace(/\s+/g, ' ') }))
      .filter((p) => p.key === key);
    if (matches.length !== 1) return { ok: false, reason: `Product must match exactly one existing line: ${change.product.value}` };
    if (change.op === 'remove_product') products.splice(matches[0].i, 1);
    else products[matches[0].i].quantity = change.quantity.value;
  }
  if (!products.length) return { ok: false, reason: 'Cannot remove every product; cancel the order instead' };
  return { ok: true, date, requestedDeliveryDate, status: order.status, products };
}
