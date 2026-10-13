import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';
import { AuthorizationError, requireWorkspace } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import { Order } from '@/models/Order';
import { OrderEvent } from '@/models/OrderEvent';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireWorkspace();
    const { id } = await context.params;
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 });
    }
    await dbConnect();
    if (!(await Order.exists({ _id: id, orgId: auth.orgId }))) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    const events = await OrderEvent.find({ orgId: auth.orgId, orderId: id })
      .sort({ at: 1, _id: 1 })
      .limit(100)
      .lean();
    return NextResponse.json(
      { data: events },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Failed to load order timeline' }, { status: 500 });
  }
}
