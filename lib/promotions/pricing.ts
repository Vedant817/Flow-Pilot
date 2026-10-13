import { dbConnect } from '@/lib/mongodb';
import { normalizeNameKey as nkey } from '@/lib/auth';
import { parseBusinessDateTime } from '@/lib/orders/time';

export interface PricedProduct {
  productId: string;
  name: string;
  quantity: number;
  unitPrice?: number;
  unitPriceMinor: number;
  lineValueMinor?: number;
  nameKey: string;
}

export interface OrderPricing {
  orderValueMinor: number;
  setupFeeMinor?: number;
  priceSource: 'snapshot' | 'inventory' | 'estimated';
  productsWithSnapshot: PricedProduct[];
}

export async function priceOrder(
  orgId: string,
  products: Array<{ name?: unknown; quantity?: unknown }>
): Promise<OrderPricing> {
  if (!orgId) throw new Error('Workspace is required for pricing');
  if (!Array.isArray(products) || products.length < 1 || products.length > 50) {
    throw Object.assign(new Error('An order must contain 1-50 product lines'), { status: 400 });
  }
  const normalized = products.map((product) => {
    if (typeof product?.name !== 'string' || !product.name.trim() || product.name.length > 120) {
      throw Object.assign(new Error('Product name must contain 1-120 characters'), { status: 400 });
    }
    if (!Number.isSafeInteger(product.quantity) || Number(product.quantity) < 1 || Number(product.quantity) > 100_000) {
      throw Object.assign(new Error('Product quantity must be a positive integer up to 100000'), { status: 400 });
    }
    return { name: product.name.trim(), nameKey: nkey(product.name), quantity: Number(product.quantity) };
  });
  const conn = await dbConnect();
  const rows = await conn.connection.db!.collection('inventory').find(
    { orgId, $or: [
      { nameKey: { $in: normalized.map((product) => product.nameKey) } },
      { name: { $in: normalized.map((product) => product.name) } },
    ] },
    { projection: { name: 1, nameKey: 1, price: 1 } }
  ).toArray();
  const priceMap = new Map<string, { productId: string; unitPriceMinor: number }>();
  for (const row of rows) {
    const key = row.nameKey ? String(row.nameKey) : nkey(String(row.name));
    const price = row.price;
    const unitPriceMinor = Math.round(price * 100);
    if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0 ||
      !Number.isSafeInteger(unitPriceMinor) || unitPriceMinor <= 0) {
      throw Object.assign(new Error('Catalog price unavailable'), { status: 409 });
    }
    if (priceMap.has(key)) {
      throw Object.assign(new Error('Catalog product name is ambiguous'), { status: 409 });
    }
    priceMap.set(key, { productId: String(row._id), unitPriceMinor });
  }
  const productsWithSnapshot: PricedProduct[] = [];
  let orderValueMinor = 0;

  for (const { name, quantity, nameKey } of normalized) {
    const catalog = priceMap.get(nameKey);
    if (!catalog) {
      throw Object.assign(new Error(`Catalog price unavailable for ${name}`), { status: 409 });
    }
    const lineValueMinor = catalog.unitPriceMinor * quantity;
    orderValueMinor += lineValueMinor;
    if (!Number.isSafeInteger(orderValueMinor)) {
      throw Object.assign(new Error('Order value exceeds supported money range'), { status: 400 });
    }
    productsWithSnapshot.push({
      productId: catalog.productId,
      name,
      quantity,
      unitPrice: catalog.unitPriceMinor / 100,
      unitPriceMinor: catalog.unitPriceMinor,
      lineValueMinor,
      nameKey,
    });
  }

  return { orderValueMinor, priceSource: 'inventory', productsWithSnapshot };
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
  return parseBusinessDateTime(dateStr, timeStr);
}
