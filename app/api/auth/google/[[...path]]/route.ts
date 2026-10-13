import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { AuthorizationError, requirePermission } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import { createGoogleOAuthClient, GMAIL_READ_SCOPE } from '@/lib/integrations/google-credentials';
import { createOAuthState, IntegrationConfigurationError, OAUTH_COOKIE_NAME, OAUTH_STATE_TTL_MS } from '@/lib/integrations/google-security';

export async function GET(req: NextRequest) {
    try {
        const auth = await requirePermission('admin:operate');
        if (new URL(req.url).searchParams.get('action') !== 'login') {
            return NextResponse.json({ message: 'Provide ?action=login to connect Gmail' });
        }
        const client = createGoogleOAuthClient();
        const state = createOAuthState(auth, process.env.INTEGRATION_ENCRYPTION_KEY ?? '');
        const conn = await dbConnect();
        await conn.connection.db!.collection<{
            _id: string; orgId: string; userId: string; expiresAt: Date;
        }>('oauth_states').insertOne({
            _id: createHash('sha256').update(state).digest('hex'),
            orgId: auth.orgId, userId: auth.userId,
            expiresAt: new Date(Date.now() + OAUTH_STATE_TTL_MS),
        });
        const response = NextResponse.redirect(client.generateAuthUrl({
            access_type: 'offline', prompt: 'consent', scope: [GMAIL_READ_SCOPE], state,
        }));
        response.cookies.set(OAUTH_COOKIE_NAME, state, {
            httpOnly: true, secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax', path: '/api/auth', maxAge: OAUTH_STATE_TTL_MS / 1000,
        });
        response.headers.set('Cache-Control', 'private, no-store');
        return response;
    } catch (error) {
        if (error instanceof AuthorizationError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        if (error instanceof IntegrationConfigurationError) {
            return NextResponse.json({ error: 'Google integration configuration is incomplete' }, { status: 503 });
        }
        console.error('Google OAuth initialization failed');
        return NextResponse.json({ error: 'Could not start Google connection' }, { status: 500 });
    }
}
