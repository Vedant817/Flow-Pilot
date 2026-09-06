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
    const action = searchParams.get('action');

    if (action === 'login') {
        const authUrl = oAuth2Client.generateAuthUrl({
            access_type: 'offline',
            prompt: 'consent',
            scope: [
                'https://www.googleapis.com/auth/gmail.readonly',
                'https://www.googleapis.com/auth/pubsub',
            ],
        });
        return NextResponse.redirect(authUrl);
    }

    return NextResponse.json({ message: 'Provide ?action=login to start the auth flow' });
}