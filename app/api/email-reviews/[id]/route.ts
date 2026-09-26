import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import { EmailReview } from '@/models/EmailReview';
import { Order } from '@/models/Order';
import { parseOrderChanges } from '@/lib/nlp/email-orders';
import { planOrderChanges } from '@/lib/nlp/order-change-plan';
import { applyOrderDelta } from '@/lib/analytics/rollup';

class ReviewConflict extends Error {}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: 'Invalid review ID' }, { status: 400 });
  let payload: unknown;
  try { payload = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { status, note, orderId } = (payload ?? {}) as { status?: unknown; note?: unknown; orderId?: unknown };
  if (!['resolved', 'dismissed', 'apply'].includes(status as string) || typeof note !== 'string' || !note.trim() || note.length > 1000) {
    return NextResponse.json({ error: 'A resolution status and note (1–1000 characters) are required' }, { status: 400 });
  }
  if (status === 'apply' && (typeof orderId !== 'string' || !mongoose.isValidObjectId(orderId))) {
    return NextResponse.json({ error: 'Choose a valid order ID to apply a change' }, { status: 400 });
  }
  const targetOrderId = status === 'apply' ? new mongoose.Types.ObjectId(orderId as string) : null;
  try {
    await dbConnect();
    if (status === 'apply') {
      // Review and order update commit together. Fail closed on databases without
      // transactions; a partial order/review write is not acceptable here.
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          const review = await EmailReview.findOne({ _id: id, orgId: ctx.orgId ?? 'default', status: 'open' }).session(session);
          if (!review || review.classification !== 'update_order') throw new ReviewConflict('Review is not an open order amendment');
          const order = await Order.findOne({ _id: targetOrderId, orgId: ctx.orgId ?? 'default', status: 'pending fulfillment' }).session(session);
          if (!order || order.email.toLowerCase().trim() !== review.senderEmail.toLowerCase().trim()) {
            throw new ReviewConflict('Order must be pending and belong to the email sender');
          }
          const changes = parseOrderChanges(review.body);
          const planned = planOrderChanges({
            date: order.date, status: order.status,
            products: order.products.map((p) => ({ name: p.name, quantity: p.quantity })),
            pricing: order.pricing?.originalMinor != null ? order.pricing : undefined,
          }, changes);
          if (!planned.ok) throw new ReviewConflict(planned.reason);
          const before = { date: order.date, products: order.products.map((p) => ({ name: p.name, quantity: p.quantity })) };
          const updated = await Order.updateOne(
            { _id: order._id, orgId: ctx.orgId ?? 'default', status: 'pending fulfillment', __v: order.get('__v') as number, date: order.date },
            { $set: { date: planned.date, products: planned.products, status: planned.status }, $inc: { __v: 1 } },
            { session }
          );
          if (updated.modifiedCount !== 1) throw new ReviewConflict('Order changed during review; reload before retrying');
          const resolved = await EmailReview.updateOne(
            { _id: id, orgId: ctx.orgId ?? 'default', status: 'open' },
            { $set: { status: 'resolved', resolutionNote: note.trim(), reviewedBy: ctx.userId,
              reviewedAt: new Date(), appliedOrderId: String(targetOrderId) } },
            { session }
          );
          if (resolved.modifiedCount !== 1) throw new ReviewConflict('Review already handled');
          // Keep analytics and order state in the same transaction. If rollup
          // fails, the order and review remain unchanged for a safe retry.
          await applyOrderDelta(before.date, before.products, -1, session);
          if (planned.status !== 'canceled') await applyOrderDelta(planned.date, planned.products, 1, session);
        });
      } finally { await session.endSession(); }
      return NextResponse.json({ success: true });
    }
    const review = await EmailReview.findOneAndUpdate(
      { _id: id, orgId: ctx.orgId ?? 'default', status: 'open' },
      { $set: { status, resolutionNote: note.trim(), reviewedBy: ctx.userId, reviewedAt: new Date() } },
      { new: true }
    ).lean();
    if (!review) return NextResponse.json({ error: 'Review not found or already handled' }, { status: 409 });
    return NextResponse.json({ review });
  } catch (error) {
    console.error('Failed to resolve email review:', error);
    return error instanceof ReviewConflict
      ? NextResponse.json({ error: error.message }, { status: 409 })
      : NextResponse.json({ error: 'Could not resolve review' }, { status: 500 });
  }
}
