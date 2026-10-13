import { StockConflict } from '@/lib/inventory/ledger';

export function fulfillmentStatus(
  lines: Array<{ productId?: string; quantity: number }>,
  allocations: Array<{ productId: string; fulfilledUnits: number }>
): 'pending fulfillment' | 'partially fulfilled' | 'fulfilled' {
  const required = new Map<string, number>();
  for (const line of lines) {
    if (!line.productId || !Number.isSafeInteger(line.quantity) || line.quantity < 1) {
      throw new StockConflict('Canonical catalog mapping is required before fulfillment');
    }
    required.set(line.productId, (required.get(line.productId) ?? 0) + line.quantity);
  }
  if (!required.size) throw new StockConflict('Order has no fulfillable lines');
  const shipped = new Map<string, number>();
  for (const allocation of allocations) {
    if (!required.has(allocation.productId) || !Number.isSafeInteger(allocation.fulfilledUnits) ||
      allocation.fulfilledUnits < 0 || shipped.has(allocation.productId)) throw new StockConflict('Invalid fulfillment allocation data');
    shipped.set(allocation.productId, allocation.fulfilledUnits);
    if (allocation.fulfilledUnits > required.get(allocation.productId)!) throw new StockConflict('Fulfillment exceeds ordered units');
  }
  if ([...required].every(([id, count]) => shipped.get(id) === count)) return 'fulfilled';
  return [...shipped.values()].some(count => count > 0) ? 'partially fulfilled' : 'pending fulfillment';
}
