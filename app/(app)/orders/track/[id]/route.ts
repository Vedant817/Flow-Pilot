import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { Order } from "@/models/Order";
import dbConnect from "@/lib/mongodb";
import { rateLimitAsync } from "@/lib/rate-limit";
import { AuthorizationError, requireWorkspace } from "@/lib/auth";

function maskEmail(email: string): string {
    const [local, domain] = email.split("@");
    if (!domain) return "***";
    const first = local?.charAt(0) ?? "*";
    return `${first}***@${domain}`;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const limited = await rateLimitAsync(request, { windowMs: 60_000, max: 30, keyPrefix: "track" });
    if (!limited.ok) {
        return NextResponse.json(
            { error: "Rate limit exceeded. Please try again later." },
            { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": String(limited.retryAfterSec) } }
        );
    }

    try {
        const auth = await requireWorkspace();
        const { id } = await params;

        if (!id || !isValidObjectId(id)) {
            return NextResponse.json(
                { error: "Invalid Order ID" },
                { status: 400, headers: { "Cache-Control": "no-store" } }
            );
        }

        await dbConnect();

        const order = await Order.findOne({ _id: id, orgId: auth.orgId }).lean();
        if (!order) {
            return NextResponse.json(
                { error: "Order Not Found for the given ID" },
                { status: 404, headers: { "Cache-Control": "no-store" } }
            );
        }

        const products = Array.isArray((order as { products?: unknown }).products)
            ? (order as { products: { name: string; quantity: number }[] }).products.map((p) => ({
                name: p.name,
                quantity: p.quantity,
            }))
            : [];

        // Minimal PII projection: no full email/phone. Email is masked.
        const order_info = {
            id: String((order as { _id: unknown })._id),
            name: (order as { name?: string }).name ?? "",
            email: (order as { email?: string }).email ? maskEmail((order as { email: string }).email) : undefined,
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
        if (error instanceof AuthorizationError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.log(error)
        return NextResponse.json(
            { error: "Failed to fetch order" },
            { status: 500, headers: { "Cache-Control": "no-store" } }
        );
    }
}