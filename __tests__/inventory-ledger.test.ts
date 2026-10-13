import { planStockMovement } from '../lib/inventory/ledger';

const stock = { quantity: 10, reservedQuantity: 4 };
describe('inventory ledger invariants', () => {
  it('receives stock without changing reservations', () => {
    expect(planStockMovement(stock, 'receipt', 5)).toEqual({
      quantity: 15, reservedQuantity: 4, quantityDelta: 5, reservedDelta: 0,
    });
  });
  it('reserves only available units and does not decrement on-hand stock', () => {
    expect(planStockMovement(stock, 'reserve', 6)).toMatchObject({ quantity: 10, reservedQuantity: 10 });
    expect(() => planStockMovement(stock, 'reserve', 7)).toThrow('Insufficient available stock');
  });
  it('fulfillment decrements on-hand and reserved balances together', () => {
    expect(planStockMovement(stock, 'fulfill', 3)).toEqual({
      quantity: 7, reservedQuantity: 1, quantityDelta: -3, reservedDelta: -3,
    });
    expect(() => planStockMovement(stock, 'fulfill', 5)).toThrow('Insufficient reserved stock');
  });
  it('releasing stock changes only reserved balance', () => {
    expect(planStockMovement(stock, 'release', 2)).toMatchObject({ quantity: 10, reservedQuantity: 2 });
    expect(() => planStockMovement(stock, 'release', 5)).toThrow('Insufficient reserved stock');
  });
  it('adjustments cannot make reserved units disappear', () => {
    expect(planStockMovement(stock, 'adjustment', -6)).toMatchObject({ quantity: 4, reservedQuantity: 4 });
    expect(() => planStockMovement(stock, 'adjustment', -7)).toThrow('Adjustment would consume reserved stock');
  });
  it.each([0, -1, 0.5, NaN, Infinity])('rejects invalid receipt quantity %s', quantity => {
    expect(() => planStockMovement(stock, 'receipt', quantity)).toThrow('positive integer');
  });
  it('fails closed on corrupt stored balances and arithmetic overflow', () => {
    expect(() => planStockMovement({ quantity: 2, reservedQuantity: 3 }, 'receipt', 1)).toThrow('Invalid stored stock');
    expect(() => planStockMovement({ quantity: Number.MAX_SAFE_INTEGER, reservedQuantity: 0 }, 'receipt', 1)).toThrow('safe integer');
  });
});
