import {
  createOAuthState,
  verifyOAuthState,
  encryptRefreshToken,
  decryptRefreshToken,
} from '../lib/integrations/google-security';

const context = { orgId: 'org_a', userId: 'admin_a' };
const key = Buffer.alloc(32, 7).toString('base64');

describe('Google integration security', () => {
  it('binds state to browser cookie, administrator and active workspace', () => {
    const state = createOAuthState(context, key, 1000);
    expect(verifyOAuthState(state, state, context, key, 1100)).toMatchObject(context);
    expect(() => verifyOAuthState(state, 'different', context, key, 1100)).toThrow('Invalid OAuth state');
    expect(() => verifyOAuthState(state, state, { ...context, orgId: 'org_b' }, key, 1100)).toThrow('Invalid OAuth state');
    expect(() => verifyOAuthState(state, state, { ...context, userId: 'admin_b' }, key, 1100)).toThrow('Invalid OAuth state');
  });

  it('rejects expired, future-issued and tampered state', () => {
    const state = createOAuthState(context, key, 1000);
    expect(() => verifyOAuthState(state, state, context, key, 1000 + 601_000)).toThrow('Invalid OAuth state');
    expect(() => verifyOAuthState(state, state, context, key, 0)).toThrow('Invalid OAuth state');
    const changed = `${state.slice(0, -4)}abcd`;
    expect(() => verifyOAuthState(changed, changed, context, key, 1100)).toThrow('Invalid OAuth state');
  });

  it('encrypts refresh tokens with workspace-bound authenticated encryption', () => {
    const encrypted = encryptRefreshToken('fixture-refresh-token', 'org_a', key);
    expect(JSON.stringify(encrypted)).not.toContain('fixture-refresh-token');
    expect(decryptRefreshToken(encrypted, 'org_a', key)).toBe('fixture-refresh-token');
    expect(() => decryptRefreshToken(encrypted, 'org_b', key)).toThrow();
    expect(() => decryptRefreshToken({ ...encrypted, tag: Buffer.alloc(16).toString('base64') }, 'org_a', key)).toThrow();
  });

  it('fails closed when the encryption key is missing or not 32 bytes', () => {
    expect(() => encryptRefreshToken('fixture', 'org_a', '')).toThrow('32-byte');
    expect(() => createOAuthState(context, 'not-a-key')).toThrow('32-byte');
  });
});
