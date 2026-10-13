import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { AuthorizationError, requirePermission } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import { createGoogleOAuthClient, saveGoogleRefreshToken, GMAIL_READ_SCOPE } from '@/lib/integrations/google-credentials';
import { verifyOAuthState, OAuthStateError, IntegrationConfigurationError, OAUTH_COOKIE_NAME } from '@/lib/integrations/google-security';

function result(body: Record<string, unknown>, status: number) {
    const response = NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
    response.cookies.set(OAUTH_COOKIE_NAME, '', {
        httpOnly: true, secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax', path: '/api/auth', maxAge: 0,
    });
    return response;
}

export async function GET(req: NextRequest) {
    try {
        const auth = await requirePermission('admin:operate');
        const params = new URL(req.url).searchParams;
        const state = params.get('state') ?? '';
        verifyOAuthState(state, req.cookies.get(OAUTH_COOKIE_NAME)?.value ?? '',
            auth, process.env.INTEGRATION_ENCRYPTION_KEY ?? '');
        const conn = await dbConnect();
        const consumed = await conn.connection.db!.collection<{
            _id: string; orgId: string; userId: string; expiresAt: Date;
        }>('oauth_states').findOneAndDelete({
            _id: createHash('sha256').update(state).digest('hex'),
            orgId: auth.orgId, userId: auth.userId, expiresAt: { $gt: new Date() },
        });
        if (!consumed) throw new OAuthStateError('OAuth state has expired or was already used');
        const code = params.get('code');
        if (!code || params.has('error')) return result({ error: 'Google authorization was not completed' }, 400);
        const client = createGoogleOAuthClient();
        const { tokens } = await client.getToken(code);
        const scopes = typeof tokens.scope === 'string'
            ? new Set(tokens.scope.split(/\s+/).filter(Boolean)) : new Set<string>();
        if (scopes.size !== 1 || !scopes.has(GMAIL_READ_SCOPE)) {
            return result({ error: 'Grant exactly Gmail read access; revoke previous broader grants before reconnecting' }, 403);
        }
        if (!tokens.refresh_token) return result({ error: 'Google did not return an offline credential; restart with consent' }, 409);
        await saveGoogleRefreshToken(auth.orgId, auth.userId, tokens.refresh_token);
        return result({ connected: true, provider: 'gmail', orgId: auth.orgId }, 200);
    } catch (error) {
        if (error instanceof AuthorizationError) return result({ error: error.message }, error.status);
        if (error instanceof OAuthStateError) return result({ error: error.message }, 400);
        if (error instanceof IntegrationConfigurationError) return result({ error: 'Google integration configuration is incomplete' }, 503);
        console.error('Google OAuth credential exchange failed');
        return result({ error: 'Could not complete Google connection; restart authorization' }, 500);
    }
}
