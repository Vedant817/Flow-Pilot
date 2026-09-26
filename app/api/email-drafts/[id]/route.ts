import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { getAuthContext } from '@/lib/auth';
import { InboundOrderDraft } from '@/models/InboundOrderDraft';
import { Order } from '@/models/Order';
import { applyOrderDelta } from '@/lib/analytics/rollup';
import { prepareConfirmedEmailOrder } from '@/lib/nlp/order-placement';

class DraftConflict extends Error {}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: 'Invalid draft ID' }, { status: 400 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const input = body as Record<string, unknown> | null;
  if (!input || !['confirm', 'dismiss'].includes(String(input.action))) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }
  if (input.action === 'confirm' && (
    !Array.isArray(input.products) || input.products.length > 100 ||
    input.products.some((p: unknown) => !p || typeof p !== 'object' ||
      typeof (p as { name?: unknown }).name !== 'string' ||
      (p as { name: string }).name.length > 80 ||
      typeof (p as { quantity?: unknown }).quantity !== 'number') ||
    typeof input.requestedDeliveryDate !== 'string' || typeof input.requestedDeliveryTime !== 'string'
  )) return NextResponse.json({ error: 'Provide valid product lines and delivery fields' }, { status: 400 });
  if (input.action === 'dismiss' && (typeof input.note !== 'string' || !input.note.trim() || input.note.length > 1000)) {
    return NextResponse.json({ error: 'A reason for dismissing is required' }, { status: 400 });
  }
  try {
    await dbConnect();
    if (input.action === 'dismiss') {
      const updated = await InboundOrderDraft.findOneAndUpdate(
        { _id: id, orgId: ctx.orgId ?? 'default', status: 'draft' },
        { $set: { status: 'dismissed', reason: String(input.note).trim(), resolvedBy: ctx.userId, resolvedAt: new Date() } },
        { new: true }
      );
      return updated ? NextResponse.json({ success: true })
        : NextResponse.json({ error: 'Draft not found or already handled' }, { status: 409 });
    }
    const products = (input.products as Array<{ name: string; quantity: number }>);
    const deliveryDate = input.requestedDeliveryDate as string;
    const deliveryTime = input.requestedDeliveryTime as string;
    // Validate and match inside the transaction, using the durable placement time.
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const draft = await InboundOrderDraft.findOne({ _id: id, orgId: ctx.orgId ?? 'default', status: 'draft' }).session(session);
        if (!draft) throw new DraftConflict('Draft not found or already handled');
        const prepared = prepareConfirmedEmailOrder({ products, placedAt: draft.placedAt,
          requestedDeliveryDate: deliveryDate, requestedDeliveryTime: deliveryTime });
        if (!prepared.ok) throw new DraftConflict(prepared.reason);
        const [order] = await Order.create([{
          name: draft.senderName || draft.senderEmail, phone: '', email: draft.senderEmail,
          orgId: ctx.orgId ?? 'default', products: prepared.products,
          date: prepared.date, time: prepared.time, placedAt: prepared.placedAt,
          orderedAt: prepared.placedAt,
          requestedDeliveryDate: prepared.requestedDeliveryDate,
          requestedDeliveryTime: prepared.requestedDeliveryTime,
          status: 'pending fulfillment', orderLink: '',
          idempotencyKey: `gmail:${draft.gmailMessageId}`,
        }], { session });
        await applyOrderDelta(order.date, order.products, 1, session);
        const claimed = await InboundOrderDraft.updateOne(
          { _id: id, orgId: ctx.orgId ?? 'default', status: 'draft' },
          { $set: { status: 'confirmed', confirmedOrderId: String(order._id),
            resolvedBy: ctx.userId, resolvedAt: new Date(),
            products: prepared.products.map((p) => ({ ...p, evidence: 'Verified by reviewer' })),
            requestedDeliveryDate: prepared.requestedDeliveryDate,
            requestedDeliveryTime: prepared.requestedDeliveryTime } },
          { session }
        );
        if (claimed.modifiedCount !== 1) throw new DraftConflict('Draft already handled');
      });
    } finally { await session.endSession(); }
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof DraftConflict) return NextResponse.json({ error: error.message }, { status: 409 });
    console.error('Could not handle inbound order draft:', error);
    return NextResponse.json({ error: 'Could not handle draft' }, { status: 500 });
  }
}
