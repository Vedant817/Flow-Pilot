import { auth } from '@clerk/nextjs/server';
import { NextRequest } from 'next/server';
import { timingSafeEqual } from 'crypto';
import {
  hasPermission,
  normalizeRole,
  type AppRole,
  type Permission,
} from './authorization';

export interface AuthContext {
  userId: string | null;
  email?: string;
  role: AppRole;
  orgId?: string;
}

export class AuthorizationError extends Error {
  constructor(message: string, public readonly status: 401 | 403) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export async function getAuthContext(): Promise<AuthContext> {
  try {
    const authState = await auth();
    const userId = authState.userId ?? null;
    // Clerk sessionClaims structure varies by version
    const claims = (authState.sessionClaims ?? {}) as Record<string, unknown>;
    const emailClaim = claims.email ?? claims.email_address;
    const email = typeof emailClaim === 'string' ? emailClaim : undefined;
    // publicMetadata.role or orgRole
    const publicMetaClaim = claims.publicMetadata ?? claims.public_metadata;
    const publicMeta = typeof publicMetaClaim === 'object' && publicMetaClaim !== null
      ? publicMetaClaim as Record<string, unknown>
      : {};
    const roleClaim = publicMeta.role ?? claims.orgRole ?? claims.org_role ?? authState.orgRole;
    const role = normalizeRole(typeof roleClaim === 'string' ? roleClaim : undefined);
    // Interactive access requires Clerk's verified active organization.
    // DEFAULT_ORG_ID is reserved for authenticated maintenance service access.
    const orgId = authState.orgId ?? undefined;
    return { userId, email, role, orgId };
  } catch {
    return { userId: null, role: 'viewer' };
  }
}

export async function requireRole(req: NextRequest, roles: string[]): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx.userId) {
    throw new AuthorizationError('Unauthorized', 401);
  }
  if (!ctx.orgId) {
    throw new AuthorizationError('No workspace is assigned to this session', 403);
  }
  const normalizedRoles = roles.map((role) => normalizeRole(role));
  if (normalizedRoles.length > 0 && !normalizedRoles.includes(ctx.role)) {
    throw new AuthorizationError('Forbidden', 403);
  }
  return ctx;
}

export async function requireWorkspace(): Promise<AuthContext & { orgId: string; userId: string }> {
  const ctx = await getAuthContext();
  if (!ctx.userId) {
    throw new AuthorizationError('Unauthorized', 401);
  }
  if (!ctx.orgId) {
    throw new AuthorizationError('No workspace is assigned to this session', 403);
  }
  return { ...ctx, orgId: ctx.orgId, userId: ctx.userId };
}

export async function requirePermission(
  permission: Permission
): Promise<AuthContext & { orgId: string; userId: string }> {
  const ctx = await requireWorkspace();
  if (!hasPermission(ctx.role, permission)) {
    throw new AuthorizationError(`Missing permission: ${permission}`, 403);
  }
  return ctx;
}

export async function requireMaintenanceAccess(
  req: NextRequest
): Promise<AuthContext & { orgId: string; userId: string }> {
  if (isAdminSecretValid(req)) {
    const orgId = process.env.DEFAULT_ORG_ID?.trim();
    if (!orgId) {
      throw new AuthorizationError('DEFAULT_ORG_ID is required for service access', 403);
    }
    return {
      userId: 'service:maintenance',
      email: 'maintenance@system',
      role: 'admin',
      orgId,
    };
  }
  return requirePermission('admin:operate');
}

export function isAdminSecretValid(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const provided = req.headers.get('x-admin-secret') || '';
  if (provided.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(secret));
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
