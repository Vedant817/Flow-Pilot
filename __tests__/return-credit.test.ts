import { creditForReturnedUnits } from '../lib/orders/credits';

test('partial return credits sum exactly to the discounted invoice without rounding drift', () => {
  const lines = [{ productId: 'sku-a', quantity: 3, lineValueMinor: 1000 }, { productId: 'sku-b', quantity: 2, lineValueMinor: 1000 }];
  let credited = 0;
  for (let prior = 0; prior < 3; prior++) credited += creditForReturnedUnits(lines, 1333, 'sku-a', prior, 1);
  for (let prior = 0; prior < 2; prior++) credited += creditForReturnedUnits(lines, 1333, 'sku-b', prior, 1);
  expect(credited).toBe(1333);
});
test('credits require canonical snapshots and cannot exceed the original quantity', () => {
  expect(() => creditForReturnedUnits([{ quantity: 1 }], 100, 'sku-a', 0, 1)).toThrow('Canonical');
  expect(() => creditForReturnedUnits([{ productId: 'sku-a', quantity: 2, lineValueMinor: 100 }], 100, 'sku-a', 2, 1)).toThrow('exceeds');
});
