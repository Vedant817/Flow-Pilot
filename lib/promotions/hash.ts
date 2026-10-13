import crypto from 'crypto';

export function hashToInt(str: string, max: number = 100): number {
  const h = crypto.createHash('sha256').update(str).digest();
  // Use first 4 bytes as uint32
  const v = h.readUInt32BE(0);
  return v % max;
}

export function isHoldout(schemeId: string, emailNormalized: string, holdoutPercent: number): boolean {
  if (holdoutPercent <= 0) return false;
  if (holdoutPercent >= 100) return true;
  const key = `${schemeId}:${emailNormalized}`;
  return hashToInt(key, 100) < holdoutPercent;
}

export function generateCouponCode(prefix: string, length: number = 12): string {
  // prefix like LOYAL10 -> LOYAL10-XXXX
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1
  const bytes = crypto.randomBytes(length);
  let suffix = '';
  for (let i = 0; i < length; i++) suffix += chars[bytes[i] % chars.length];
  const clean = prefix.toUpperCase().trim().replace(/[^A-Z0-9]/g, '');
  // keep prefix short (<=10) then suffix
  const suffixPart = suffix.slice(0, 6);
  return `${clean}-${suffixPart}`;
}
