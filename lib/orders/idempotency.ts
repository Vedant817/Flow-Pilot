import { createHash } from 'crypto';

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

type OrderIntent = {
  name: unknown;
  email: unknown;
  phone?: unknown;
  products: unknown;
  couponCode?: unknown;
  date?: unknown;
  time?: unknown;
};

export class IdempotencyError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'IdempotencyError';
    this.status = status;
  }
}

export function resolveIdempotencyKey(
  headerKey: string | null,
  bodyKey: unknown
): string {
  const normalizedHeader = headerKey?.trim();
  const normalizedBody =
    typeof bodyKey === 'string' ? bodyKey.trim() : undefined;

  if (
    normalizedHeader &&
    normalizedBody &&
    normalizedHeader !== normalizedBody
  ) {
    throw new IdempotencyError('Idempotency keys do not match');
  }

  const key = normalizedHeader || normalizedBody;
  if (!key) {
    throw new IdempotencyError('Idempotency-Key is required');
  }
  if (!IDEMPOTENCY_KEY_PATTERN.test(key)) {
    throw new IdempotencyError(
      'Idempotency-Key must be 8-128 characters using letters, numbers, ".", "_", ":" or "-"'
    );
  }
  return key;
}

function normalizedString(value: unknown, lowercase = false): string {
  const normalized = String(value ?? '').trim();
  return lowercase ? normalized.toLowerCase() : normalized;
}

/**
 * Fingerprints the caller's order intent, not server-computed pricing. Reusing
 * one key for a different intent is therefore rejected even if prices change.
 */
export function hashOrderRequest(intent: OrderIntent): string {
  const products = Array.isArray(intent.products)
    ? intent.products.map((raw) => {
        const product = raw as Record<string, unknown>;
        return {
          name: normalizedString(product?.name, true),
          quantity: Number(product?.quantity),
        };
      })
    : [];

  const canonical = {
    name: normalizedString(intent.name),
    email: normalizedString(intent.email, true),
    phone: normalizedString(intent.phone),
    products,
    couponCode: normalizedString(intent.couponCode, true).toUpperCase(),
    date: normalizedString(intent.date),
    time: normalizedString(intent.time),
  };

  return createHash('sha256')
    .update(JSON.stringify(canonical))
    .digest('hex');
}
