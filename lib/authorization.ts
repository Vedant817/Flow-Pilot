// Shared authorization helpers. No dependencies — safe to import from
// API routes, scripts, and client-safe modules alike.

const WRITE_RX = /:(write|delete|update|create)$/i;

const WRITE_ACTIONS = new Set([
  'inventory:write',
  'inventory:update',
  'inventory:delete',
  'inventory:create',
  'pricing:write',
  'pricing:update',
]);

/**
 * Returns true when `role` is allowed to perform `action`.
 * - `admin` / `manager` can write inventory and pricing.
 * - `staff` is read-only (reads allowed, writes denied).
 * - Unknown/missing roles: allowed in non-production with a warning
 *   (dev convenience), denied for writes in production.
 */
export function isMutationAllowed(role: string | undefined | null, action: string): boolean {
  const normalizedAction = (action ?? '').trim().toLowerCase();
  const isWrite = WRITE_ACTIONS.has(normalizedAction) || WRITE_RX.test(normalizedAction) || normalizedAction === 'write';
  // Reads are always allowed.
  if (!isWrite) return true;

  const normalizedRole = (role ?? '').trim().toLowerCase();
  if (normalizedRole === 'admin' || normalizedRole === 'manager') return true;
  if (normalizedRole === 'staff') return false;

  if (process.env.NODE_ENV !== 'production') {
    console.warn(`[authorization] allowing "${action}" for role "${role ?? 'undefined'}" in non-production`);
    return true;
  }
  return false;
}

/** Masks an email as `a***@domain` so public surfaces never leak full PII. */
export function maskEmail(email: string | undefined | null): string {
  if (!email || typeof email !== 'string') return '***';
  const at = email.indexOf('@');
  if (at <= 0) return '***';
  const domain = email.slice(at + 1).trim();
  if (!domain) return '***';
  return `${email.charAt(0)}***@${domain}`;
}

interface ProjectableProduct {
  name?: unknown;
  quantity?: unknown;
}

interface ProjectableOrder {
  _id?: unknown;
  status?: unknown;
  date?: unknown;
  time?: unknown;
  products?: ProjectableProduct[];
  email?: unknown;
}

export interface PublicOrderView {
  _id: string;
  status: unknown;
  date: unknown;
  time: unknown;
  products: Array<{ name: string; quantity: number }>;
  email: string;
}

/**
 * Public-safe order projection: only `_id`, `status`, `date`, `time`,
 * `products` (name + qty), and masked email. Never includes phone or
 * customer name.
 */
export function publicOrderProjection(order: ProjectableOrder): PublicOrderView {
  const rawId = order._id;
  const _id =
    typeof rawId === 'string'
      ? rawId
      : rawId !== null && rawId !== undefined && typeof (rawId as { toString?: unknown }).toString === 'function'
        ? String(rawId)
        : '';
  return {
    _id,
    status: order.status,
    date: order.date,
    time: order.time,
    products: Array.isArray(order.products)
      ? order.products.map((p) => ({
          name: typeof p.name === 'string' ? p.name : String(p.name ?? ''),
          quantity: Number(p.quantity) || 0,
        }))
      : [],
    email: maskEmail(typeof order.email === 'string' ? order.email : undefined),
  };
}
