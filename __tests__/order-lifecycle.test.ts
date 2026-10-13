import {
  allowedOrderTransitions,
  assertOrderTransition,
} from '../lib/orders/lifecycle';

describe('order lifecycle', () => {
  it('allows only forward fulfillment transitions', () => {
    expect(allowedOrderTransitions('pending fulfillment')).toEqual([
      'partially fulfilled', 'fulfilled', 'canceled',
    ]);
    expect(() => assertOrderTransition('pending fulfillment', 'fulfilled')).not.toThrow();
    expect(() => assertOrderTransition('partially fulfilled', 'fulfilled')).not.toThrow();
  });

  it.each(['fulfilled', 'canceled'])('makes %s terminal', (status) => {
    expect(allowedOrderTransitions(status)).toEqual([]);
    expect(() => assertOrderTransition(status, 'pending fulfillment')).toThrow('Invalid order transition');
  });

  it('requires a reason for cancellation', () => {
    expect(() => assertOrderTransition('pending fulfillment', 'canceled')).toThrow('Cancellation reason');
    expect(() => assertOrderTransition('pending fulfillment', 'canceled', 'Customer requested cancellation')).not.toThrow();
  });

  it('does not discard already fulfilled units by canceling a partial order', () => {
    expect(() => assertOrderTransition('partially fulfilled', 'canceled', 'cancel')).toThrow('Invalid order transition');
  });

  it('fails closed on unknown legacy states', () => {
    expect(allowedOrderTransitions('mystery')).toEqual([]);
    expect(() => assertOrderTransition('mystery', 'fulfilled')).toThrow('Invalid order transition');
  });
});
