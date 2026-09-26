import { prepareConfirmedEmailOrder } from '../lib/nlp/order-placement';

const placedAt = new Date('2026-09-26T14:35:00Z');
const products = [{ name: 'Basmati Rice', quantity: 50 }];

it('stores placement separately from the requested delivery slot', () => {
  expect(prepareConfirmedEmailOrder({ products, placedAt, requestedDeliveryDate: '2026-10-05', requestedDeliveryTime: '10:00' }))
    .toEqual({ ok: true, products, placedAt, date: '2026-09-26', time: '14:35',
      requestedDeliveryDate: '2026-10-05', requestedDeliveryTime: '10:00' });
});

it.each([
  ['2026-02-30', '10:00'],
  ['2026-10-05', '25:00'],
  ['', ''],
])('rejects missing or invalid delivery fields', (requestedDeliveryDate, requestedDeliveryTime) => {
  expect(prepareConfirmedEmailOrder({ products, placedAt, requestedDeliveryDate, requestedDeliveryTime })).toMatchObject({ ok: false });
});

it('does not turn suggested invalid product lines into confirmed orders', () => {
  expect(prepareConfirmedEmailOrder({ products: [{ name: '50', quantity: 50 }], placedAt,
    requestedDeliveryDate: '2026-10-05', requestedDeliveryTime: '10:00' })).toMatchObject({ ok: false });
});
