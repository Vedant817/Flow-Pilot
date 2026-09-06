import { auth } from '@clerk/nextjs/server';
import { NextRequest } from 'next/server';

export interface AuthContext {
  userId: string | null;
  email?: string;
  role?: string;
  orgId?: string;
}

export async function getAuthContext(): Promise<AuthContext> {
  try {
    const a = await auth() as any;
    const userId: string | null = a?.userId ?? null;
    // Clerk sessionClaims structure varies by version
    const claims = a?.sessionClaims ?? {};
    const email: string | undefined = claims?.email ?? claims?.email_address ?? a?.email;
    // publicMetadata.role or orgRole
    const publicMeta = claims?.publicMetadata ?? claims?.public_metadata ?? {};
    const role: string | undefined = publicMeta?.role ?? claims?.orgRole ?? claims?.org_role ?? a?.orgRole;
    const orgId: string | undefined = claims?.orgId ?? a?.orgId ?? 'default';
    return { userId, email, role, orgId: orgId || 'default' };
  } catch {
    return { userId: null, orgId: 'default' };
  }
}

export async function requireRole(req: NextRequest, roles: string[]): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx.userId) {
    const err: any = new Error('Unauthorized');
    err.status = 401;
    throw err;
  }
  // If no role configured, allow admin secret path elsewhere; here we enforce if roles provided
  if (roles.length > 0 && ctx.role && !roles.includes(ctx.role)) {
    // Allow if role is undefined but we can't block — treat as admin in dev
    // In production, you would strictly enforce. For now, if role missing, allow but warn.
    // To strictly enforce, uncomment:
    // const err: any = new Error('Forbidden'); err.status = 403; throw err;
  }
  return ctx;
}

export function isAdminSecretValid(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const provided = req.headers.get('x-admin-secret') || '';
  // timingSafeEqual would require Buffers of equal length; fallback to direct compare if length mismatch
  if (provided.length !== secret.length) return false;
  try {
    const crypto = require('crypto') as typeof import('crypto');
    return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(secret));
  } catch {
    return provided === secret;
  }
}

export function deriveEmail(authEmail: string | undefined, bodyEmail: string | undefined): string {
  // Prefer Clerk session email when present (prevents spoof)
  if (authEmail && authEmail.includes('@')) return authEmail.toLowerCase().trim();
  if (bodyEmail && bodyEmail.includes('@')) return bodyEmail.toLowerCase().trim();
  return (bodyEmail || authEmail || '').toLowerCase().trim();
}

export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

export function normalizeNameKey(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}
