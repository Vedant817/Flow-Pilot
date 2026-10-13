/** @jest-environment node */

jest.mock('@clerk/nextjs/server', () => ({
  clerkMiddleware: (handler: unknown) => handler,
  createRouteMatcher: (patterns: string[]) => (request: { nextUrl: { pathname: string } }) =>
    patterns.some(pattern => new RegExp(`^${pattern}$`).test(request.nextUrl.pathname)),
}));

import proxy from '../proxy';

type Auth = (() => Promise<{ userId: string | null }>) & { protect: jest.Mock };
const handler = proxy as unknown as (
  auth: Auth, request: { nextUrl: { pathname: string } }
) => Promise<Response | undefined>;

test.each(['/api/admin/outbox/process', '/api/admin/backfill', '/api/admin/schemes/expire'])(
  '%s can reach its handler-level maintenance authentication without a browser session',
  async pathname => {
    const auth = Object.assign(jest.fn(async () => ({ userId: null })), { protect: jest.fn() });
    expect(await handler(auth, { nextUrl: { pathname } })).toBeUndefined();
    expect(auth).not.toHaveBeenCalled();
    expect(auth.protect).not.toHaveBeenCalled();
  }
);

test.each(['/api/orders', '/api/email-drafts', '/api/admin/schemes/issue/job-1'])(
  '%s still requires an authenticated interactive session',
  async pathname => {
    const auth = Object.assign(jest.fn(async () => ({ userId: null })), { protect: jest.fn() });
    const response = await handler(auth, { nextUrl: { pathname } });
    expect(response?.status).toBe(401);
  }
);
