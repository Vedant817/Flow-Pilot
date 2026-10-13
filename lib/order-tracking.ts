import { createHash, randomBytes } from 'crypto';

interface TrackableOrder {
  _id: unknown;
  date: string;
  time: string;
  status: string;
  products: Array<{ name: string; quantity: number }>;
}

export function hashTrackingToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function createTrackingCredential(): {
  token: string;
  tokenHash: string;
} {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashTrackingToken(token) };
}

export function toPublicOrderTracking<T extends TrackableOrder>(order: T) {
  return {
    id: String(order._id).toUpperCase(),
    date: order.date,
    time: order.time,
    status: order.status,
    products: order.products.map((product) => ({
      name: product.name,
      quantity: product.quantity,
    })),
  };
}
