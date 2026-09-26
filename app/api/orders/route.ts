import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';
import { Order } from '@/models/Order';
import { PromotionScheme } from '@/models/PromotionScheme';
import { Coupon } from '@/models/Coupon';
import { PromotionAudit } from '@/models/PromotionAudit';
import { applyOrderDelta } from '@/lib/analytics/rollup';
import { ingestDocument } from '@/lib/ai/memory';
import { rateLimitAsync } from '@/lib/rate-limit';
import { getAuthContext } from '@/lib/auth';
import { priceOrder, computeDiscount, parseOrderDateToIST } from '@/lib/promotions/pricing';
import { createTrackingToken } from '@/app/api/track-order/[token]/route';
import { refreshCustomerSignalForEmail } from '@/lib/promotions/signals';
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
    const ctx = await getAuthContext();
    if (!ctx.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const orgId = ctx.orgId ?? 'default';

    await dbConnect();

    const sp = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(sp.get('page') ?? '1', 10) || 1);
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(sp.get('limit') ?? '25', 10) || 25));
    const status = sp.get('status');
    const q = sp.get('q')?.trim();
    const since = sp.get('since');

    const filter: Record<string, unknown> = { orgId };
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
    console.error('Error retrieving orders:', error);
    return NextResponse.json({ error: 'Failed to retrieve orders' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const limited = await rateLimitAsync(req, { windowMs: 60_000, max: 60, keyPrefix: 'orders_post' });
  if (!limited.ok) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers: { 'Retry-After': String(limited.retryAfterSec) } as any });
  }

  let idempotencyKey: string | undefined;
  try {
    const body = await req.json();
    const { name, phone, email, products, date, time, couponCode, idempotencyKey: bodyKey } = body ?? {};

    if (!name || !email || !Array.isArray(products) || products.length === 0) {
      return NextResponse.json(
        { error: 'name, email and at least one product are required' },
        { status: 400 }
      );
    }

    // Derive auth email if Clerk session present
    let authEmail: string | undefined;
    let clerkUserId: string | undefined;
    let ctxOrgId: string | undefined;
    try {
      const ctx = await getAuthContext().catch(() => null as any);
      if (ctx?.email) authEmail = ctx.email;
      if (ctx?.userId) clerkUserId = ctx.userId;
      if (ctx?.orgId) ctxOrgId = ctx.orgId;
    } catch {}
    const effectiveEmail = (authEmail && authEmail.includes('@') ? authEmail : email).toString().toLowerCase().trim();
    const emailNormalized = effectiveEmail;
    // orgId is always derived from auth — never trust the client body.
    const orgId = ctxOrgId ?? 'default';
    const headerKey = req.headers.get('idempotency-key') || req.headers.get('x-idempotency-key');
    idempotencyKey = (bodyKey || headerKey || undefined) as string | undefined;

    // pricing snapshot before txn (cached inventory map)
    const { orderValueMinor, priceSource, productsWithSnapshot } = await priceOrder(products).catch(() => ({
      orderValueMinor: products.reduce((s: number, p: any) => s + (Number(p.quantity) || 1) * 5000, 0),
      priceSource: 'estimated' as const,
      productsWithSnapshot: products.slice(0, 50).map((p: any) => ({
        name: String(p.name).slice(0, 120),
        quantity: Math.max(1, Math.min(100_000, Number(p.quantity) || 1)),
        unitPrice: 50,
        lineValueMinor: Math.round(50 * 100 * (Number(p.quantity) || 1)),
        nameKey: String(p.name).toLowerCase().trim(),
      })),
    }));

    const normalizedCouponCode = couponCode ? String(couponCode).toUpperCase().trim() : undefined;

    await dbConnect();

    // Idempotency: if key provided, return existing if found
    if (idempotencyKey) {
      const existing = await Order.findOne({ idempotencyKey }).lean();
      if (existing) {
        const existingId = String((existing as any)._id);
        return NextResponse.json(
          { order: { ...existing, _id: existingId }, dedup: true, trackingToken: createTrackingToken(existingId) },
          { status: 200 }
        );
      }
    }

    const orderedAtDate = date && time ? parseOrderDateToIST(date, time) : new Date();
    const dateStr = orderedAtDate.toISOString().slice(0, 10);
    const timeStr = orderedAtDate.toTimeString().slice(0, 5);

    // Attempt transactional path
    let createdOrder: any = null;

    const doCreate = async (session?: mongoose.ClientSession) => {
      let discountMinor = 0;
      let appliedCoupon: any = undefined;
      let couponDoc: any = null;
      let schemeDoc: any = null;

      if (normalizedCouponCode) {
        const now = new Date();
        // Find and redeem coupon atomically (status issued + expiresAt > now + email match)
        const couponQuery: any = { code: normalizedCouponCode, status: 'issued', expiresAt: { $gt: now } };
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
          const exists = await (Coupon as any).findOne({ code: normalizedCouponCode }).lean();
          if (!exists) throw Object.assign(new Error('Invalid coupon'), { status: 400 });
          if (exists.status !== 'issued') throw Object.assign(new Error(`Coupon is ${exists.status}`), { status: 409 });
          if (new Date(exists.expiresAt) < now) throw Object.assign(new Error('Coupon expired'), { status: 409 });
          if (exists.emailNormalized !== emailNormalized) throw Object.assign(new Error('Coupon email mismatch'), { status: 403 });
          throw Object.assign(new Error('Coupon not redeemable'), { status: 409 });
        }
        if (couponDoc.clerkUserId && clerkUserId && couponDoc.clerkUserId !== clerkUserId) {
          // revert coupon status
          await (Coupon as any).findByIdAndUpdate(couponDoc._id, { status: 'issued', $unset: { redeemedAt: 1 } });
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
          await (Coupon as any).findByIdAndUpdate(couponDoc._id, { status: 'issued', $unset: { redeemedAt: 1 } });
          throw Object.assign(new Error('Scheme not active or window violated'), { status: 409 });
        }
        // global cap check
        if (schemeDoc.limits?.maxRedemptionsGlobal != null && (schemeDoc.counters?.redeemed ?? 0) >= schemeDoc.limits.maxRedemptionsGlobal) {
          await (Coupon as any).findByIdAndUpdate(couponDoc._id, { status: 'issued', $unset: { redeemedAt: 1 } });
          throw Object.assign(new Error('Global redemption cap reached'), { status: 409 });
        }
        if (schemeDoc.minimumOrderValueMinor && orderValueMinor < schemeDoc.minimumOrderValueMinor) {
          await (Coupon as any).findByIdAndUpdate(couponDoc._id, { status: 'issued', $unset: { redeemedAt: 1 } });
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
          await (Coupon as any).findByIdAndUpdate(couponDoc._id, { status: 'issued', $unset: { redeemedAt: 1 } });
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
            { _id: schemeDoc._id, 'counters.redeemed': { $lt: schemeDoc.limits.maxRedemptionsGlobal } },
            { $inc: { 'counters.redeemed': 1 } },
            session ? { session, new: true } : { new: true }
          );
          if (!updated) {
            await (Coupon as any).findByIdAndUpdate(couponDoc._id, { status: 'issued', $unset: { redeemedAt: 1 } });
            throw Object.assign(new Error('Global cap raced'), { status: 409 });
          }
          schemeDoc = updated;
        } else {
          await PromotionScheme.updateOne({ _id: schemeDoc._id }, { $inc: { 'counters.redeemed': 1 } }, session ? { session } as any : undefined);
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
            .lean();

          if (candidates.length) {
            // fetch customer signal for matching
            const signal = await db2.collection('customer_signals').findOne({ orgId, emailNormalized });
            // If no signal, skip auto
            if (signal) {
              for (const cand of candidates as any[]) {
                // holdout check: if this customer is holdout for this scheme, skip
                const holdoutExists = await (Coupon as any).findOne({ orgId, emailNormalized, schemeId: cand._id, status: 'holdout' }).lean();
                if (holdoutExists) continue;
                // per-customer cap check
                const existingCount = await (Coupon as any).countDocuments({ orgId, emailNormalized, schemeId: cand._id, status: { $in: ['issued', 'redeemed', 'holdout'] } });
                if (existingCount >= (cand.limits?.maxRedemptionsPerCustomer ?? 1)) continue;
                // cap check
                if (cand.limits?.maxRedemptionsGlobal != null && (cand.counters?.redeemed ?? 0) >= cand.limits.maxRedemptionsGlobal) continue;
                if (cand.minimumOrderValueMinor && orderValueMinor < cand.minimumOrderValueMinor) continue;
                // matchesSignals check
                const tol = cand.eligibility?.cadence?.toleranceMultiplier;
                if (!matchesSignals(signal as any, cand.eligibility, { toleranceOverride: tol })) continue;

                // claim global cap
                let claimed = true;
                if (cand.limits?.maxRedemptionsGlobal != null) {
                  const updated = await PromotionScheme.findOneAndUpdate(
                    { _id: cand._id, 'counters.redeemed': { $lt: cand.limits.maxRedemptionsGlobal } },
                    { $inc: { 'counters.redeemed': 1 } },
                    session ? { session, new: true } : { new: true }
                  );
                  if (!updated) claimed = false;
                } else {
                  await PromotionScheme.updateOne({ _id: cand._id }, { $inc: { 'counters.redeemed': 1 } }, session ? { session } as any : undefined);
                }
                if (!claimed) continue;

                const disc = computeDiscount(
                  {
                    benefitType: cand.benefitType,
                    benefitValueMinor: cand.benefitValueMinor,
                    maxDiscountMinor: cand.maxDiscountMinor,
                    setupFeeMinor: cand.setupFeeMinor,
                    minimumOrderValueMinor: cand.minimumOrderValueMinor,
                  },
                  orderValueMinor
                );
                if (disc <= 0) continue;
                discountMinor = Math.min(disc, orderValueMinor);
                appliedCoupon = { code: `AUTO:${cand.code}`, schemeId: cand._id, benefitType: cand.benefitType, discountMinor };
                schemeDoc = cand;
                break;
              }
            }
          }
        } catch (e) {
          console.warn('auto apply failed', e);
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
        name,
        phone: phone ?? '',
        email: effectiveEmail,
        emailNormalized,
        orgId,
        date: dateStr,
        time: timeStr,
        orderedAt: orderedAtDate,
        products: productsWithSnapshot.map((p) => ({ name: p.name, quantity: p.quantity, unitPrice: p.unitPrice, lineValueMinor: p.lineValueMinor, nameKey: p.nameKey })),
        status: 'pending fulfillment',
        orderLink: '',
        pricing,
        appliedCoupon,
        idempotencyKey: idempotencyKey || undefined,
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
          await (Coupon as any).updateOne({ _id: couponDoc._id }, { $set: { redeemedOrderId: created._id } }, { session } as any);
        } else {
          await (Coupon as any).updateOne({ _id: couponDoc._id }, { $set: { redeemedOrderId: created._id } });
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

      return created;
    };

    // Try transactional, fallback to non-transactional if replica set missing
    let session: mongoose.ClientSession | null = null;
    try {
      session = await mongoose.startSession();
      let result: any;
      await session.withTransaction(async () => {
        result = await doCreate(session!);
      });
      createdOrder = result;
    } catch (txnErr: any) {
      const msg = txnErr?.message || '';
      if (
        msg.includes('Transaction numbers are only allowed on a replica set') ||
        msg.includes('not a replica set') ||
        msg.includes('Sessions not supported') ||
        msg.includes('code 20')
      ) {
        console.warn('Transaction fallback to non-txn create (no replica set)');
        createdOrder = await doCreate(undefined);
      } else if (txnErr?.status || txnErr?.code === 11000) {
        // known business error (coupon mismatch, etc.) — propagate directly
        throw txnErr;
      } else {
        console.warn('Transaction failed, fallback', msg);
        try {
          createdOrder = await doCreate(undefined);
        } catch (fallbackErr) {
          throw fallbackErr;
        }
      }
    } finally {
      if (session) await session.endSession().catch(() => {});
    }

    // Non-blocking post-create: rollup + signals + memory
    const orderDate = (createdOrder as any).date;
    await applyOrderDelta(orderDate, (createdOrder as any).products, 1).catch((e) => console.error('Rollup delta failed:', e));
    // refresh customer signals for this email (bounded)
    refreshCustomerSignalForEmail(emailNormalized, orgId).catch((e) => console.warn('signal refresh failed', e));
    void ingestDocument(
      'order',
      String((createdOrder as any)._id),
      `Order ${(createdOrder as any)._id} — ${(createdOrder as any).name}`,
      `Customer ${(createdOrder as any).name} (${(createdOrder as any).email}, ${(createdOrder as any).phone}) ordered ${(createdOrder as any).products
        .map((p: any) => `${p.quantity}x ${p.name}`)
        .join(', ')} on ${(createdOrder as any).date}. Status pending.`
    ).catch(() => undefined);

    const createdId = String((createdOrder as any)._id);
    return NextResponse.json(
      {
        order: { ...(createdOrder as any).toObject(), _id: createdId },
        trackingToken: createTrackingToken(createdId),
      },
      { status: 201 }
    );
  } catch (error: any) {
    // Idempotency duplicate key — return existing order as 200 dedup
    if (error?.code === 11000 && idempotencyKey) {
      try {
        await dbConnect();
        const existing = await Order.findOne({ idempotencyKey }).lean();
        if (existing) {
          const existingId = String((existing as any)._id);
          return NextResponse.json(
            { order: { ...existing, _id: existingId }, dedup: true, trackingToken: createTrackingToken(existingId) },
            { status: 200 }
          );
        }
      } catch {}
    }
    // Transaction/session error string broadening
    const msg = error?.message || '';
    if (msg.includes('Transaction numbers') || msg.includes('not a replica set') || msg.includes('Sessions not supported') || msg.includes('code 20')) {
      console.warn('Transaction not supported, request failed post-fallback', msg);
    }
    console.error('Error creating order:', error);
    const status = error?.status || 500;
    return NextResponse.json({ error: error?.message || 'Failed to create order' }, { status });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const ctx = await getAuthContext();
    if (!ctx.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const orgId = ctx.orgId ?? 'default';

    const { orderId, status } = await req.json();
    if (!orderId || !status) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }
    if (!['pending', 'pending fulfillment', 'partially fulfilled', 'fulfilled', 'canceled'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }
    // Whitelist: only `status` may change via this endpoint.
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return NextResponse.json({ error: 'Invalid orderId' }, { status: 400 });
    }

    await dbConnect();

    const updatedOrder = await Order.findOneAndUpdate({ _id: orderId, orgId }, { status }, { new: true });

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
