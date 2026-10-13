export const ORDER_STATUSES = [
  'pending',
  'pending fulfillment',
  'partially fulfilled',
  'fulfilled',
  'canceled',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ['pending fulfillment', 'canceled'],
  'pending fulfillment': ['partially fulfilled', 'fulfilled', 'canceled'],
  'partially fulfilled': ['fulfilled'],
  fulfilled: [],
  canceled: [],
};

export class OrderTransitionError extends Error {
  constructor(message: string, public readonly status = 409) {
    super(message);
    this.name = 'OrderTransitionError';
  }
}

export function allowedOrderTransitions(status: string): readonly OrderStatus[] {
  return Object.prototype.hasOwnProperty.call(TRANSITIONS, status)
    ? TRANSITIONS[status as OrderStatus]
    : [];
}

export function assertOrderTransition(
  from: string,
  to: string,
  reason?: string
): asserts to is OrderStatus {
  if (!allowedOrderTransitions(from).includes(to as OrderStatus)) {
    throw new OrderTransitionError(`Invalid order transition: ${from} → ${to}`);
  }
  if (to === 'canceled' && (!reason?.trim() || reason.trim().length > 500)) {
    throw new OrderTransitionError(
      'Cancellation reason must contain 1-500 characters',
      400
    );
  }
}
