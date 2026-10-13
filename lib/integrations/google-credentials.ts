import { google } from 'googleapis';
import dbConnect from '@/lib/mongodb';
import {
  decryptRefreshToken, encryptRefreshToken,
  type EncryptedRefreshToken, IntegrationConfigurationError,
} from './google-security';

export const GMAIL_READ_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

type GoogleCredential = {
  orgId: string;
  provider: 'gmail';
  refreshToken: EncryptedRefreshToken;
  updatedAt: Date;
  connectedBy: string;
};

export function createGoogleOAuthClient() {
  const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim();
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!redirectUri || !clientId || !clientSecret) {
    throw new IntegrationConfigurationError('Google OAuth credentials and redirect URI must be configured');
  }
  const url = new URL(redirectUri);
  if ((url.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' &&
    url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) ||
    url.username || url.password || url.search || url.hash) {
    throw new IntegrationConfigurationError('Google redirect URI must be HTTPS (localhost HTTP is allowed in development)');
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export async function saveGoogleRefreshToken(orgId: string, userId: string, token: string): Promise<void> {
  const encrypted = encryptRefreshToken(token, orgId, process.env.INTEGRATION_ENCRYPTION_KEY ?? '');
  const conn = await dbConnect();
  await conn.connection.db!.collection<GoogleCredential>('integration_credentials').updateOne(
    { orgId, provider: 'gmail' },
    { $set: { refreshToken: encrypted, updatedAt: new Date(), connectedBy: userId } },
    { upsert: true }
  );
}

export async function createGmailClient(orgId: string) {
  const client = createGoogleOAuthClient();
  const conn = await dbConnect();
  const stored = await conn.connection.db!.collection<GoogleCredential>('integration_credentials')
    .findOne({ orgId, provider: 'gmail' });
  let token: string;
  if (stored?.refreshToken) {
    token = decryptRefreshToken(stored.refreshToken, orgId, process.env.INTEGRATION_ENCRYPTION_KEY ?? '');
  } else if (orgId === process.env.GMAIL_ORG_ID?.trim() && process.env.GOOGLE_REFRESH_TOKEN?.trim()) {
    // Legacy service credential is bound to its explicitly configured workspace.
    token = process.env.GOOGLE_REFRESH_TOKEN.trim();
  } else {
    throw new IntegrationConfigurationError('No Gmail connection exists for this workspace');
  }
  client.setCredentials({ refresh_token: token });
  return google.gmail({ version: 'v1', auth: client });
}
