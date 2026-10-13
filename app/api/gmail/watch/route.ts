import { NextRequest, NextResponse } from 'next/server';
import { AuthorizationError, requireMaintenanceAccess } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import { createGmailClient } from '@/lib/integrations/google-credentials';

export async function POST(req: NextRequest) {
  let auth: Awaited<ReturnType<typeof requireMaintenanceAccess>>;
  try {
    auth = await requireMaintenanceAccess(req);
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
  if (auth.orgId !== orgId) {
    return NextResponse.json({ error: 'This workspace does not own the configured Gmail ingestion channel' }, { status: 403 });
  }
  try {
    const gmail = await createGmailClient(orgId);
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

    return NextResponse.json({ success: true, data: response.data });
  } catch (error) {
    console.error('Error setting up Gmail watch', error instanceof Error ? error.name : 'UnknownError');
    return NextResponse.json({ success: false, error: 'Could not configure Gmail watch' }, { status: 500 });
  }
}
