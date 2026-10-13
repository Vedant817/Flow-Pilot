import { NextRequest } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { google, gmail_v1 } from 'googleapis';
import { classifyEmail } from '@/lib/nlp/classify';
import { extractOrderDetails, extractFeedbackDetails } from '@/lib/nlp/extract';
import { applyOrderDelta } from '@/lib/analytics/rollup';
import { ingestDocument } from '@/lib/ai/memory';
import { Order } from '@/models/Order';
import { Feedback } from '@/models/Feedback';
import { Error as ErrorModel } from '@/models/Error';
import connectToDatabase from '@/lib/mongodb';
import { acquireLock, releaseLock } from '@/lib/distributed-lock';

const oAuth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

oAuth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

interface GmailCursor {
  _id: string;
  historyId: string;
  orgId: string;
  provider: 'gmail';
  updatedAt: Date;
}

interface PubSubPushBody {
  message?: {
    data?: string;
    messageId?: string;
  };
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

async function isAuthorizedWebhook(req: NextRequest): Promise<boolean> {
  const webhookSecret = process.env.GMAIL_WEBHOOK_SECRET?.trim();
  const providedSecret = req.headers.get('x-gmail-webhook-secret') ?? '';
  if (webhookSecret && safeEqual(providedSecret, webhookSecret)) {
    return true;
  }

  const audience = process.env.GOOGLE_PUBSUB_AUDIENCE?.trim();
  const serviceAccountEmail = process.env.GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL?.trim();
  const authorization = req.headers.get('authorization') ?? '';
  if (!audience || !serviceAccountEmail || !authorization.startsWith('Bearer ')) {
    return false;
  }

  try {
    const ticket = await oAuth2Client.verifyIdToken({
      idToken: authorization.slice('Bearer '.length),
      audience,
    });
    const payload = ticket.getPayload();
    return payload?.email_verified === true && payload.email === serviceAccountEmail;
  } catch {
    return false;
  }
}

function hasWebhookAuthConfig(): boolean {
  return Boolean(
    process.env.GMAIL_WEBHOOK_SECRET?.trim() ||
      (process.env.GOOGLE_PUBSUB_AUDIENCE?.trim() &&
        process.env.GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL?.trim())
  );
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

async function getEmailDetails(messageId: string) {
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

    const textParts: gmail_v1.Schema$MessagePart[] = [];
    function collectTextParts(part: gmail_v1.Schema$MessagePart) {
      // Named attachments are not the message body, even when they contain text.
      if (part.filename) return;
      if (
        (part.mimeType === 'text/plain' || part.mimeType === 'text/html' ||
          (part === payload && !part.mimeType)) &&
        (part.body?.data || part.body?.attachmentId)
      ) {
        textParts.push(part);
      }
      for (const child of part.parts ?? []) collectTextParts(child);
    }
    if (payload) collectTextParts(payload);
    const part = textParts.find(p => p.mimeType === 'text/plain') ?? textParts[0];
    if (part) {
      let data = part.body?.data;
      if (!data && part.body?.attachmentId) {
        const attachment = await gmail.users.messages.attachments.get({
          userId: 'me',
          messageId,
          id: part.body.attachmentId,
        });
        data = attachment.data.data;
        if (typeof data !== 'string') {
          throw new Error(`Missing Gmail body attachment data for message ${messageId}`);
        }
      }
      const decodedBody = Buffer.from(data ?? '', 'base64').toString('utf-8');
      body = part.mimeType === 'text/html'
        ? decodedBody.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
        : decodedBody;
    }

  return { from: fromRaw, senderName, senderEmail, subject, body };
}


export async function POST(req: NextRequest) {
  if (!hasWebhookAuthConfig()) {
    console.error('Gmail webhook authentication is not configured');
    return jsonResponse({ error: 'Webhook authentication is not configured' }, 503);
  }
  if (!(await isAuthorizedWebhook(req))) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const orgId = process.env.GMAIL_ORG_ID?.trim();
  if (!orgId) {
    console.error('GMAIL_ORG_ID is not configured');
    return jsonResponse({ error: 'Gmail workspace is not configured' }, 503);
  }

  let body: PubSubPushBody;
  try {
    body = await req.json() as PubSubPushBody;
  } catch {
    return jsonResponse({ error: 'Invalid JSON payload' }, 400);
  }

  const message = body?.message;
  if (typeof message?.data !== 'string') {
    return jsonResponse({ error: 'No message data found' }, 400);
  }

  const lockKey = `gmail-ingestion:${orgId}`;
  const lockOwner = typeof message.messageId === 'string'
    ? message.messageId
    : `notification:${Date.now()}`;
  let lockAcquired = false;
  try {
    const conn = await connectToDatabase();
    const decoded = Buffer.from(message.data, 'base64').toString('utf-8');
    const decodedMessage = JSON.parse(decoded);
    if (typeof decodedMessage?.historyId !== 'string') {
      return jsonResponse({ error: 'Invalid Gmail notification' }, 400);
    }

    lockAcquired = await acquireLock(lockKey, 120_000, lockOwner);
    if (!lockAcquired) {
      return jsonResponse({ error: 'Gmail ingestion is already running' }, 409);
    }

    const cursorCollection = conn.connection.db!.collection<GmailCursor>('integration_cursors');
    const cursorId = `gmail:${orgId}`;
    const cursor = await cursorCollection.findOne({ _id: cursorId });
    if (!cursor?.historyId) {
      await cursorCollection.updateOne(
        { _id: cursorId },
        {
          $set: {
            historyId: decodedMessage.historyId,
            orgId,
            provider: 'gmail',
            updatedAt: new Date(),
          },
        },
        { upsert: true }
      );
      return jsonResponse({ ok: true, initialized: true });
    }

    const historyItems = [];
    let pageToken: string | undefined;
    do {
      const historyResponse = await gmail.users.history.list({
        userId: 'me',
        startHistoryId: cursor.historyId,
        pageToken,
      });
      historyItems.push(...(historyResponse.data.history ?? []));
      pageToken = historyResponse.data.nextPageToken ?? undefined;
    } while (pageToken);

    if (historyItems.length > 0) {
      const processedMessageIds = new Set<string>();
      for (const historyItem of historyItems) {
        if (historyItem.messagesAdded) {
          for (const messageAdded of historyItem.messagesAdded) {
            const sourceMessageId = messageAdded.message?.id;
            if (sourceMessageId && !processedMessageIds.has(sourceMessageId)) {
              processedMessageIds.add(sourceMessageId);
              const emailDetails = await getEmailDetails(sourceMessageId);
              if (emailDetails && emailDetails.body) {
                if (!emailDetails.senderEmail.includes('@')) {
                  try {
                    await new ErrorModel({
                      orgId,
                      sourceMessageId,
                      errorMessage: 'Inbound email has no valid sender address',
                      type: 'Customer',
                      severity: 'low',
                      timestamp: new Date(),
                    }).save();
                  } catch (error) {
                    if (!isDuplicateKeyError(error)) throw error;
                  }
                  continue;
                }
                const classification = await classifyEmail(emailDetails.body);
                console.log(`Email classified as: ${classification}`);

                switch (classification) {
                  case 'new_order': {
                    const orderDetails = await extractOrderDetails(emailDetails.body);
                    if (orderDetails) {
                      const newOrder = new Order({
                        ...orderDetails,
                        name: orderDetails.name || emailDetails.senderName || 'Email customer',
                        orgId,
                        email: emailDetails.senderEmail,
                        status: 'pending',
                        orderLink: '',
                        idempotencyKey: `gmail:${sourceMessageId}`,
                      });
                      try {
                        await newOrder.save();
                        await applyOrderDelta(orgId, newOrder.date, newOrder.products, 1).catch((e) =>
                          console.error('Rollup delta failed:', e)
                        );
                        void ingestDocument(
                          'order',
                          String(newOrder._id),
                          'Inbound email order',
                          `Inbound email order for ${newOrder.products
                            .map((p) => `${p.quantity}x ${p.name}`)
                            .join(', ')} for ${newOrder.date}. Source: inbound email.`,
                          { orgId }
                        ).catch(() => undefined);
                        console.log('New order saved:', newOrder._id);
                      } catch (error) {
                        if (!isDuplicateKeyError(error)) throw error;
                      }
                    }
                    break;
                  }
                  case 'update_order': {
                    const updatedOrderDetails = await extractOrderDetails(emailDetails.body);
                    if (updatedOrderDetails) {
                      const existingOrder = await Order.findOne({
                        orgId,
                        email: emailDetails.senderEmail,
                        status: 'pending',
                      }).sort({ date: -1, time: -1 });
                      if (existingOrder) {
                        existingOrder.set(updatedOrderDetails);
                        await existingOrder.save();
                        console.log('Order updated:', existingOrder);
                      } else {
                        console.log('No pending order found to update for:', emailDetails.senderEmail);
                      }
                    }
                    break;
                  }
                  case 'feedback': {
                    const feedbackDetails = await extractFeedbackDetails(emailDetails.body);
                    if (feedbackDetails) {
                      const newFeedback = new Feedback({
                        ...feedbackDetails,
                        orgId,
                        sourceMessageId,
                        email: emailDetails.senderEmail,
                      });
                      try {
                        await newFeedback.save();
                        console.log('New feedback saved:', newFeedback);
                      } catch (error) {
                        if (!isDuplicateKeyError(error)) throw error;
                      }
                    }
                    break;
                  }
                  default: {
                    const newError = new ErrorModel({
                      orgId,
                      sourceMessageId,
                      errorMessage: 'Unclassified inbound email',
                      type: 'Customer',
                      severity: 'low',
                      timestamp: new Date(),
                    });
                    try {
                      await newError.save();
                      console.log('Unclassified email logged as error.');
                    } catch (error) {
                      if (!isDuplicateKeyError(error)) throw error;
                    }
                    break;
                  }
                }
              }
            }
          }
        }
      }
    }

    await cursorCollection.updateOne(
      { _id: cursorId, historyId: cursor.historyId },
      {
        $set: {
          historyId: decodedMessage.historyId,
          updatedAt: new Date(),
        },
      }
    );
  } catch (e) {
    console.error('Error processing webhook:', e);
    return jsonResponse({ error: 'Webhook processing failed' }, 500);
  } finally {
    if (lockAcquired) {
      await releaseLock(lockKey, lockOwner).catch(() => undefined);
    }
  }

  return jsonResponse({ ok: true });
}
