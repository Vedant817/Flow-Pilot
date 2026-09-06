import { dbConnect } from '@/lib/mongodb';
import { normalizeNameKey as nkey } from '@/lib/auth';

export interface PricedProduct {
  name: string;
  quantity: number;
  unitPrice?: number;
  lineValueMinor?: number;
  nameKey: string;
}

export interface OrderPricing {
  orderValueMinor: number;
  setupFeeMinor?: number;
  priceSource: 'snapshot' | 'inventory' | 'estimated';
  productsWithSnapshot: PricedProduct[];
}

// Cached inventory price map
let cachedPriceMap: Map<string, number> | null = null;
let cachedAt = 0;
const CACHE_MS = 60_000;

async function getPriceMap(): Promise<Map<string, number>> {
  const now = Date.now();
  if (cachedPriceMap && now - cachedAt < CACHE_MS) return cachedPriceMap;
  const conn = await dbConnect();
  const rows = await conn.connection.db!.collection('inventory').find({}, { projection: { name: 1, nameKey: 1, price: 1 } }).toArray();
  const map = new Map<string, number>();
  for (const r of rows) {
    const key = (r as any).nameKey ? String((r as any).nameKey) : nkey(String((r as any).name));
    map.set(key, Number((r as any).price) || 50);
  }
  cachedPriceMap = map;
  cachedAt = now;
  return map;
}

export async function priceOrder(products: Array<{ name?: unknown; quantity?: unknown }>): Promise<OrderPricing> {
  const priceMap = await getPriceMap().catch(() => new Map<string, number>());
  let priceSource: OrderPricing['priceSource'] = 'inventory';
  let hasEstimated = false;
  const productsWithSnapshot: PricedProduct[] = [];
  let orderValueMinor = 0;

  for (const p of products.slice(0, 50)) {
    const name = String(p.name).slice(0, 120);
    const quantity = Math.max(1, Math.min(100_000, Number(p.quantity) || 1));
    const nameKey = nkey(name);
    const price = priceMap.get(nameKey) ?? 50;
    if (!priceMap.has(nameKey)) hasEstimated = true;
    const lineValueMinor = Math.round(price * 100 * quantity);
    orderValueMinor += lineValueMinor;
    productsWithSnapshot.push({
      name,
      quantity,
      unitPrice: price,
      lineValueMinor,
      nameKey,
    });
  }

  if (hasEstimated && priceMap.size === 0) priceSource = 'estimated';
  else if (hasEstimated) priceSource = 'estimated';
  else priceSource = 'inventory';

  // For demo with no inventory, still return estimated source
  if (productsWithSnapshot.length === 0) priceSource = 'estimated';

  return { orderValueMinor, priceSource, productsWithSnapshot };
}

export function computeDiscount(
  scheme: { benefitType: string; benefitValueMinor: number; maxDiscountMinor?: number; setupFeeMinor?: number; minimumOrderValueMinor?: number },
  orderValueMinor: number,
  setupFeeMinor?: number
): number {
  if (scheme.minimumOrderValueMinor && orderValueMinor < scheme.minimumOrderValueMinor) {
    return 0;
  }
  if (scheme.benefitType === 'percent') {
    // benefitValueMinor is basis points 0..10000
    const pct = scheme.benefitValueMinor / 10000;
    let discount = Math.round(orderValueMinor * pct);
    if (scheme.maxDiscountMinor != null) discount = Math.min(discount, scheme.maxDiscountMinor);
    return Math.min(discount, orderValueMinor);
  }
  if (scheme.benefitType === 'fixed') {
    let discount = scheme.benefitValueMinor;
    if (scheme.maxDiscountMinor != null) discount = Math.min(discount, scheme.maxDiscountMinor);
    return Math.min(discount, orderValueMinor);
  }
  if (scheme.benefitType === 'free_setup') {
    const fee = setupFeeMinor ?? scheme.setupFeeMinor ?? 0;
    if (fee <= 0) return 0;
    // benefitValueMinor may be 0 meaning waive full setup; otherwise cap to fee
    const waived = scheme.benefitValueMinor > 0 ? Math.min(scheme.benefitValueMinor, fee) : fee;
    if (scheme.maxDiscountMinor != null) return Math.min(waived, scheme.maxDiscountMinor);
    return Math.min(waived, orderValueMinor, fee);
  }
  return 0;
}

export function parseOrderDateToIST(dateStr: string, timeStr: string): Date {
  try {
    const d = dateStr?.trim() || new Date().toISOString().slice(0, 10);
    const t = timeStr?.trim() || '00:00';
    const iso = `${d}T${t}:00+05:30`;
    const dt = new Date(iso);
    if (isNaN(dt.getTime())) return new Date();
    return dt;
  } catch {
    return new Date();
  }
}
