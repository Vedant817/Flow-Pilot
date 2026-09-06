import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Coupon } from '@/models/Coupon';
import { getAuthContext } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const normalized = code.toUpperCase().trim();
  await dbConnect();
  const coupon = await Coupon.findOne({ code: normalized }).lean();
  if (!coupon) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  let reveal = req.nextUrl.searchParams.get('reveal') === '1';
  if (reveal) {
    try {
      const ctx = await getAuthContext();
      const role = (ctx as any).role;
      const sessionEmail = (ctx as any).email?.toLowerCase().trim();
      const couponEmail = String((coupon as any).emailNormalized || (coupon as any).email).toLowerCase().trim();
      const isFinance = role === 'admin' || role === 'finance' || role === 'org:finance';
      const isOwner = sessionEmail && couponEmail === sessionEmail;
      if (!isFinance && !isOwner) reveal = false;
    } catch {
      reveal = false;
    }
  }
  const email = (coupon as any).email as string;
  const masked = email ? `${email[0]}***@${email.split('@')[1]}` : '***';
  return NextResponse.json({
    coupon: {
      ...coupon,
      _id: String((coupon as any)._id),
      email: reveal ? email : masked,
    },
  });
}
