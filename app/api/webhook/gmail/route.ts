import { NextRequest } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { google, gmail_v1 } from 'googleapis';
import { classifyEmailWithScores } from '@/lib/nlp/classify';
import { extractFeedbackDetails } from '@/lib/nlp/extract';
import { hasExplicitNewOrderRequest, hasUsableOrderLines, hasExistingOrderChangeLanguage } from '@/lib/nlp/order-intent';
import { parseNewOrder, parseOrderChanges } from '@/lib/nlp/email-orders';
import { prepareConfirmedEmailOrder } from '@/lib/nlp/order-placement';
import { applyOrderDelta } from '@/lib/analytics/rollup';
import { ingestDocument } from '@/lib/ai/memory';
import { Order } from '@/models/Order';
import { Feedback } from '@/models/Feedback';
import { Error as ErrorModel } from '@/models/Error';
import { EmailReview } from '@/models/EmailReview';
import { InboundOrderDraft } from '@/models/InboundOrderDraft';
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

    const fromRaw = fromHeader?.value ?? '';
    const subject = subjectHeader?.value ?? '';

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

  const receivedAt = Number(emailResponse.data.internalDate);
  return { from: fromRaw, senderName, senderEmail, subject, body,
    placedAt: Number.isFinite(receivedAt) && receivedAt > 0 ? new Date(receivedAt) : new Date() };
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
    if (typeof decodedMessage?.historyId !== 'string' || !/^\d+$/.test(decodedMessage.historyId)) {
      return jsonResponse({ error: 'Invalid Gmail notification' }, 400);
    }

    lockAcquired = await acquireLock(lockKey, 120_000, lockOwner);
    if (!lockAcquired) {
      return jsonResponse({ error: 'Gmail ingestion is already running' }, 409);
    }

    const cursorCollection = conn.connection.db!.collection<GmailCursor>('integration_cursors');
    const processedCol = conn.connection.db!.collection<{ _id: string; at?: Date }>('processed_gmail_messages');
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
    if (BigInt(decodedMessage.historyId) <= BigInt(cursor.historyId)) {
      return jsonResponse({ ok: true, duplicate: true });
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
              const processedId = `gmail:${orgId}:${sourceMessageId}`;
              if (await processedCol.findOne({ _id: processedId })) continue;
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
                const gmailMessageId = sourceMessageId;
                const { label: classification, confidence, scores } = await classifyEmailWithScores(
                  emailDetails.body, emailDetails.subject
                );
                console.log(`Email classified as: ${classification}`);
                console.log(`Classification detail: confidence=${confidence.toFixed(3)} scores=${JSON.stringify(scores)}`);
                const review = async (reason: string) => {
                  await EmailReview.updateOne(
                    { orgId, gmailMessageId },
                    { $setOnInsert: {
                      orgId, gmailMessageId, senderEmail: emailDetails.senderEmail,
                      subject: emailDetails.subject, body: emailDetails.body.slice(0, 6000),
                      classification, reason,
                      proposedChanges: classification === 'update_order' ? parseOrderChanges(emailDetails.body) : [],
                      status: 'open', createdAt: new Date(),
                    } }, { upsert: true }
                  );
                };
                const draft = async (parsed: ReturnType<typeof parseNewOrder> & { ready: false }) => {
                  if (await Order.exists({ orgId, idempotencyKey: `gmail:${gmailMessageId}` })) return;
                  await InboundOrderDraft.updateOne(
                    { orgId, gmailMessageId },
                    { $setOnInsert: {
                      orgId, gmailMessageId, senderEmail: emailDetails.senderEmail,
                      senderName: emailDetails.senderName || emailDetails.senderEmail,
                      subject: emailDetails.subject, body: emailDetails.body.slice(0, 6000),
                      placedAt: emailDetails.placedAt, products: parsed.products,
                      ...(parsed.date ? { requestedDeliveryDate: parsed.date.value } : {}),
                      ...(parsed.time ? { requestedDeliveryTime: parsed.time.value } : {}),
                      reason: parsed.reason, status: 'draft', createdAt: new Date(),
                    } }, { upsert: true }
                  );
                };

                switch (classification) {
                  case 'new_order': {
                    if (hasExistingOrderChangeLanguage(emailDetails.subject, emailDetails.body)) {
                      await review('Possible existing-order change classified as new');
                      break;
                    }
                const orderDetails = parseNewOrder(emailDetails.subject ?? '', emailDetails.body);
                if (orderDetails.ready && hasUsableOrderLines(orderDetails.products) &&
                    hasExplicitNewOrderRequest(emailDetails.subject ?? '', emailDetails.body)) {
                  const prepared = prepareConfirmedEmailOrder({
                    products: orderDetails.products, placedAt: emailDetails.placedAt,
                    requestedDeliveryDate: orderDetails.date.value,
                    requestedDeliveryTime: orderDetails.time.value,
                  });
                  if (!prepared.ok) { await review(prepared.reason); break; }
                  const idempotencyKey = `gmail:${gmailMessageId}`;
                  if (await InboundOrderDraft.exists({ orgId, gmailMessageId })) {
                    console.log('Existing draft must be confirmed by a reviewer:', gmailMessageId);
                    break;
                  }
                  if (await Order.exists({ orgId, idempotencyKey })) {
                    console.log('Order already created from Gmail message:', gmailMessageId);
                    break;
                  }
                  const newOrder = new Order({
                    name: emailDetails.senderName || emailDetails.senderEmail,
                    phone: '',
                    email: emailDetails.senderEmail,
                    orgId,
                    products: prepared.products,
                    date: prepared.date,
                    time: prepared.time,
                    placedAt: prepared.placedAt,
                    orderedAt: prepared.placedAt,
                    requestedDeliveryDate: prepared.requestedDeliveryDate,
                    requestedDeliveryTime: prepared.requestedDeliveryTime,
                    idempotencyKey,
                    status: 'pending fulfillment',
                    orderLink: '',
                  });
                  try {
                    await newOrder.save();
                  } catch (error) {
                    // Unique idempotencyKey index handles overlapping webhook deliveries.
                    if ((error as { code?: number }).code === 11000 && await Order.exists({ orgId, idempotencyKey })) break;
                    throw error;
                  }
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
                } else {
                  if (!orderDetails.ready && orderDetails.intent) await draft(orderDetails);
                  else await review(orderDetails.ready ? 'Invalid product lines' : orderDetails.reason);
                }
                break;
              }
              case 'update_order': {
                // extractOrderDetails produces default dates/times and a *partial* product list.
                // Applying it with .set() can overwrite the entire original order. Until a
                // validated change parser exists, route amendments/cancellations for review.
                await review('order change requires verification');
                break;
              }
              case 'feedback': {
                const feedbackDetails = await extractFeedbackDetails(emailDetails.body);
                if (feedbackDetails) {
                  const newFeedback = new Feedback({
                    ...feedbackDetails,
                    email: emailDetails.senderEmail,
                    orgId,
                    sourceMessageId,
                  });
                  try { await newFeedback.save(); }
                  catch (error) { if (!isDuplicateKeyError(error)) throw error; }
                  console.log('New feedback saved:', newFeedback);
                }
                break;
              }
              default: {
                if (hasExistingOrderChangeLanguage(emailDetails.subject ?? '', emailDetails.body)) {
                  await review('Possible existing-order change classified as other');
                  break;
                }
                if (hasExplicitNewOrderRequest(emailDetails.subject ?? '', emailDetails.body)) {
                  const parsed = parseNewOrder(emailDetails.subject ?? '', emailDetails.body);
                  if (!parsed.ready && parsed.intent) await draft(parsed);
                  else await review('Potential order classified as other');
                  break;
                }
                const newError = new ErrorModel({
                  errorMessage: 'Unclassified inbound email',
                  type: 'Customer',
                  severity: 'low',
                  timestamp: new Date(),
                  orgId,
                  sourceMessageId,
                });
                try { await newError.save(); }
                catch (error) { if (!isDuplicateKeyError(error)) throw error; }
                console.log('Unclassified email logged as error.');
                break;
              }
            }
              }
              await processedCol.updateOne(
                { _id: processedId },
                { $setOnInsert: { at: new Date() } },
                { upsert: true }
              );
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
