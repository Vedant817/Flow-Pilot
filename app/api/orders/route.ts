import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Order } from '@/models/Order';
import { applyOrderDelta } from '@/lib/analytics/rollup';
import { ingestDocument } from '@/lib/ai/memory';
import { rateLimit } from '@/lib/rate-limit';

const MAX_PAGE_SIZE = 100;
const ESCAPE_RX = /[.*+?^${}()|[\]\\]/g;

/**
 * Paginated order feed. Filtering and paging happen inside MongoDB
 * (index-backed), so response size is O(pageSize) regardless of how
 * many million orders exist — never a full-collection scan.
 */
export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const sp = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(sp.get('page') ?? '1', 10) || 1);
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(sp.get('limit') ?? '25', 10) || 25));
    const status = sp.get('status');
    const q = sp.get('q')?.trim();
    const since = sp.get('since');

    const filter: Record<string, unknown> = {};
    if (status && ['pending', 'pending fulfillment', 'partially fulfilled', 'fulfilled', 'canceled'].includes(status)) filter.status = status;
    if (since) filter.date = { ...(filter.date as object ?? {}), $gte: since };
    if (q) {
      const rx = new RegExp(q.replace(ESCAPE_RX, '\\$&'), 'i');
      filter.$or = [{ name: rx }, { email: rx }, { phone: rx }];
    }

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort({ date: -1, time: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean({ virtuals: false }),
      Order.countDocuments(filter),
    ]);

    return NextResponse.json(
      {
        data: orders.map((o) => ({ ...o, _id: o._id!.toString() })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error retrieving orders:', error);
    return NextResponse.json({ error: 'Failed to retrieve orders' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { windowMs: 60_000, max: 60 });
  if (!limited.ok) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  try {
    const body = await req.json();
    const { name, phone, email, products, date, time } = body ?? {};

    if (!name || !email || !Array.isArray(products) || products.length === 0) {
      return NextResponse.json(
        { error: 'name, email and at least one product are required' },
        { status: 400 }
      );
    }

    const normalized = products.slice(0, 50).map((p: { name?: unknown; quantity?: unknown }) => ({
      name: String(p.name).slice(0, 120),
      quantity: Math.max(1, Math.min(100_000, Number(p.quantity) || 1)),
    }));

    await dbConnect();

    const created = await Order.create({
      name,
      phone: phone ?? '',
      email,
      products: normalized,
      date: date ?? new Date().toISOString().slice(0, 10),
      time: time ?? new Date().toTimeString().slice(0, 5),
      status: 'pending fulfillment',
      orderLink: '',
    });

    // Maintain analytical rollup + semantic memory (non-blocking failures).
    const orderDate = created.date;
    await applyOrderDelta(orderDate, created.products, 1).catch((e) =>
      console.error('Rollup delta failed:', e)
    );
    void ingestDocument(
      'order',
      String(created._id),
      `Order ${created._id} — ${created.name}`,
      `Customer ${created.name} (${created.email}, ${created.phone}) ordered ${created.products
        .map((p) => `${p.quantity}x ${p.name}`)
        .join(', ')} on ${created.date}. Status pending.`
    ).catch(() => undefined);

    return NextResponse.json({ order: { ...created.toObject(), _id: String(created._id) } }, { status: 201 });
  } catch (error) {
    console.error('Error creating order:', error);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { orderId, status } = await req.json();
    if (!orderId || !status) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }
    if (!['pending', 'pending fulfillment', 'partially fulfilled', 'fulfilled', 'canceled'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    await dbConnect();

    const updatedOrder = await Order.findByIdAndUpdate(orderId, { status }, { new: true });

    if (!updatedOrder) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json({
      message: 'Order status updated successfully',
      order: { ...updatedOrder.toObject(), _id: updatedOrder._id!.toString() },
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    return NextResponse.json({ error: 'Failed to update order status' }, { status: 500 });
  }
}
