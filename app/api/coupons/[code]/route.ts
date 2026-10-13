import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Coupon } from '@/models/Coupon';
import { AuthorizationError, requireWorkspace } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const ctx = await requireWorkspace();
    const { code } = await params;
    const normalized = code.toUpperCase().trim();
    await dbConnect();
    const coupon = await Coupon.findOne({ orgId: ctx.orgId, code: normalized }).lean();
    if (!coupon) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    let reveal = req.nextUrl.searchParams.get('reveal') === '1';
    if (reveal) {
      const sessionEmail = ctx.email?.toLowerCase().trim();
      const couponEmail = String((coupon as any).emailNormalized || (coupon as any).email).toLowerCase().trim();
      const isFinance = ctx.role === 'admin' || ctx.role === 'finance';
      const isOwner = sessionEmail && couponEmail === sessionEmail;
      if (!isFinance && !isOwner) reveal = false;
    }
    const { emailNormalized: _emailNormalized, ...safeCoupon } = coupon as any;
    const email = safeCoupon.email as string;
    const masked = email ? `${email[0]}***@${email.split('@')[1]}` : '***';
    return NextResponse.json({
      coupon: {
        ...safeCoupon,
        _id: String((coupon as any)._id),
        email: reveal ? email : masked,
      },
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('GET /api/coupons/[code] failed', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
