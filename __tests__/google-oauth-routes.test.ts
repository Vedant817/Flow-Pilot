/** @jest-environment node */

jest.mock('../lib/auth', () => ({
  requirePermission: jest.fn(),
  AuthorizationError: class extends Error { constructor(message: string, public status: number) { super(message); } },
}));
jest.mock('../lib/mongodb', () => ({
  __esModule: true, default: jest.fn(),
}));
jest.mock('../lib/integrations/google-credentials', () => ({
  GMAIL_READ_SCOPE: 'https://www.googleapis.com/auth/gmail.readonly',
  createGoogleOAuthClient: jest.fn(),
  saveGoogleRefreshToken: jest.fn(),
}));

import { NextRequest } from 'next/server';
import { requirePermission, AuthorizationError } from '../lib/auth';
import dbConnect from '../lib/mongodb';
import { createGoogleOAuthClient, saveGoogleRefreshToken, GMAIL_READ_SCOPE } from '../lib/integrations/google-credentials';
import { createOAuthState, OAUTH_COOKIE_NAME } from '../lib/integrations/google-security';
import { GET as login } from '../app/api/auth/google/[[...path]]/route';
import { GET as callback } from '../app/api/auth/callback/[[...path]]/route';

const auth = { orgId: 'org_a', userId: 'admin_a' };
const key = Buffer.alloc(32, 7).toString('base64');
const insertOne = jest.fn();
const findOneAndDelete = jest.fn();
const getToken = jest.fn();
const generateAuthUrl = jest.fn();
const originalKey = process.env.INTEGRATION_ENCRYPTION_KEY;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.INTEGRATION_ENCRYPTION_KEY = key;
  (requirePermission as jest.Mock).mockResolvedValue(auth);
  (dbConnect as jest.Mock).mockResolvedValue({
    connection: { db: { collection: () => ({ insertOne, findOneAndDelete }) } },
  });
  (createGoogleOAuthClient as jest.Mock).mockReturnValue({ getToken, generateAuthUrl });
  generateAuthUrl.mockReturnValue('https://accounts.google.com/fixture');
  findOneAndDelete.mockResolvedValue({ orgId: auth.orgId });
  getToken.mockResolvedValue({ tokens: { refresh_token: 'private-fixture-token', scope: GMAIL_READ_SCOPE } });
});
afterAll(() => {
  if (originalKey === undefined) delete process.env.INTEGRATION_ENCRYPTION_KEY;
  else process.env.INTEGRATION_ENCRYPTION_KEY = originalKey;
});

function callbackRequest(state = createOAuthState(auth, key), cookie = state) {
  return new NextRequest(`https://app.example/api/auth/callback/google?code=fixture-code&state=${state}`, {
    headers: { cookie: `${OAUTH_COOKIE_NAME}=${cookie}` },
  });
}

test('requires administrator permission before Google authorization', async () => {
  (requirePermission as jest.Mock).mockRejectedValue(new AuthorizationError('Forbidden', 403));
  expect((await login(new NextRequest('https://app.example/api/auth/google? action=login'))).status).toBe(403);
  expect(generateAuthUrl).not.toHaveBeenCalled();
  expect((await callback(callbackRequest())).status).toBe(403);
  expect(getToken).not.toHaveBeenCalled();
});

test('issues a durable one-time state and secure HTTP-only cookie with only Gmail read scope', async () => {
  const response = await login(new NextRequest('https://app.example/api/auth/google?action=login'));
  expect(response.status).toBe(307);
  expect(generateAuthUrl).toHaveBeenCalledWith(expect.objectContaining({ scope: [GMAIL_READ_SCOPE] }));
  expect(insertOne.mock.calls[0][0]).toMatchObject(auth);
  expect(response.headers.get('set-cookie')).toContain('HttpOnly');
  expect(response.headers.get('set-cookie')).toContain('SameSite=lax');
  expect(response.headers.get('cache-control')).toBe('private, no-store');
});

test('rejects missing/mismatching state before exchanging credentials', async () => {
  expect((await callback(callbackRequest(createOAuthState(auth, key), 'invalid-cookie'))).status).toBe(400);
  expect(getToken).not.toHaveBeenCalled();
});

test('rejects consumed state, including replay of a correctly signed cookie', async () => {
  findOneAndDelete.mockResolvedValue(null);
  expect((await callback(callbackRequest())).status).toBe(400);
  expect(getToken).not.toHaveBeenCalled();
});

test('consumes state on authorization denial and rejects subsequent replay', async () => {
  const state = createOAuthState(auth, key);
  findOneAndDelete.mockResolvedValueOnce({ orgId: auth.orgId }).mockResolvedValueOnce(null);
  const denied = new NextRequest(`https://app.example/api/auth/callback/google?error=access_denied&state=${state}`, {
    headers: { cookie: `${OAUTH_COOKIE_NAME}=${state}` },
  });
  expect((await callback(denied)).status).toBe(400);
  expect(findOneAndDelete).toHaveBeenCalledTimes(1);
  expect((await callback(callbackRequest(state))).status).toBe(400);
  expect(getToken).not.toHaveBeenCalled();
});

test.each([undefined, `${GMAIL_READ_SCOPE} https://www.googleapis.com/auth/pubsub`])(
  'rejects unverifiable or excessive scopes (%s)', async scope => {
    getToken.mockResolvedValue({ tokens: { refresh_token: 'private-fixture-token', scope } });
    expect((await callback(callbackRequest())).status).toBe(403);
    expect(saveGoogleRefreshToken).not.toHaveBeenCalled();
  }
);

test('stores the credential without exposing it in callback responses', async () => {
  const response = await callback(callbackRequest());
  expect(response.status).toBe(200);
  expect(saveGoogleRefreshToken).toHaveBeenCalledWith('org_a', 'admin_a', 'private-fixture-token');
  expect(await response.text()).not.toContain('private-fixture-token');
  expect(findOneAndDelete.mock.calls[0][0]).toMatchObject(auth);
  expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
});
