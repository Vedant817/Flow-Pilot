import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { google, type gmail_v1 } from 'googleapis';
import { classifyEmailWithScores } from '@/lib/nlp/classify';
import { hasExplicitNewOrderRequest, hasUsableOrderLines, hasExistingOrderChangeLanguage } from '@/lib/nlp/order-intent';
import { extractFeedbackDetails } from '@/lib/nlp/extract';
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

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
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

const MAX_ATTACHMENTS = 3;
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const MAX_HISTORY_PAGES = 10;

function verifyWebhookSecret(req: NextRequest): boolean {
  const expected = process.env.GMAIL_WEBHOOK_SECRET;
  if (!expected) {
    if (process.env.NODE_ENV === 'production') return false;
    console.warn('GMAIL_WEBHOOK_SECRET not set — accepting webhook in dev (no verification)');
    return true;
  }
  const provided = req.headers?.get('x-webhook-secret') ?? '';
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function compareHistoryId(a: string | undefined, b: string | undefined): number {
  if (!a) return b ? -1 : 0;
  if (!b) return 1;
  try {
    const ba = BigInt(a);
    const bb = BigInt(b);
    return ba < bb ? -1 : ba > bb ? 1 : 0;
  } catch {
    return a < b ? -1 : a > b ? 1 : 0;
  }
}

async function getEmailDetails(messageId: string) {
  try {
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

    const attachments: Array<{ filename: string }> = [];
    if (emailResponse.data.payload?.parts) {
      for (const part of emailResponse.data.payload.parts) {
        if (attachments.length >= MAX_ATTACHMENTS) break;
        if (part.filename && part.body?.attachmentId) {
          const declaredSize = (part.body as { size?: number }).size;
          if (typeof declaredSize === 'number' && declaredSize > MAX_ATTACHMENT_BYTES) {
            console.log(`Skipping attachment ${part.filename}: exceeds 5MB (${declaredSize} bytes)`);
            continue;
          }
          const attachment = await gmail.users.messages.attachments.get({
            userId: 'me',
            messageId: messageId,
            id: part.body.attachmentId,
          });
          const raw = (attachment.data.data as string | undefined) ?? '';
          // Approx decoded size from base64 length without holding decoded bytes.
          const approxBytes = Math.floor(raw.length * 0.75);
          if (approxBytes > MAX_ATTACHMENT_BYTES) {
            console.log(`Skipping attachment ${part.filename}: exceeds 5MB`);
            continue;
          }
          // Do not store raw data in DB — just log filename.
          console.log(`Attachment received (not stored): ${part.filename}`);
          attachments.push({ filename: part.filename });
        }
      }
    }

    const receivedAt = Number(emailResponse.data.internalDate);
    return { from: fromRaw, senderName, senderEmail, subject, body, attachments,
      placedAt: Number.isFinite(receivedAt) && receivedAt > 0 ? new Date(receivedAt) : new Date() };
  } catch (error) {
    console.error(`Failed to get email details for message ${messageId}:`, error);
    return null;
  }
}


export async function POST(req: NextRequest) {
  const orgId = process.env.GMAIL_ORG_ID?.trim();
  if (!orgId) return json({ error: 'Gmail organization is not configured' }, 503);
  if (!verifyWebhookSecret(req)) {
    return json({ error: 'Invalid webhook secret' }, 401);
  }

  const body = await req.json();

  console.log('Gmail Webhook Received');

  const message = body.message;
  if (!message?.data) {
    console.log('No message data found');
    return json({ error: 'Missing message.data' }, 400);
  }

  try {
    const conn = await connectToDatabase();
    const db = conn.connection.db!;
    const processedCol = db.collection<{ _id: string; at?: Date }>('processed_gmail_messages');
    const cursorCol = db.collection<{ _id: string; historyId?: string }>('gmail_cursors');

    const decoded = Buffer.from(message.data, 'base64').toString('utf-8');
    const decodedMessage = JSON.parse(decoded) as { historyId?: string | number };
    console.log('Decoded Message:', decodedMessage);

    const incomingHistoryId: string | undefined = decodedMessage.historyId
      ? String(decodedMessage.historyId)
      : undefined;

    const storedCursor = await cursorCol.findOne({ _id: 'default' });
    let startHistoryId: string | undefined = incomingHistoryId;
    if (storedCursor?.historyId) {
      if (!incomingHistoryId || compareHistoryId(incomingHistoryId, storedCursor.historyId) <= 0) {
        // Accept incoming historyId only if newer; otherwise resume from stored cursor.
        startHistoryId = storedCursor.historyId;
      }
    }
    if (!startHistoryId) {
      return json({ error: 'Missing historyId' }, 400);
    }

    // Paginated history.list (cap ~10 pages).
    const allHistory: gmail_v1.Schema$History[] = [];
    let pageToken: string | undefined = undefined;
    for (let page = 0; page < MAX_HISTORY_PAGES; page++) {
      const historyResponse = await gmail.users.history.list({
        userId: 'me',
        startHistoryId,
        pageToken,
      });
      const historyData: gmail_v1.Schema$ListHistoryResponse = historyResponse.data;
      if (historyData.history) {
        allHistory.push(...historyData.history);
      }
      pageToken = historyData.nextPageToken ?? undefined;
      if (!pageToken) break;
    }

    for (const historyItem of allHistory) {
      if (historyItem.messagesAdded) {
        for (const messageAdded of historyItem.messagesAdded) {
          const gmailMessageId = messageAdded.message?.id;
          if (!gmailMessageId) continue;
          // Per-message idempotency: skip if already processed.
          const already = await processedCol.findOne({ _id: gmailMessageId });
          if (already) {
            console.log(`Skipping already-processed message ${gmailMessageId}`);
            continue;
          }
          const emailDetails = await getEmailDetails(gmailMessageId);
          if (emailDetails && emailDetails.body) {
            const { label: classification, confidence, scores } = await classifyEmailWithScores(
              emailDetails.body,
              emailDetails.subject
            );
            console.log(`Email classified as: ${classification}`);
            // Per-mail score log: the only production signal for classifier drift/review.
            console.log(
              `Classification detail: confidence=${confidence.toFixed(3)} scores=${JSON.stringify(scores)}`
            );

            const review = async (reason: string) => {
              // One persistent, resolvable item per Gmail message, including the source
              // and candidate changes. Retries cannot reopen a resolved item.
              await EmailReview.updateOne(
                { orgId, gmailMessageId },
                { $setOnInsert: {
                  orgId, gmailMessageId,
                  senderEmail: emailDetails.senderEmail,
                  subject: emailDetails.subject,
                  body: emailDetails.body.slice(0, 6000),
                  classification, reason,
                  proposedChanges: classification === 'update_order' ? parseOrderChanges(emailDetails.body) : [],
                  status: 'open', createdAt: new Date(),
                } },
                { upsert: true }
              );
              console.log(`Email queued for review: ${reason}`);
            };

            const draft = async (parsed: ReturnType<typeof parseNewOrder> & { ready: false }) => {
              if (await Order.exists({ idempotencyKey: `gmail:${gmailMessageId}` })) return;
              await InboundOrderDraft.updateOne(
                { orgId, gmailMessageId },
                { $setOnInsert: {
                  orgId, gmailMessageId,
                  senderEmail: emailDetails.senderEmail,
                  senderName: emailDetails.senderName || emailDetails.senderEmail,
                  subject: emailDetails.subject,
                  body: emailDetails.body.slice(0, 6000),
                  placedAt: emailDetails.placedAt,
                  products: parsed.products,
                  ...(parsed.date ? { requestedDeliveryDate: parsed.date.value } : {}),
                  ...(parsed.time ? { requestedDeliveryTime: parsed.time.value } : {}),
                  reason: parsed.reason, status: 'draft', createdAt: new Date(),
                } }, { upsert: true }
              );
              console.log(`Email order captured as draft: ${parsed.reason}`);
            };

            if (!emailDetails.senderEmail.includes('@')) {
              await review('Sender email is missing or invalid');
            } else switch (classification) {
              case 'new_order': {
                if (hasExistingOrderChangeLanguage(emailDetails.subject ?? '', emailDetails.body)) {
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
                  if (await Order.exists({ idempotencyKey })) {
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
                    if ((error as { code?: number }).code === 11000 && await Order.exists({ idempotencyKey })) break;
                    throw error;
                  }
                  await applyOrderDelta(newOrder.date, newOrder.products, 1).catch((e) =>
                    console.error('Rollup delta failed:', e)
                  );
                  void ingestDocument(
                    'order',
                    String(newOrder._id),
                    `Email order — ${emailDetails.senderName}`,
                    `${emailDetails.senderName} (${emailDetails.senderEmail}) ordered ${newOrder.products
                      .map((p) => `${p.quantity}x ${p.name}`)
                      .join(', ')} for ${newOrder.date}. Source: inbound email.`
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
                  });
                  await newFeedback.save();
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
                  errorMessage: `Unclassified email from ${emailDetails.senderEmail}`,
                  type: 'Customer',
                  severity: 'low',
                  timestamp: new Date(),
                  orgId,
                });
                await newError.save();
                console.log('Unclassified email logged as error.');
                break;
              }
            }
          }
          await processedCol.updateOne(
            { _id: gmailMessageId },
            { $setOnInsert: { _id: gmailMessageId, at: new Date() } },
            { upsert: true }
          );
        }
      }
    }

    // Update persistent cursor only after success, and only forward.
    if (incomingHistoryId) {
      const current = await cursorCol.findOne({ _id: 'default' });
      if (!current?.historyId || compareHistoryId(incomingHistoryId, current.historyId) > 0) {
        await cursorCol.updateOne(
          { _id: 'default' },
          { $set: { historyId: incomingHistoryId } },
          { upsert: true }
        );
      }
    }
  } catch (e) {
    console.error('Error processing webhook:', e);
    return json({ error: 'Failed to process webhook' }, 500);
  }

  return new Response('ok', { status: 200 });
}
