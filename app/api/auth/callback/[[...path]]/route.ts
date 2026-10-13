/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

const REDIRECT_URI = process.env.NODE_ENV === 'development'
    ? 'https://measured-ideal-rattler.ngrok-free.app/api/auth/callback/google'
    : 'https://my-flow-pilot.vercel.app/api/auth/callback/google';

const oAuth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    REDIRECT_URI
);

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');

    if (!code) {
        return NextResponse.json({ error: 'No code found in query' }, { status: 400 });
    }

    try {
        const { tokens } = await oAuth2Client.getToken(code);
        oAuth2Client.setCredentials(tokens);

        return NextResponse.json({
            message: 'Authentication successful! Check your server console for the refresh token.',
        });

    } catch (error: any) {
        console.error('Error exchanging code for tokens:', error.message);
        return NextResponse.json({ error: 'Failed to retrieve tokens' }, { status: 500 });
    }
}