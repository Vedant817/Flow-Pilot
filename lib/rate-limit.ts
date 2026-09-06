/**
 * In-process token-bucket rate limiter.
 * Per-instance protection for expensive endpoints (AI generation).
 * At multi-instance scale this becomes a Redis/Upstash sliding window —
 * interface kept identical so only the store swaps.
 */

interface Bucket {
  tokens: number;
  resetAt: number;
}

declare global {
  var __flowpilotBuckets: Map<string, Bucket> | undefined;
}
const buckets = global.__flowpilotBuckets ?? (global.__flowpilotBuckets = new Map());

export function rateLimit(
  req: Request,
  opts: { windowMs: number; max: number }
): { ok: boolean; remaining: number; retryAfterSec: number } {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'local';

  const now = Date.now();
  const bucket = buckets.get(ip);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(ip, { tokens: opts.max - 1, resetAt: now + opts.windowMs });
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
