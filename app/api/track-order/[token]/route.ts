import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { hashTrackingToken, toPublicOrderTracking } from '@/lib/order-tracking';
import { rateLimitAsync, rateLimitHeaders } from '@/lib/rate-limit';
import { Order } from '@/models/Order';

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{40,80}$/;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const limited = await rateLimitAsync(request, {
    windowMs: 60_000,
    max: 60,
    keyPrefix: 'public_order_tracking',
  });
  const headers = {
    ...rateLimitHeaders(limited.remaining, 60, limited.retryAfterSec),
    'Cache-Control': 'private, no-store',
  };
  if (!limited.ok) {
    return NextResponse.json(
      { error: 'Too many tracking requests. Retry shortly.' },
      { status: 429, headers }
    );
  }

  const { token } = await params;
  if (!TOKEN_PATTERN.test(token)) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404, headers });
  }

  try {
    await dbConnect();
    const order = await Order.findOne({
      trackingTokenHash: hashTrackingToken(token),
    }).lean();
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404, headers });
    }
    return NextResponse.json(toPublicOrderTracking(order), { headers });
  } catch (error) {
    console.error('Public order tracking failed:', error);
    return NextResponse.json(
      { error: 'Unable to load tracking information' },
      { status: 500, headers }
    );
  }
}
