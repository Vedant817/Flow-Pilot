/** @jest-environment node */
import { auth } from '@clerk/nextjs/server';
import { getAuthContext, requireWorkspace, requireRole, requireMaintenanceAccess } from '../lib/auth';
import type { NextRequest } from 'next/server';

jest.mock('@clerk/nextjs/server', () => ({ auth: jest.fn() }));

const mockAuth = auth as unknown as jest.Mock;
const request = { headers: new Headers() } as NextRequest;

describe('interactive workspace authentication', () => {
  const originalEnv = process.env;
  beforeEach(() => {
    process.env = { ...originalEnv, DEFAULT_ORG_ID: 'org_maintenance', NODE_ENV: 'development' };
  });
  afterEach(() => { process.env = originalEnv; });

  it.each([{}, { orgId: 'org_claim' }, { org_id: 'org_claim' }])(
    'rejects an authenticated session without an active org despite defaults and claims: %j',
    async (sessionClaims) => {
      mockAuth.mockResolvedValue({ userId: 'user_1', orgId: null, sessionClaims });
      expect(await getAuthContext()).toMatchObject({ userId: 'user_1', orgId: undefined });
      await expect(requireWorkspace()).rejects.toMatchObject({ status: 403 });
      await expect(requireRole(request, [])).rejects.toMatchObject({ status: 403 });
    },
  );

  it('uses the verified active org instead of arbitrary claims or defaults', async () => {
    mockAuth.mockResolvedValue({
      userId: 'user_1', orgId: 'org_active',
      sessionClaims: { orgId: 'org_other', org_id: 'org_another' },
    });
    expect(await requireWorkspace()).toMatchObject({ userId: 'user_1', orgId: 'org_active' });
  });

  it('rejects unauthenticated users', async () => {
    mockAuth.mockResolvedValue({ userId: null, orgId: null });
    await expect(requireWorkspace()).rejects.toMatchObject({ status: 401 });
  });

  it('reserves the configured default for secret-authenticated maintenance', async () => {
    process.env.ADMIN_SECRET = 'maintenance-secret';
    const maintenanceRequest = {
      headers: new Headers({ 'x-admin-secret': 'maintenance-secret' }),
    } as NextRequest;
    expect(await requireMaintenanceAccess(maintenanceRequest)).toMatchObject({
      userId: 'service:maintenance', orgId: 'org_maintenance',
    });
    expect(mockAuth).not.toHaveBeenCalled();
  });
});
