import { hasUsableOrderLines } from './order-intent';

export interface ConfirmationInput {
  products: Array<{ name: string; quantity: number }>;
  requestedDeliveryDate: string;
  requestedDeliveryTime: string;
  placedAt: Date;
}

/** Legacy Order.date/time are placement time for new inbound orders; delivery is separate. */
export function prepareConfirmedEmailOrder(input: ConfirmationInput):
  { ok: true; date: string; time: string; placedAt: Date; requestedDeliveryDate: string;
    requestedDeliveryTime: string; products: Array<{ name: string; quantity: number }> } |
  { ok: false; reason: string } {
  const products = input.products.map((p) => ({ name: p.name.trim(), quantity: p.quantity }));
  if (!hasUsableOrderLines(products) || new Set(products.map((p) => p.name.toLowerCase())).size !== products.length) {
    return { ok: false, reason: 'Valid, unique product names and positive quantities are required' };
  }
  const { requestedDeliveryDate: deliveryDate, requestedDeliveryTime: deliveryTime, placedAt } = input;
  const date = new Date(`${deliveryDate}T00:00:00Z`);
  if (!/^20\d\d-\d\d-\d\d$/.test(deliveryDate) || Number.isNaN(date.valueOf()) ||
      date.toISOString().slice(0, 10) !== deliveryDate) {
    return { ok: false, reason: 'A valid YYYY-MM-DD delivery date is required' };
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(deliveryTime)) {
    return { ok: false, reason: 'A valid HH:mm delivery time is required' };
  }
  if (Number.isNaN(placedAt.valueOf())) return { ok: false, reason: 'Invalid placement time' };
  return {
    ok: true, products, placedAt,
    date: placedAt.toISOString().slice(0, 10),
    time: placedAt.toISOString().slice(11, 16),
    requestedDeliveryDate: deliveryDate,
    requestedDeliveryTime: deliveryTime,
  };
}
