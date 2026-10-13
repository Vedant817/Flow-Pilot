import {
  addWorkspaceScope,
  hasPermission,
  normalizeRole,
} from '../lib/authorization';

describe('authorization policy', () => {
  it('normalizes Clerk organization roles', () => {
    expect(normalizeRole('org:finance')).toBe('finance');
    expect(normalizeRole(' ADMIN ')).toBe('admin');
    expect(normalizeRole(undefined)).toBe('viewer');
  });

  it('grants only the permissions assigned to a role', () => {
    expect(hasPermission('org:admin', 'inventory:write')).toBe(true);
    expect(hasPermission('operator', 'orders:write')).toBe(true);
    expect(hasPermission('operator', 'pricing:write')).toBe(false);
    expect(hasPermission('finance', 'promotions:approve')).toBe(true);
    expect(hasPermission(undefined, 'orders:write')).toBe(false);
  });

  it('cannot be tricked into replacing the authenticated workspace scope', () => {
    expect(addWorkspaceScope('org_authenticated', {
      orgId: 'org_from_request',
      status: 'active',
    })).toEqual({
      orgId: 'org_authenticated',
      status: 'active',
    });
  });
});
