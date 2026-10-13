import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { AuthorizationError, requireMaintenanceAccess } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';

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
  try {
    await requireMaintenanceAccess(req);
  } catch (error) {
    const status = error instanceof AuthorizationError ? error.status : 401;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unauthorized' }, { status });
  }
  const topicName = process.env.GOOGLE_TOPIC_NAME?.trim();
  if (!topicName) {
    return NextResponse.json({ error: 'GOOGLE_TOPIC_NAME is not configured' }, { status: 503 });
  }
  const orgId = process.env.GMAIL_ORG_ID?.trim();
  if (!orgId) {
    return NextResponse.json({ error: 'GMAIL_ORG_ID is not configured' }, { status: 503 });
  }
  try {
    const response = await gmail.users.watch({
      userId: 'me',
      requestBody: {
        labelIds: ['INBOX'],
        topicName,
      },
    });

    if (response.data.historyId) {
      const conn = await dbConnect();
      await conn.connection.db!.collection<{
        _id: string;
        historyId: string;
        orgId: string;
        provider: 'gmail';
        updatedAt: Date;
      }>('integration_cursors').updateOne(
        { _id: `gmail:${orgId}` },
        {
          $set: {
            historyId: response.data.historyId,
            orgId,
            provider: 'gmail',
            updatedAt: new Date(),
          },
        },
        { upsert: true }
      );
    }

    console.log('Gmail watch response:', response.data);
    return NextResponse.json({ success: true, data: response.data });
  } catch (error) {
    console.error('Error setting up Gmail watch:', error);
    return NextResponse.json({ success: false, error: error as string }, { status: 500 });
  }
}
