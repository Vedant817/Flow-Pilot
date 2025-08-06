// app/api/webhook/gmail/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import axios from 'axios';

const oAuth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

oAuth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

async function getEmailDetails(messageId: string) {
  try {
    const emailResponse = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
    });

    const headers = emailResponse.data.payload?.headers;
    const fromHeader = headers?.find((h) => h.name === 'From');
    const subjectHeader = headers?.find((h) => h.name === 'Subject');

    const fromRaw = fromHeader ? fromHeader.value : 'Unknown Sender';
    const subject = subjectHeader ? subjectHeader.value : 'No Subject';

    let senderName = '';
    let senderEmail = '';

    if (fromRaw) {
      const fromParts = fromRaw.match(/"?([^"]*)"?\s*<([^>]+)>/);
      if (fromParts && fromParts.length === 3) {
        senderName = fromParts[1].trim();
        senderEmail = fromParts[2].trim();
      } else if (fromRaw.includes('@')) {
        senderEmail = fromRaw.trim();
        senderName = senderEmail.split('@')[0];
      } else {
        senderName = fromRaw.trim();
      }
    }

    let body = '';
    const payload = emailResponse.data.payload;

    if (payload?.parts) {
      let part = payload.parts.find(p => p.mimeType === 'text/plain');
      if (!part) {
        part = payload.parts.find(p => p.mimeType === 'text/html');
      }
      if (part?.body?.data) {
        const decodedBody = Buffer.from(part.body.data, 'base64').toString('utf-8');
        if (part.mimeType === 'text/html') {
          body = decodedBody.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
        } else {
          body = decodedBody;
        }
      }
    } else if (payload?.body?.data) {
      body = Buffer.from(payload.body.data, 'base64').toString('utf-8');
    }

    const attachments = [];
    if (emailResponse.data.payload?.parts) {
      for (const part of emailResponse.data.payload.parts) {
        if (part.filename && part.body?.attachmentId) {
          const attachment = await gmail.users.messages.attachments.get({
            userId: 'me',
            messageId: messageId,
            id: part.body.attachmentId,
          });
          attachments.push({
            filename: part.filename,
            data: attachment.data.data,
          });
        }
      }
    }

    return { from: fromRaw, senderName, senderEmail, subject, body, attachments };
  } catch (error) {
    console.error(`Failed to get email details for message ${messageId}:`, error);
    return null;
  }
}


export async function POST(req: NextRequest) {
    const body = await req.json();

    console.log('Gmail Webhook Received');

    const message = body.message;
    if (!message?.data) {
        console.log('No message data found');
        return NextResponse.json({ message: 'No data found' });
    }

    try {
        const decoded = Buffer.from(message.data, 'base64').toString('utf-8');
        const decodedMessage = JSON.parse(decoded);
        console.log('Decoded Message:', decodedMessage);

        const historyResponse = await gmail.users.history.list({
            userId: 'me',
            startHistoryId: decodedMessage.historyId,
        });

        if (historyResponse.data.history) {
            for (const historyItem of historyResponse.data.history) {
                if (historyItem.messagesAdded) {
                    for (const messageAdded of historyItem.messagesAdded) {
                        if (messageAdded.message?.id) {
                            const emailDetails = await getEmailDetails(messageAdded.message.id);
                            if (emailDetails) {
                                console.log('--- New Email Received ---');
                                console.log('Sender Name:', emailDetails.senderName);
                                console.log('Sender Email:', emailDetails.senderEmail);
                                console.log('Body:', emailDetails.body);
                                console.log('Attachments:', emailDetails.attachments.map(a => a.filename).join(', ') || 'None');
                                console.log('--------------------------');
                                await axios.post('http://localhost:3000/api/root', emailDetails);
                            }
                        }
                    }
                }
            }
        }


    } catch (e) {
        console.error('Error processing webhook:', e);
    }

    return new Response('ok', { status: 200 });
}
