import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { classifyEmail, extractOrderDetails, extractFeedbackDetails } from '@/lib/gemini-utils';
import { Order } from '@/models/Order';
import { Feedback } from '@/models/Feedback';
import { Error as ErrorModel } from '@/models/Error';
import { ProcessedEmail } from '@/models/ProcessedEmail';
import connectToDatabase from '@/lib/mongodb';

interface EmailDetails {
  from: string;
  senderName: string;
  senderEmail: string;
  subject: string;
  body: string;
  attachments: { filename: string; sizeBytes: number }[];
}

interface GmailPart {
  mimeType?: string | null;
  filename?: string | null;
  body?: {
    data?: string | null;
    attachmentId?: string | null;
    size?: number | null;
  } | null;
  parts?: GmailPart[] | null;
}

const oAuth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

oAuth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalized, 'base64').toString('utf-8');
}

function stripHtml(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function collectParts(part: GmailPart | null | undefined): GmailPart[] {
  if (!part) return [];
  const nested = Array.isArray(part.parts) ? part.parts.flatMap(collectParts) : [];
  return [part, ...nested];
}

function extractBody(payload: GmailPart | null | undefined): string {
  const parts = collectParts(payload);
  const plainPart = parts.find(part => part.mimeType === 'text/plain' && part.body?.data);
  const htmlPart = parts.find(part => part.mimeType === 'text/html' && part.body?.data);
  const selectedPart = plainPart || htmlPart;

  if (!selectedPart?.body?.data) return '';

  const decoded = decodeBase64Url(selectedPart.body.data);
  return selectedPart.mimeType === 'text/html' ? stripHtml(decoded) : decoded.trim();
}

function getHeaderValue(headers: { name?: string | null; value?: string | null }[] | undefined, headerName: string) {
  return headers?.find((h) => h.name?.toLowerCase() === headerName.toLowerCase())?.value || '';
}

function parseSender(fromRaw: string) {
  const fromParts = fromRaw.match(/"?([^"<]*)"?\s*<([^>]+)>/);
  if (fromParts && fromParts.length === 3) {
    return {
      senderName: fromParts[1].trim(),
      senderEmail: fromParts[2].trim().toLowerCase(),
    };
  }

  if (fromRaw.includes('@')) {
    const senderEmail = fromRaw.trim().toLowerCase();
    return {
      senderName: senderEmail.split('@')[0],
      senderEmail,
    };
  }

  return {
    senderName: fromRaw.trim(),
    senderEmail: '',
  };
}

function isAuthorizedWebhook(req: NextRequest): boolean {
  const expectedToken = process.env.GMAIL_WEBHOOK_TOKEN;
  if (!expectedToken) return true;

  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  const headerToken = req.headers.get('x-webhook-token')?.trim();
  return bearer === expectedToken || headerToken === expectedToken;
}

function getAppBaseUrl(): string {
  return (process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
}

function redactEmail(value: string): string {
  if (!value || !value.includes('@')) return 'unknown sender';
  const [local, domain] = value.split('@');
  return `${local.slice(0, 2)}***@${domain}`;
}

async function getEmailDetails(messageId: string): Promise<EmailDetails | null> {
  try {
    const emailResponse = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
    });

    const headers = emailResponse.data.payload?.headers;
    const fromRaw = getHeaderValue(headers, 'From') || 'Unknown Sender';
    const subject = getHeaderValue(headers, 'Subject') || 'No Subject';
    const { senderName, senderEmail } = parseSender(fromRaw);
    const payload = emailResponse.data.payload as GmailPart | null | undefined;
    const body = extractBody(payload);

    const attachments = collectParts(payload)
      .filter(part => Boolean(part.filename && part.body?.attachmentId))
      .map(part => ({
        filename: part.filename || 'attachment',
        sizeBytes: Number(part.body?.size || 0),
      }));

    return { from: fromRaw, senderName, senderEmail, subject, body, attachments };
  } catch (error) {
    console.error(`Failed to get email details for message ${messageId}:`, error);
    return null;
  }
}

async function logCustomerProcessingError(message: string) {
  await ErrorModel.create({
    errorMessage: message,
    type: 'Customer',
    severity: 'low',
    timestamp: new Date(),
  });
}

async function markEmailFailed(messageId: string, historyId: string | undefined, error: unknown) {
  await ProcessedEmail.findOneAndUpdate(
    { messageId },
    {
      $set: {
        historyId,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
      },
    },
    { upsert: true }
  );
}

async function processEmailMessage(messageId: string, historyId?: string) {
  const existing = await ProcessedEmail.findOne({ messageId }).lean();
  if (existing?.status === 'processed') {
    console.log(`Skipping already processed Gmail message ${messageId}`);
    return;
  }

  await ProcessedEmail.findOneAndUpdate(
    { messageId },
    { $set: { historyId, status: 'processing', error: undefined } },
    { upsert: true }
  );

  try {
    const emailDetails = await getEmailDetails(messageId);
    if (!emailDetails?.body) {
      await logCustomerProcessingError(`Gmail message ${messageId} did not contain a parseable body.`);
      await ProcessedEmail.findOneAndUpdate(
        { messageId },
        { $set: { status: 'processed', classification: 'other', processedAt: new Date() } }
      );
      return;
    }

    const classification = await classifyEmail(emailDetails.body);
    console.log(`Gmail message ${messageId} classified as ${classification}`);

    switch (classification) {
      case 'new_order': {
        const orderDetails = await extractOrderDetails(emailDetails.body);
        if (!orderDetails) {
          await logCustomerProcessingError(`Order extraction failed validation for Gmail message ${messageId}.`);
          break;
        }

        const newOrder = new Order({
          ...orderDetails,
          email: emailDetails.senderEmail,
          status: 'pending',
          orderLink: `${getAppBaseUrl()}/track-order/pending`,
        });
        await newOrder.save();
        newOrder.orderLink = `${getAppBaseUrl()}/track-order/${newOrder._id?.toString()}`;
        await newOrder.save();
        break;
      }
      case 'update_order': {
        const updatedOrderDetails = await extractOrderDetails(emailDetails.body);
        if (!updatedOrderDetails) {
          await logCustomerProcessingError(`Order update extraction failed validation for Gmail message ${messageId}.`);
          break;
        }

        const existingOrder = await Order.findOne({ email: emailDetails.senderEmail, status: 'pending' }).sort({ date: -1, time: -1 });
        if (existingOrder) {
          existingOrder.set(updatedOrderDetails);
          await existingOrder.save();
        } else {
          await logCustomerProcessingError(`No pending order found to update for Gmail message ${messageId} from ${redactEmail(emailDetails.senderEmail)}.`);
        }
        break;
      }
      case 'feedback': {
        const feedbackDetails = await extractFeedbackDetails(emailDetails.body);
        if (!feedbackDetails) {
          await logCustomerProcessingError(`Feedback extraction failed validation for Gmail message ${messageId}.`);
          break;
        }

        await Feedback.create({
          ...feedbackDetails,
          email: emailDetails.senderEmail,
        });
        break;
      }
      default:
        await logCustomerProcessingError(`Unclassified email from ${redactEmail(emailDetails.senderEmail)} with subject "${emailDetails.subject}".`);
        break;
    }

    await ProcessedEmail.findOneAndUpdate(
      { messageId },
      { $set: { historyId, classification, status: 'processed', processedAt: new Date() } }
    );
  } catch (error) {
    await markEmailFailed(messageId, historyId, error);
    throw error;
  }
}

export async function POST(req: NextRequest) {
  if (!isAuthorizedWebhook(req)) {
    return NextResponse.json({ error: 'Unauthorized webhook request' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const message = (body as { message?: { data?: string } }).message;
  if (!message?.data) {
    return NextResponse.json({ message: 'No Pub/Sub message data found' }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const decoded = decodeBase64Url(message.data);
    const decodedMessage = JSON.parse(decoded) as { historyId?: string };

    if (!decodedMessage.historyId) {
      return NextResponse.json({ error: 'Decoded Pub/Sub message is missing historyId' }, { status: 400 });
    }

    const historyResponse = await gmail.users.history.list({
      userId: 'me',
      startHistoryId: decodedMessage.historyId,
    });

    const messageIds = new Set<string>();
    for (const historyItem of historyResponse.data.history || []) {
      for (const messageAdded of historyItem.messagesAdded || []) {
        if (messageAdded.message?.id) {
          messageIds.add(messageAdded.message.id);
        }
      }
    }

    for (const messageId of messageIds) {
      await processEmailMessage(messageId, decodedMessage.historyId);
    }

    return NextResponse.json({ ok: true, processedMessages: messageIds.size });
  } catch (error) {
    console.error('Error processing Gmail webhook:', error);
    return NextResponse.json({ error: 'Failed to process Gmail webhook' }, { status: 500 });
  }
}
