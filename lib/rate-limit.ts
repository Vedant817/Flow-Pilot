/**
 * In-process token-bucket rate limiter (legacy) + distributed Mongo fixed-window for promotions.
 * Per-instance Map is L1 for chatbot; promotion paths use Mongo atomic bucket per userId (auth) else IP.
 * Promotion paths should use key = userId || ip to avoid IP-only bypass on serverless.
 */

interface Bucket {
  tokens: number;
  resetAt: number;
}

declare global {
  var __flowpilotBuckets: Map<string, Bucket> | undefined;
}
const buckets = global.__flowpilotBuckets ?? (global.__flowpilotBuckets = new Map());

function getClientKey(req: Request, keyPrefix?: string): string {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'local';
  return keyPrefix ? `${keyPrefix}:${ip}` : ip;
}

/** @deprecated — use rateLimitAsync for promotion paths (user-aware) */
export function rateLimit(
  req: Request,
  opts: { windowMs: number; max: number; keyPrefix?: string }
): { ok: boolean; remaining: number; retryAfterSec: number } {
  const key = getClientKey(req, opts.keyPrefix);
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { tokens: opts.max - 1, resetAt: now + opts.windowMs });
    return { ok: true, remaining: opts.max - 1, retryAfterSec: 0 };
  }

  if (bucket.tokens <= 0) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }

  bucket.tokens--;
  return { ok: true, remaining: bucket.tokens, retryAfterSec: 0 };
}

export async function rateLimitAsync(
  req: Request,
  opts: { windowMs: number; max: number; keyPrefix?: string }
): Promise<{ ok: boolean; remaining: number; retryAfterSec: number }> {
  let userId: string | null = null;
  try {
    const { getAuthContext } = await import('./auth');
    const ctx = await getAuthContext().catch(() => null as any);
    userId = ctx?.userId ?? null;
  } catch {}
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'local';
  const base = userId ?? ip;
  const windowStart = Math.floor(Date.now() / opts.windowMs) * opts.windowMs;
  // For validate, also bind to emailNormalized if present in body query (handled by caller via keyPrefix includes email)
  const key = `rate:${opts.keyPrefix ?? 'default'}:${base}:${windowStart}`;

  // Fallback to in-process if Mongo unavailable (build, offline)
  try {
    const { dbConnect } = await import('./mongodb');
    const conn = await dbConnect();
    const col = conn.connection.db!.collection('rate_limit_buckets');
    const now = new Date();
    const resetAt = new Date(windowStart + opts.windowMs);
    const raw = await col.findOneAndUpdate(
      { key } as any,
      {
        $inc: { count: 1 },
        $setOnInsert: { key, resetAt, createdAt: now },
        $set: { updatedAt: now },
      },
      { upsert: true, returnDocument: 'after' } as any
    );
    const doc: any = (raw as any)?.value ?? raw;
    const count = doc?.count ?? 1;
    const remaining = Math.max(0, opts.max - count);
    const ok = count <= opts.max;
    const retryAfterSec = ok ? 0 : Math.ceil((resetAt.getTime() - Date.now()) / 1000);
    return { ok, remaining, retryAfterSec: Math.max(0, retryAfterSec) };
  } catch {
    // Fallback to in-process Map keyed by base+windowStart
    const mapKey = key;
    const now = Date.now();
    const bucket = buckets.get(mapKey);
    if (!bucket || bucket.resetAt <= now) {
      const resetAt = windowStart + opts.windowMs;
      buckets.set(mapKey, { tokens: opts.max - 1, resetAt });
      return { ok: true, remaining: opts.max - 1, retryAfterSec: 0 };
    }
    if (bucket.tokens <= 0) {
      return { ok: false, remaining: 0, retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000) };
    }
    bucket.tokens--;
    return { ok: true, remaining: bucket.tokens, retryAfterSec: 0 };
  }
}

export function rateLimitHeaders(remaining: number, limit: number, retryAfterSec: number): Record<string, string> {
  return {
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Limit': String(limit),
    'Retry-After': String(retryAfterSec),
  };
}
