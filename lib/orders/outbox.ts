import { randomUUID } from 'crypto';
import { Order } from '@/models/Order';
import { OutboxEvent } from '@/models/OutboxEvent';
import { applyOrderDeltaOnce } from '@/lib/analytics/rollup';
import { ingestDocument } from '@/lib/ai/memory';
import { refreshCustomerSignalForEmail } from '@/lib/promotions/signals';

const LEASE_MS = 60_000;
const MAX_ATTEMPTS = 10;

function retryDelayMs(attempts: number): number {
  return Math.min(15 * 60_000, 1_000 * 2 ** Math.min(attempts, 9));
}

async function processOrderCreated(
  eventId: string,
  orgId: string,
  aggregateId: string
): Promise<void> {
  const order = await Order.findOne({ _id: aggregateId, orgId }).lean();
  if (!order) {
    throw new Error('Outbox aggregate no longer exists');
  }

  await applyOrderDeltaOnce(
    eventId,
    orgId,
    order.date,
    order.products,
    1
  );
  await refreshCustomerSignalForEmail(
    order.emailNormalized ?? order.email.toLowerCase().trim(),
    orgId
  );
  await ingestDocument(
    'order',
    String(order._id),
    `Order ${order._id}`,
    `Order ${order._id} contains ${order.products
      .map((product) => `${product.quantity}x ${product.name}`)
      .join(', ')} on ${order.date}. Status ${order.status}.`,
    { orgId }
  );
}

export async function processNextOutboxEvent(
  orgId: string
): Promise<'processed' | 'failed' | 'empty'> {
  const now = new Date();
  const leaseOwner = randomUUID();
  const event = await OutboxEvent.findOneAndUpdate(
    {
      orgId,
      status: { $in: ['pending', 'processing'] },
      availableAt: { $lte: now },
      $or: [
        { lockedUntil: { $exists: false } },
        { lockedUntil: { $lte: now } },
      ],
    },
    {
      $set: {
        status: 'processing',
        lockedUntil: new Date(now.getTime() + LEASE_MS),
        leaseOwner,
      },
      $inc: { attempts: 1 },
    },
    { new: true, sort: { createdAt: 1 } }
  );

  if (!event) return 'empty';

  try {
    if (event.type === 'order.created') {
      await processOrderCreated(
        String(event._id),
        event.orgId,
        event.aggregateId
      );
    }
    await OutboxEvent.updateOne(
      { _id: event._id, orgId, leaseOwner },
      {
        $set: {
          status: 'completed',
          processedAt: new Date(),
        },
        $unset: { lockedUntil: 1, leaseOwner: 1, lastError: 1 },
      }
    );
    return 'processed';
  } catch (error: unknown) {
    const terminal = event.attempts >= MAX_ATTEMPTS;
    await OutboxEvent.updateOne(
      { _id: event._id, orgId, leaseOwner },
      {
        $set: {
          status: terminal ? 'failed' : 'pending',
          availableAt: new Date(Date.now() + retryDelayMs(event.attempts)),
          lastError: String(
            error instanceof Error ? error.message : error
          ).slice(0, 500),
        },
        $unset: { lockedUntil: 1, leaseOwner: 1 },
      }
    );
    return 'failed';
  }
}

export async function drainOutbox(
  orgId: string,
  limit = 25
): Promise<{ processed: number; failed: number }> {
  const boundedLimit = Math.max(1, Math.min(100, limit));
  let processed = 0;
  let failed = 0;

  for (let index = 0; index < boundedLimit; index += 1) {
    const result = await processNextOutboxEvent(orgId);
    if (result === 'empty') break;
    if (result === 'processed') processed += 1;
    if (result === 'failed') failed += 1;
  }
  return { processed, failed };
}
