import { StockConflict } from '@/lib/inventory/ledger';

type PricedLine = { productId?: string; quantity: number; lineValueMinor?: number };

/** Allocate discounted booked value exactly; cumulative unit credits never drift. */
export function creditForReturnedUnits(
  lines: PricedLine[], finalMinor: number, productId: string, alreadyReturned: number, units: number
): number {
  if (!Number.isSafeInteger(finalMinor) || finalMinor < 0 ||
    !Number.isSafeInteger(alreadyReturned) || alreadyReturned < 0 ||
    !Number.isSafeInteger(units) || units < 1) throw new StockConflict('Invalid credit money/quantity');
  const groups = new Map<string, { quantity: number; value: number }>();
  for (const line of lines) {
    if (!line.productId || !Number.isSafeInteger(line.quantity) || line.quantity < 1 ||
      !Number.isSafeInteger(line.lineValueMinor) || (line.lineValueMinor ?? 0) <= 0) {
      throw new StockConflict('Canonical order price snapshots are required for credits');
    }
    const group = groups.get(line.productId) ?? { quantity: 0, value: 0 };
    group.quantity += line.quantity; group.value += line.lineValueMinor!;
    if (!Number.isSafeInteger(group.quantity) || !Number.isSafeInteger(group.value)) throw new StockConflict('Credit exceeds safe range');
    groups.set(line.productId, group);
  }
  const total = [...groups.values()].reduce((sum, group) => sum + group.value, 0);
  if (!Number.isSafeInteger(total) || total < finalMinor || !total) throw new StockConflict('Invalid discounted order value');
  const original = BigInt(total);
  const rows = [...groups].map(([id, group]) => {
    const numerator = BigInt(group.value) * BigInt(finalMinor);
    return { id, ...group, net: Number(numerator / original), remainder: numerator % original };
  }).sort((a, b) => a.remainder === b.remainder ? a.id.localeCompare(b.id) : a.remainder > b.remainder ? -1 : 1);
  let spare = finalMinor - rows.reduce((sum, row) => sum + row.net, 0);
  for (const row of rows) if (spare > 0) { row.net += 1; spare -= 1; }
  const sku = rows.find(row => row.id === productId);
  if (!sku || alreadyReturned + units > sku.quantity) throw new StockConflict('Credit exceeds ordered units');
  const cumulative = (count: number) => Number(BigInt(sku.net) * BigInt(count) / BigInt(sku.quantity));
  return cumulative(alreadyReturned + units) - cumulative(alreadyReturned);
}
