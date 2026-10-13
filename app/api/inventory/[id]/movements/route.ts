import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';
import { AuthorizationError, requirePermission, requireWorkspace } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import { InventoryMovement } from '@/models/InventoryMovement';
import { executeStockCommand } from '@/lib/inventory/commands';
import { StockConflict, type StockMovementKind } from '@/lib/inventory/ledger';
import { resolveIdempotencyKey, IdempotencyError } from '@/lib/orders/idempotency';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireWorkspace();
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 });
    const cursor = request.nextUrl.searchParams.get('before');
    let boundary: { at: Date; id: mongoose.Types.ObjectId } | undefined;
    if (cursor) {
      try {
        if (cursor.length > 256 || !/^[A-Za-z0-9_-]+$/.test(cursor)) throw new Error('Invalid cursor');
        const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
        if (typeof decoded.at !== 'string' || typeof decoded.id !== 'string' ||
          !/^[a-fA-F0-9]{24}$/.test(decoded.id)) throw new Error('Invalid cursor');
        const at = new Date(decoded.at);
        if (!Number.isFinite(at.getTime()) || at.toISOString() !== decoded.at) throw new Error('Invalid cursor');
        boundary = { at, id: new mongoose.Types.ObjectId(decoded.id) };
      } catch {
        return NextResponse.json({ error: 'Invalid cursor' }, { status: 400 });
      }
    }
    await dbConnect();
    const data = await InventoryMovement.find({
      orgId: auth.orgId, productId: id, ...(boundary ? { $or: [
        { at: { $lt: boundary.at } }, { at: boundary.at, _id: { $lt: boundary.id } },
      ] } : {}),
    }).sort({ at: -1, _id: -1 }).limit(51).lean();
    const more = data.length > 50;
    const page = data.slice(0, 50);
    return NextResponse.json({ data: page, nextCursor: more
      ? Buffer.from(JSON.stringify({ at: page[49].at.toISOString(), id: String(page[49]._id) })).toString('base64url') : null },
      { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return failure(error); }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission('inventory:write');
    const { id } = await params;
    const body = await request.json();
    if (!body || !['receipt', 'adjustment', 'reserve', 'release', 'fulfill', 'return'].includes(body.kind) ||
      typeof body.units !== 'number' || typeof body.reason !== 'string' ||
      (body.orderId != null && typeof body.orderId !== 'string')) {
      throw new StockConflict('Invalid stock movement payload', 400);
    }
    if (['reserve', 'release', 'fulfill', 'return'].includes(body.kind)) {
      await requirePermission('orders:write');
    }
    const result = await executeStockCommand({
      orgId: auth.orgId, actorId: auth.userId, productId: id,
      orderId: body.orderId, kind: body.kind as StockMovementKind, units: body.units,
      reason: body.reason, eventKey: resolveIdempotencyKey(request.headers.get('idempotency-key'), body.idempotencyKey),
    });
    return NextResponse.json(result, { status: result.dedup ? 200 : 201 });
  } catch (error) { return failure(error); }
}

function failure(error: unknown) {
  if (error instanceof AuthorizationError || error instanceof StockConflict || error instanceof IdempotencyError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof SyntaxError) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  console.error('Inventory movement request failed', error instanceof Error ? error.name : 'UnknownError');
  return NextResponse.json({ error: 'Stock operation unavailable' }, { status: 503 });
}
