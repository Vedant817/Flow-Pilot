import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';
import { Order, type IOrder } from '@/models/Order';
import { PromotionScheme } from '@/models/PromotionScheme';
import { Coupon } from '@/models/Coupon';
import { PromotionAudit } from '@/models/PromotionAudit';
import { OutboxEvent } from '@/models/OutboxEvent';
import { OrderEvent } from '@/models/OrderEvent';
import { assertOrderTransition, OrderTransitionError } from '@/lib/orders/lifecycle';
import { businessDateTime } from '@/lib/orders/time';
import { rateLimitAsync } from '@/lib/rate-limit';
import { AuthorizationError, requirePermission, requireWorkspace } from '@/lib/auth';
import { addWorkspaceScope } from '@/lib/authorization';
import { createTrackingCredential } from '@/lib/order-tracking';
import {
  hashOrderRequest,
  resolveIdempotencyKey,
} from '@/lib/orders/idempotency';
import { priceOrder, computeDiscount, parseOrderDateToIST } from '@/lib/promotions/pricing';
import { matchesSignals } from '@/lib/promotions/engine';

const MAX_PAGE_SIZE = 100;
const ESCAPE_RX = /[.*+?^${}()|[\]\\]/g;

/**
 * Paginated order feed. Filtering and paging happen inside MongoDB
 * (index-backed), so response size is O(pageSize) regardless of how
 * many million orders exist — never a full-collection scan.
 */
export async function GET(request: NextRequest) {
  try {
    const authCtx = await requireWorkspace();
    await dbConnect();

    const sp = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(sp.get('page') ?? '1', 10) || 1);
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(sp.get('limit') ?? '25', 10) || 25));
    const status = sp.get('status');
    const q = sp.get('q')?.trim();
    const since = sp.get('since');

    const filter: Record<string, unknown> = { orgId: authCtx.orgId };
    if (status && ['pending', 'pending fulfillment', 'partially fulfilled', 'fulfilled', 'canceled'].includes(status)) filter.status = status;
    if (since) filter.date = { ...(filter.date as object ?? {}), $gte: since };
    if (q) {
      const capped = q.slice(0, 100);
      const rx = new RegExp(capped.replace(ESCAPE_RX, '\\$&'), 'i');
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
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error retrieving orders:', error);
    return NextResponse.json({ error: 'Failed to retrieve orders' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let authCtx: Awaited<ReturnType<typeof requirePermission>>;
  try {
    authCtx = await requirePermission('orders:write');
  } catch (error) {
    const status = error instanceof AuthorizationError ? error.status : 401;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unauthorized' }, { status });
  }
  const limited = await rateLimitAsync(req, { windowMs: 60_000, max: 60, keyPrefix: 'orders_post' });
  if (!limited.ok) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers: { 'Retry-After': String(limited.retryAfterSec) } as any });
  }

  let idempotencyKey: string | undefined;
  let requestHash: string | undefined;
  try {
    const body = await req.json();
    const { name, phone, email, products, date, time, couponCode, idempotencyKey: bodyKey } = body ?? {};

    if (
      typeof name !== 'string' || !name.trim() || name.length > 120 ||
      typeof email !== 'string' || email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
      (phone != null && (typeof phone !== 'string' || phone.length > 40)) ||
      !Array.isArray(products) || products.length === 0 ||
      (date != null && (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date))) ||
      (time != null && (typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) ||
      Boolean(date) !== Boolean(time)
    ) {
      return NextResponse.json(
        { error: 'Invalid order fields; name, email and at least one product are required, with date and time supplied together' },
        { status: 400 }
      );
    }

    const clerkUserId = authCtx.userId;
    const effectiveEmail = email.toString().toLowerCase().trim();
    const emailNormalized = effectiveEmail;
    const orgId = authCtx.orgId;
    const headerKey = req.headers.get('idempotency-key') || req.headers.get('x-idempotency-key');
    idempotencyKey = resolveIdempotencyKey(headerKey, bodyKey);
    requestHash = hashOrderRequest({
      name,
      phone,
      email,
      products,
      date,
      time,
      couponCode,
    });

    const normalizedCouponCode = couponCode ? String(couponCode).toUpperCase().trim() : undefined;

    await dbConnect();

    const existing = await Order.findOne({ orgId, idempotencyKey }).select('+requestHash').lean();
    if (existing) {
      if ((existing as any).requestHash !== requestHash) {
        return NextResponse.json(
          { error: 'Idempotency-Key was already used for a different order' },
          { status: 409 }
        );
      }
      return NextResponse.json({ order: { ...existing, _id: String((existing as any)._id) }, dedup: true }, { status: 200 });
    }

    const { orderValueMinor, priceSource, productsWithSnapshot } = await priceOrder(orgId, products);
    const tracking = createTrackingCredential();
    const orderedAtDate = date && time ? parseOrderDateToIST(date, time) : new Date();
    const { date: dateStr, time: timeStr } = businessDateTime(orderedAtDate);

    // Attempt transactional path
    let createdOrder: any = null;

    const doCreate = async (session: mongoose.ClientSession) => {
      let discountMinor = 0;
      let appliedCoupon: any = undefined;
      let couponDoc: any = null;
      let schemeDoc: any = null;
      const restoreCoupon = async () => {
        if (!couponDoc) return;
        await (Coupon as any).updateOne(
          { _id: couponDoc._id, orgId },
          { $set: { status: 'issued' }, $unset: { redeemedAt: 1 } },
          session ? { session } : undefined
        );
      };

      if (normalizedCouponCode) {
        const now = new Date();
        // Find and redeem coupon atomically (status issued + expiresAt > now + email match)
        const couponQuery: any = { orgId, code: normalizedCouponCode, status: 'issued', expiresAt: { $gt: now } };
        if (emailNormalized) couponQuery.emailNormalized = emailNormalized;
        // Use session if provided
        const couponOpts: any = session ? { session, new: true } : { new: true };
        // We need findOneAndUpdate with filter including emailNormalized if present, else just code
        // To handle clerkUserId binding, we also check after
        couponDoc = await (Coupon as any).findOneAndUpdate(
          couponQuery,
          { $set: { status: 'redeemed', redeemedAt: now } },
          couponOpts
        );
        if (!couponDoc) {
          const exists = await (Coupon as any).findOne({ orgId, code: normalizedCouponCode }).lean();
          if (!exists) throw Object.assign(new Error('Invalid coupon'), { status: 400 });
          if (exists.status !== 'issued') throw Object.assign(new Error(`Coupon is ${exists.status}`), { status: 409 });
          if (new Date(exists.expiresAt) < now) throw Object.assign(new Error('Coupon expired'), { status: 409 });
          if (exists.emailNormalized !== emailNormalized) throw Object.assign(new Error('Coupon email mismatch'), { status: 403 });
          throw Object.assign(new Error('Coupon not redeemable'), { status: 409 });
        }
        if (couponDoc.clerkUserId && clerkUserId && couponDoc.clerkUserId !== clerkUserId) {
          // revert coupon status
          await restoreCoupon();
          throw Object.assign(new Error('Coupon owner mismatch'), { status: 403 });
        }

        schemeDoc = await PromotionScheme.findOne({
          _id: couponDoc.schemeId,
          orgId,
          status: 'active',
          'limits.validFrom': { $lte: now },
          'limits.validUntil': { $gte: now },
        }).session(session || null as any);

        if (!schemeDoc) {
          await restoreCoupon();
          throw Object.assign(new Error('Scheme not active or window violated'), { status: 409 });
        }
        // global cap check
        if (schemeDoc.limits?.maxRedemptionsGlobal != null && (schemeDoc.counters?.redeemed ?? 0) >= schemeDoc.limits.maxRedemptionsGlobal) {
          await restoreCoupon();
          throw Object.assign(new Error('Global redemption cap reached'), { status: 409 });
        }
        if (schemeDoc.minimumOrderValueMinor && orderValueMinor < schemeDoc.minimumOrderValueMinor) {
          await restoreCoupon();
          throw Object.assign(new Error(`Minimum order value ₹${schemeDoc.minimumOrderValueMinor / 100} required`), { status: 400 });
        }

        // compute discount
        discountMinor = computeDiscount(
          {
            benefitType: schemeDoc.benefitType,
            benefitValueMinor: schemeDoc.benefitValueMinor,
            maxDiscountMinor: schemeDoc.maxDiscountMinor,
            setupFeeMinor: schemeDoc.setupFeeMinor,
            minimumOrderValueMinor: schemeDoc.minimumOrderValueMinor,
          },
          orderValueMinor
        );
        if (schemeDoc.benefitType === 'free_setup' && discountMinor === 0) {
          await restoreCoupon();
          throw Object.assign(new Error('Setup fee required for free_setup coupon'), { status: 400 });
        }
        discountMinor = Math.min(discountMinor, orderValueMinor);
        appliedCoupon = { code: couponDoc.code, schemeId: couponDoc.schemeId, benefitType: schemeDoc.benefitType, discountMinor };

        // increment redeemed counter atomically (within same session if available)
        const capQuery: any = { _id: schemeDoc._id };
        if (schemeDoc.limits?.maxRedemptionsGlobal != null) {
          capQuery.$expr = { $lt: ['$counters.redeemed', schemeDoc.limits.maxRedemptionsGlobal] };
          // For non-aggregate findOneAndUpdate, we use counters.redeemed check via $where-like but we already checked; we do inc with conditional
          // Use updateOne with $inc and later verify, or use findOneAndUpdate with counters.redeemed filter
          // Simplify: try inc if not exceeded
          const updated = await PromotionScheme.findOneAndUpdate(
            { _id: schemeDoc._id, orgId, 'counters.redeemed': { $lt: schemeDoc.limits.maxRedemptionsGlobal } },
            { $inc: { 'counters.redeemed': 1 } },
            session ? { session, new: true } : { new: true }
          );
          if (!updated) {
            await restoreCoupon();
            throw Object.assign(new Error('Global cap raced'), { status: 409 });
          }
          schemeDoc = updated;
        } else {
          await PromotionScheme.updateOne(
            { _id: schemeDoc._id, orgId },
            { $inc: { 'counters.redeemed': 1 } },
            session ? { session } as any : undefined
          );
        }
      } else {
        // Auto mode: try to apply highest priority active auto/both scheme matching signals
        try {
          const conn2 = await dbConnect();
          const db2 = conn2.connection.db!;
          const now = new Date();
          const candidates = await PromotionScheme.find({
            orgId,
            status: 'active',
            mode: { $in: ['auto', 'both'] },
            'limits.validFrom': { $lte: now },
            'limits.validUntil': { $gte: now },
          })
            .sort({ priority: -1, 'limits.validFrom': 1, code: 1 })
            .limit(10)
            .session(session)
            .lean();

          if (candidates.length) {
            // fetch customer signal for matching
            const signal = await db2.collection('customer_signals').findOne({ orgId, emailNormalized }, { session });
            // If no signal, skip auto
            if (signal) {
              for (const cand of candidates as any[]) {
                // holdout check: if this customer is holdout for this scheme, skip
                const holdoutExists = await (Coupon as any).findOne({ orgId, emailNormalized, schemeId: cand._id, status: 'holdout' }).session(session).lean();
                if (holdoutExists) continue;
                // per-customer cap check
                const existingCount = await (Coupon as any).countDocuments({ orgId, emailNormalized, schemeId: cand._id, status: { $in: ['issued', 'redeemed', 'holdout'] } }).session(session);
                if (existingCount >= (cand.limits?.maxRedemptionsPerCustomer ?? 1)) continue;
                // cap check
                if (cand.limits?.maxRedemptionsGlobal != null && (cand.counters?.redeemed ?? 0) >= cand.limits.maxRedemptionsGlobal) continue;
                if (cand.minimumOrderValueMinor && orderValueMinor < cand.minimumOrderValueMinor) continue;
                // matchesSignals check
                const tol = cand.eligibility?.cadence?.toleranceMultiplier;
                if (!matchesSignals(signal as any, cand.eligibility, { toleranceOverride: tol })) continue;

                const disc = computeDiscount(cand, orderValueMinor);
                if (disc <= 0) continue;

                // Claim global cap only after confirming a nonzero benefit.
                let claimed = true;
                if (cand.limits?.maxRedemptionsGlobal != null) {
                  const updated = await PromotionScheme.findOneAndUpdate(
                    { _id: cand._id, orgId, 'counters.redeemed': { $lt: cand.limits.maxRedemptionsGlobal } },
                    { $inc: { 'counters.redeemed': 1 } },
                    session ? { session, new: true } : { new: true }
                  );
                  if (!updated) claimed = false;
                } else {
                  await PromotionScheme.updateOne(
                    { _id: cand._id, orgId },
                    { $inc: { 'counters.redeemed': 1 } },
                    session ? { session } as any : undefined
                  );
                }
                if (!claimed) continue;

                discountMinor = Math.min(disc, orderValueMinor);
                appliedCoupon = { code: `AUTO:${cand.code}`, schemeId: cand._id, benefitType: cand.benefitType, discountMinor };
                schemeDoc = cand;
                break;
              }
            }
          }
        } catch (e) {
          // Never hide a transactional failure after mutating scheme counters.
          throw e;
        }
      }

      const pricing = {
        originalMinor: orderValueMinor,
        discountMinor,
        finalMinor: Math.max(0, orderValueMinor - discountMinor),
        currency: 'INR',
        priceSource,
      } as any;

      const orderDoc = {
        name: name.trim(),
        phone: phone?.trim() ?? '',
        email: effectiveEmail,
        emailNormalized,
        orgId,
        date: dateStr,
        time: timeStr,
        orderedAt: orderedAtDate,
        products: productsWithSnapshot,
        status: 'pending fulfillment',
        orderLink: '',
        pricing,
        appliedCoupon,
        idempotencyKey,
        requestHash,
        trackingTokenHash: tracking.tokenHash,
      };

      let created: any;
      if (session) {
        const arr = await Order.create([orderDoc], { session } as any);
        created = arr[0];
      } else {
        created = await Order.create(orderDoc);
      }

      if (couponDoc) {
        // set redeemedOrderId
        if (session) {
          await (Coupon as any).updateOne(
            { _id: couponDoc._id, orgId },
            { $set: { redeemedOrderId: created._id } },
            { session } as any
          );
        } else {
          await (Coupon as any).updateOne(
            { _id: couponDoc._id, orgId },
            { $set: { redeemedOrderId: created._id } }
          );
        }
      }

      // audit redeem if coupon used
      if (couponDoc && schemeDoc) {
        const audit = {
          orgId,
          schemeId: schemeDoc._id,
          couponId: couponDoc._id,
          actorClerkId: clerkUserId || 'system',
          actorEmail: effectiveEmail,
          action: 'redeem' as const,
          at: new Date(),
          after: { orderId: created._id, discountMinor },
        };
        if (session) await PromotionAudit.create([audit], { session } as any);
        else await PromotionAudit.create(audit);
      }

      if (!session) {
        throw Object.assign(
          new Error('Transactional order creation is required'),
          { status: 503 }
        );
      }
      await OutboxEvent.create(
        [
          {
            orgId,
            type: 'order.created',
            aggregateId: String(created._id),
            eventKey: `order.created:${created._id}`,
          },
        ],
        { session }
      );
      await OrderEvent.create(
        [{
          orgId,
          orderId: String(created._id),
          actorId: authCtx.userId,
          type: 'created',
          toStatus: 'pending fulfillment',
        }],
        { session }
      );

      return created;
    };

    // Order, coupon redemption, audit, and outbox event commit atomically.
    let session: mongoose.ClientSession | null = null;
    try {
      session = await mongoose.startSession();
      let result: any;
      await session.withTransaction(async () => {
        result = await doCreate(session!);
      });
      createdOrder = result;
    } catch (txnErr: any) {
      throw txnErr;
    } finally {
      if (session) await session.endSession().catch(() => {});
    }

    return NextResponse.json({
      order: { ...(createdOrder as any).toObject(), _id: String((createdOrder as any)._id) },
      trackingToken: tracking.token,
      trackingUrl: `/track-order/${tracking.token}`,
    }, { status: 201 });
  } catch (error: any) {
    // A concurrent request may win the unique-key race.
    if (error?.code === 11000 && idempotencyKey) {
      try {
        await dbConnect();
        const existing = await Order.findOne(addWorkspaceScope(authCtx.orgId, { idempotencyKey })).select('+requestHash').lean();
        if (existing) {
          if ((existing as any).requestHash !== requestHash) {
            return NextResponse.json(
              { error: 'Idempotency-Key was already used for a different order' },
              { status: 409 }
            );
          }
          return NextResponse.json({ order: { ...existing, _id: String((existing as any)._id) }, dedup: true }, { status: 200 });
        }
      } catch {}
    }
    const msg = error?.message || '';
    if (msg.includes('Transaction numbers') || msg.includes('not a replica set') || msg.includes('Sessions not supported') || msg.includes('code 20')) {
      console.error('MongoDB transactions are required for order creation', msg);
      return NextResponse.json(
        { error: 'Order creation is temporarily unavailable' },
        { status: 503 }
      );
    }
    console.error('Error creating order:', error);
    const status = error?.status || 500;
    return NextResponse.json({ error: error?.message || 'Failed to create order' }, { status });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const authCtx = await requirePermission('orders:write');
    const { orderId, status, expectedStatus, reason } = await req.json();
    if (
      typeof orderId !== 'string' || !mongoose.isValidObjectId(orderId) ||
      typeof status !== 'string' || typeof expectedStatus !== 'string' ||
      (reason != null && typeof reason !== 'string')
    ) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }
    assertOrderTransition(expectedStatus, status, reason);

    await dbConnect();
    const session = await mongoose.startSession();
    const result: { order: mongoose.HydratedDocument<IOrder> | null } = { order: null };
    try {
      await session.withTransaction(async () => {
        result.order = await Order.findOneAndUpdate(
          { _id: orderId, orgId: authCtx.orgId, status: expectedStatus },
          { $set: { status }, $inc: { __v: 1 } },
          { new: true, session, runValidators: true }
        );
        if (!result.order) {
          const exists = await Order.exists({ _id: orderId, orgId: authCtx.orgId }).session(session);
          throw new OrderTransitionError(
            exists ? 'Order changed since you loaded it; refresh before retrying' : 'Order not found',
            exists ? 409 : 404
          );
        }
        await OrderEvent.create(
          [{
            orgId: authCtx.orgId,
            orderId,
            actorId: authCtx.userId,
            type: 'status.changed',
            fromStatus: expectedStatus,
            toStatus: status,
            reason: reason?.trim(),
          }],
          { session }
        );
      });
    } finally {
      await session.endSession();
    }
    if (!result.order) throw new Error('Order transition did not commit');

    return NextResponse.json({
      message: 'Order status updated successfully',
      order: { ...result.order.toObject(), _id: result.order._id!.toString() },
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof OrderTransitionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error updating order status:', error);
    return NextResponse.json({ error: 'Failed to update order status' }, { status: 500 });
  }
}
