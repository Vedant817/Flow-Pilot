import { auth } from '@clerk/nextjs/server';
import { NextRequest } from 'next/server';
import crypto from 'crypto';

export interface AuthContext {
  userId: string | null;
  email?: string;
  role?: string;
  orgId?: string;
}

interface ClerkAuthShape {
  userId?: string | null;
  orgId?: string | null;
  org_id?: string | null;
  orgRole?: string | null;
  email?: string | null;
  sessionClaims?: Record<string, unknown> | null;
}

function claimStr(source: Record<string, unknown>, key: string): string | undefined {
  const value = source[key];
  return typeof value === 'string' ? value : undefined;
}

export async function getAuthContext(): Promise<AuthContext> {
  try {
    const a = (await auth()) as unknown as ClerkAuthShape;
    const userId: string | null = a?.userId ?? null;
    // Clerk sessionClaims structure varies by version
    const claims: Record<string, unknown> = a?.sessionClaims ?? {};
    const email: string | undefined =
      claimStr(claims, 'email') ?? claimStr(claims, 'email_address') ?? a?.email ?? undefined;
    // publicMetadata.role or orgRole
    const publicMeta = (claims['publicMetadata'] ?? claims['public_metadata'] ?? {}) as Record<string, unknown>;
    const role: string | undefined =
      claimStr(publicMeta, 'role') ?? claimStr(claims, 'orgRole') ?? claimStr(claims, 'org_role') ?? a?.orgRole ?? undefined;
    const rawOrg: string | undefined =
      claimStr(claims, 'orgId') ?? claimStr(claims, 'org_id') ?? a?.orgId ?? a?.org_id ?? undefined;
    // Never silently fall back to 'default' when unauthenticated — callers
    // must see `undefined` so org scoping cannot leak across sessions.
    if (!userId) {
      return { userId: null, email, role, orgId: rawOrg || undefined };
    }
    // Authenticated users with no org resolve to the shared default workspace.
    return { userId, email, role, orgId: rawOrg || 'default' };
  } catch {
    return { userId: null, orgId: undefined };
  }
}

export class HttpError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function requireAuth(): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx.userId) {
    throw new HttpError('Unauthorized', 401);
  }
  return ctx;
}

export function getOrgFilter(ctx: AuthContext): { orgId: string } {
  return { orgId: ctx.orgId ?? 'default' };
}

export async function requireRole(_req: NextRequest, roles: string[]): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx.userId) {
    throw new HttpError('Unauthorized', 401);
  }
  // No roles required — any authenticated user may proceed.
  if (roles.length === 0) {
    return ctx;
  }
  const wanted = roles.map((r) => r.toLowerCase());
  const actual = (ctx.role ?? '').toLowerCase();
  if (!actual || !wanted.includes(actual)) {
    throw new HttpError('Forbidden', 403);
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
