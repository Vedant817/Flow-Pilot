import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

const oAuth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

oAuth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

export async function POST(req: NextRequest) {
  // Protect watch re-registration; require admin secret when configured
  const adminSecret = process.env.ADMIN_SECRET;
  if (adminSecret && req.headers.get('x-admin-secret') !== adminSecret) {
    // Also allow Clerk-authenticated requests via middleware-protected context
    // but reject anonymous PubSub-style replays when secret is configured
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }
  try {
    const response = await gmail.users.watch({
      userId: 'me',
      requestBody: {
        labelIds: ['INBOX'],
        topicName: process.env.GOOGLE_TOPIC_NAME,
      },
    });

    console.log('Gmail watch response:', response.data);
    return NextResponse.json({ success: true, data: response.data });
  } catch (error) {
    console.error('Error setting up Gmail watch:', error);
    return NextResponse.json({ success: false, error: error as string }, { status: 500 });
  }
}
