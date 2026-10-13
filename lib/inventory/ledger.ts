export type StockMovementKind = 'receipt' | 'adjustment' | 'reserve' | 'release' | 'fulfill' | 'return' | 'return_damaged';
export type StockBalance = { quantity: number; reservedQuantity: number };
export type StockPlan = StockBalance & { quantityDelta: number; reservedDelta: number };

export class StockConflict extends Error {
  constructor(message: string, public readonly status = 409) { super(message); this.name = 'StockConflict'; }
}

export function planStockMovement(balance: StockBalance, kind: StockMovementKind, units: number): StockPlan {
  const { quantity, reservedQuantity } = balance;
  if (!Number.isSafeInteger(quantity) || !Number.isSafeInteger(reservedQuantity) ||
    quantity < 0 || reservedQuantity < 0 || reservedQuantity > quantity) throw new StockConflict('Invalid stored stock balances');
  if (!Number.isSafeInteger(units) || units === 0 || (kind !== 'adjustment' && units < 0)) {
    throw new StockConflict('Movement quantity must be a positive integer (signed nonzero integer for adjustments)', 400);
  }
  let quantityDelta = 0;
  let reservedDelta = 0;
  switch (kind) {
    case 'receipt': case 'return': quantityDelta = units; break;
    case 'return_damaged': break;
    case 'adjustment': quantityDelta = units; break;
    case 'reserve':
      if (quantity - reservedQuantity < units) throw new StockConflict('Insufficient available stock');
      reservedDelta = units; break;
    case 'release': case 'fulfill':
      if (reservedQuantity < units) throw new StockConflict('Insufficient reserved stock');
      reservedDelta = -units;
      if (kind === 'fulfill') quantityDelta = -units;
      break;
    default: throw new StockConflict('Unsupported stock movement', 400);
  }
  const nextQuantity = quantity + quantityDelta;
  const nextReserved = reservedQuantity + reservedDelta;
  if (!Number.isSafeInteger(nextQuantity) || !Number.isSafeInteger(nextReserved)) throw new StockConflict('Stock exceeds safe integer range', 400);
  if (nextQuantity < nextReserved || nextQuantity < 0) throw new StockConflict('Adjustment would consume reserved stock');
  return { quantity: nextQuantity, reservedQuantity: nextReserved, quantityDelta, reservedDelta };
}
