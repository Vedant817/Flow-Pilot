export type AppRole =
  | 'admin'
  | 'finance'
  | 'commercial'
  | 'inventory'
  | 'warehouse'
  | 'operator'
  | 'viewer';

export type Permission =
  | 'orders:write'
  | 'inventory:write'
  | 'pricing:write'
  | 'promotions:write'
  | 'promotions:approve'
  | 'admin:operate';

const ROLE_PERMISSIONS: Record<AppRole, ReadonlySet<Permission>> = {
  admin: new Set([
    'orders:write',
    'inventory:write',
    'pricing:write',
    'promotions:write',
    'promotions:approve',
    'admin:operate',
  ]),
  finance: new Set([
    'pricing:write',
    'promotions:write',
    'promotions:approve',
  ]),
  commercial: new Set(['promotions:write']),
  inventory: new Set(['inventory:write']),
  warehouse: new Set(['orders:write', 'inventory:write']),
  operator: new Set(['orders:write']),
  viewer: new Set(),
};

export function normalizeRole(role: string | undefined): AppRole {
  const normalized = role?.trim().toLowerCase().replace(/^org:/, '') ?? '';
  return normalized in ROLE_PERMISSIONS ? normalized as AppRole : 'viewer';
}

export function hasPermission(
  role: string | undefined,
  permission: Permission
): boolean {
  return ROLE_PERMISSIONS[normalizeRole(role)].has(permission);
}

export function addWorkspaceScope<T extends Record<string, unknown>>(
  orgId: string,
  filter: T
): Omit<T, 'orgId'> & { orgId: string } {
  return { ...filter, orgId };
}
