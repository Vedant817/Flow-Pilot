import {
  createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual,
} from 'crypto';

export const OAUTH_STATE_TTL_MS = 600_000;
export const OAUTH_COOKIE_NAME = 'flowpilot_google_oauth';

type OAuthContext = { orgId: string; userId: string };
type OAuthState = OAuthContext & { issuedAt: number; nonce: string };
export type EncryptedRefreshToken = { version: 1; iv: string; tag: string; ciphertext: string };

export class IntegrationConfigurationError extends Error {}
export class OAuthStateError extends Error {}

function encryptionKey(encoded: string): Buffer {
  const key = Buffer.from(encoded, 'base64');
  if (!encoded || key.length !== 32 || key.toString('base64') !== encoded) {
    throw new IntegrationConfigurationError('A canonical base64-encoded 32-byte INTEGRATION_ENCRYPTION_KEY is required');
  }
  return key;
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function signature(payload: string, key: string): string {
  return createHmac('sha256', encryptionKey(key))
    .update(`flowpilot:google-oauth:v1:${payload}`).digest('base64url');
}

export function createOAuthState(context: OAuthContext, key: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({
    ...context, issuedAt: now, nonce: randomBytes(32).toString('base64url'),
  })).toString('base64url');
  return `${payload}.${signature(payload, key)}`;
}

export function verifyOAuthState(
  state: string, cookie: string, context: OAuthContext, key: string, now = Date.now()
): OAuthState {
  const invalid = () => new OAuthStateError('Invalid OAuth state; restart the connection flow');
  if (!state || state.length > 2048 || !safeEqual(state, cookie)) throw invalid();
  const parts = state.split('.');
  if (parts.length !== 2 || !safeEqual(parts[1], signature(parts[0], key))) throw invalid();
  let parsed: OAuthState;
  try { parsed = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')); }
  catch { throw invalid(); }
  if (!parsed || parsed.orgId !== context.orgId || parsed.userId !== context.userId ||
    typeof parsed.issuedAt !== 'number' || !Number.isFinite(parsed.issuedAt) ||
    parsed.issuedAt > now || now - parsed.issuedAt > OAUTH_STATE_TTL_MS ||
    typeof parsed.nonce !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(parsed.nonce)) throw invalid();
  return parsed;
}

export function encryptRefreshToken(token: string, orgId: string, key: string): EncryptedRefreshToken {
  if (!token || !orgId) throw new Error('Refresh token and workspace are required');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(key), iv);
  cipher.setAAD(Buffer.from(`gmail:${orgId}:v1`));
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return { version: 1, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64') };
}

export function decryptRefreshToken(token: EncryptedRefreshToken, orgId: string, key: string): string {
  if (token.version !== 1) throw new Error('Unsupported credential version');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(key), Buffer.from(token.iv, 'base64'));
  decipher.setAAD(Buffer.from(`gmail:${orgId}:v1`));
  decipher.setAuthTag(Buffer.from(token.tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(token.ciphertext, 'base64')), decipher.final()]).toString('utf8');
}
