import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { isValidObjectId } from "mongoose";
import { Order } from "@/models/Order";
import dbConnect from "@/lib/mongodb";
import { rateLimitAsync } from "@/lib/rate-limit";

function getTrackingSecret(): string {
  const secret = process.env.TRACKING_SECRET || process.env.ADMIN_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV !== "production") {
    console.warn(
      "[track-order] TRACKING_SECRET/ADMIN_SECRET not set — using ephemeral dev fallback. Set TRACKING_SECRET in production."
    );
    return "dev-only-tracking-secret";
  }
  throw new Error("TRACKING_SECRET is not configured");
}

function signOrderId(orderId: string, secret: string): string {
  return createHmac("sha256", secret).update(orderId).digest("hex");
}

export function createTrackingToken(orderId: string): string {
  const secret = getTrackingSecret();
  const payload = `${orderId}.${signOrderId(orderId, secret)}`;
  return Buffer.from(payload, "utf8").toString("base64url");
}

function verifyTrackingToken(token: string): string | null {
  let payload: string;
  try {
    payload = Buffer.from(token, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const dot = payload.lastIndexOf(".");
  if (dot <= 0) return null;
  const orderId = payload.slice(0, dot);
  const sig = payload.slice(dot + 1);
  if (!orderId || !sig || !isValidObjectId(orderId)) return null;

  const secret = getTrackingSecret();
  const expected = signOrderId(orderId, secret);
  const a = Buffer.from(sig, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return null;
  try {
    if (!timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  return orderId;
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  const first = local?.charAt(0) ?? "*";
  return `${first}***@${domain}`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const limited = await rateLimitAsync(request, {
    windowMs: 60_000,
    max: 30,
    keyPrefix: "track",
  });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please try again later." },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(limited.retryAfterSec),
        },
      }
    );
  }

  try {
    const { token } = await params;
    if (!token) {
      return NextResponse.json(
        { error: "Invalid tracking token" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const orderId = verifyTrackingToken(decodeURIComponent(token));
    if (!orderId) {
      return NextResponse.json(
        { error: "Invalid tracking token" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    await dbConnect();

    const order = await Order.findById(orderId).lean();
    if (!order) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    const products = Array.isArray(
      (order as { products?: unknown }).products
    )
      ? (
          order as { products: { name: string; quantity: number }[] }
        ).products.map((p) => ({ name: p.name, quantity: p.quantity }))
      : [];

    const order_info = {
      id: String((order as { _id: unknown })._id),
      name: (order as { name?: string }).name ?? "",
      email: (order as { email?: string }).email
        ? maskEmail((order as { email: string }).email)
        : undefined,
      date: (order as { date?: string }).date,
      time: (order as { time?: string }).time,
      products,
      productsCount: products.length,
      status: (order as { status?: string }).status,
      orderLink: (order as { orderLink?: string }).orderLink,
    };

    return NextResponse.json(order_info, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.log(error);
    return NextResponse.json(
      { error: "Failed to fetch order" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
