import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Coupon } from '@/models/Coupon';
import { AuthorizationError, requirePermission } from '@/lib/auth';

const MAX_PAGE_SIZE = 50;

function mask(email: string): string {
  const [u, d] = email.split('@');
  if (!d) return '***';
  return `${u[0]}***@${d}`;
}

export async function GET(req: NextRequest) {
  try {
    const authCtx = await requirePermission('promotions:write');
    await dbConnect();
    const sp = req.nextUrl.searchParams;
    const email = sp.get('email')?.toLowerCase().trim();
    const status = sp.get('status');
    const code = sp.get('code')?.toUpperCase().trim();
    const page = Math.max(1, parseInt(sp.get('page') ?? '1', 10) || 1);
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(sp.get('limit') ?? '25', 10) || 25));
    let reveal = sp.get('reveal') === '1';
    const isFinance = authCtx.role === 'admin' || authCtx.role === 'finance';
    if (reveal && !isFinance) reveal = false;

    const filter: Record<string, unknown> = { orgId: authCtx.orgId };
    if (email) filter.emailNormalized = email;
    if (status) filter.status = status;
    if (code) filter.code = code;

    const [coupons, total] = await Promise.all([
      Coupon.find(filter).sort({ issuedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Coupon.countDocuments(filter),
    ]);

    const data = coupons.map((c: any) => {
      const masked = !reveal;
      const { emailNormalized: _emailNormalized, ...safeCoupon } = c;
      return {
        ...safeCoupon,
        _id: String(c._id),
        email: masked ? mask(c.email) : c.email,
      };
    });

    return NextResponse.json({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (e) {
    if (e instanceof AuthorizationError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error('GET /api/coupons failed', e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
