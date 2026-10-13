import {
  hashOrderRequest,
  resolveIdempotencyKey,
} from '../lib/orders/idempotency';

describe('order idempotency', () => {
  it('requires an idempotency key', () => {
    expect(() => resolveIdempotencyKey(null, undefined)).toThrow(
      'Idempotency-Key is required'
    );
  });

  it('rejects conflicting header and body keys', () => {
    expect(() =>
      resolveIdempotencyKey('checkout:12345678', 'checkout:87654321')
    ).toThrow('Idempotency keys do not match');
  });

  it('normalizes and validates a supported key', () => {
    expect(resolveIdempotencyKey(' checkout:12345678 ', undefined)).toBe(
      'checkout:12345678'
    );
    expect(() => resolveIdempotencyKey('short', undefined)).toThrow(
      'Idempotency-Key must'
    );
  });

  it('hashes equivalent order payloads identically', () => {
    const first = hashOrderRequest({
      name: ' Ada ',
      email: 'ADA@example.com ',
      phone: ' 123 ',
      products: [
        { name: 'Widget', quantity: 2 },
        { name: 'Cable', quantity: 1 },
      ],
      couponCode: ' save10 ',
      date: '2026-04-01',
      time: '09:30',
    });
    const second = hashOrderRequest({
      name: 'Ada',
      email: 'ada@example.com',
      phone: '123',
      products: [
        { name: 'Widget', quantity: 2 },
        { name: 'Cable', quantity: 1 },
      ],
      couponCode: 'SAVE10',
      date: '2026-04-01',
      time: '09:30',
    });

    expect(first).toBe(second);
  });

  it('changes the hash when order intent changes', () => {
    const base = {
      name: 'Ada',
      email: 'ada@example.com',
      products: [{ name: 'Widget', quantity: 2 }],
    };

    expect(hashOrderRequest(base)).not.toBe(
      hashOrderRequest({
        ...base,
        products: [{ name: 'Widget', quantity: 3 }],
      })
    );
  });
});
