import { fulfillmentStatus } from '../lib/orders/fulfillment';

const lines = [{ productId: 'sku-a', quantity: 2 }, { productId: 'sku-b', quantity: 3 }];
test('fulfillment is derived from every line, not a manually assigned label', () => {
  expect(fulfillmentStatus(lines, [])).toBe('pending fulfillment');
  expect(fulfillmentStatus(lines, [{ productId: 'sku-a', fulfilledUnits: 2 }])).toBe('partially fulfilled');
  expect(fulfillmentStatus(lines, [
    { productId: 'sku-a', fulfilledUnits: 2 }, { productId: 'sku-b', fulfilledUnits: 3 },
  ])).toBe('fulfilled');
});
test('duplicate order lines are combined by canonical SKU', () => {
  expect(fulfillmentStatus([{ productId: 'sku-a', quantity: 1 }, { productId: 'sku-a', quantity: 2 }],
    [{ productId: 'sku-a', fulfilledUnits: 3 }])).toBe('fulfilled');
});
test('unmapped catalog data, excess shipments and foreign allocation lines fail closed', () => {
  expect(() => fulfillmentStatus([{ quantity: 1 }], [])).toThrow('Canonical catalog');
  expect(() => fulfillmentStatus(lines, [{ productId: 'sku-a', fulfilledUnits: 3 }])).toThrow('exceeds');
  expect(() => fulfillmentStatus(lines, [{ productId: 'sku-c', fulfilledUnits: 1 }])).toThrow('Invalid fulfillment');
});
