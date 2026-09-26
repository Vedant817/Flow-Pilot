import { NextRequest, NextResponse } from "next/server";
import { Inventory } from "@/models/Inventory";
import dbConnect from "@/lib/mongodb";
import { getAuthContext } from "@/lib/auth";
import { isMutationAllowed } from "@/lib/authorization";

const MAX_PAGE_SIZE = 100;
const ESCAPE_RX = /[.*+?^${}()|[\]\\]/g;

export async function GET(request: NextRequest) {
    const ctx = await getAuthContext();
    if (!ctx.userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const orgId = ctx.orgId ?? 'default';
    try {
        await dbConnect();
        const sp = request.nextUrl.searchParams;
        const paginated = sp.has('page') || sp.has('limit') || sp.has('q');
        const q = sp.get('q')?.trim();

        const filter: Record<string, unknown> = { orgId };
        if (q) {
            const capped = q.slice(0, 100);
            const rx = new RegExp(capped.replace(ESCAPE_RX, '\\$&'), 'i');
            filter.$or = [{ name: rx }, { category: rx }];
        }

        // Backward-compat: no query params returns the plain array as before.
        if (!paginated) {
            const inventory = await Inventory.find({ orgId }).lean();
            return NextResponse.json(inventory);
        }

        const page = Math.max(1, parseInt(sp.get('page') ?? '1', 10) || 1);
        const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(sp.get('limit') ?? '25', 10) || 25));
        const [items, total] = await Promise.all([
            Inventory.find(filter).sort({ name: 1 }).skip((page - 1) * limit).limit(limit).lean(),
            Inventory.countDocuments(filter),
        ]);
        return NextResponse.json({
            data: items,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to fetch inventory" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const ctx = await getAuthContext();
    if (!ctx.userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isMutationAllowed(ctx.role, 'inventory:write')) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const orgId = ctx.orgId ?? 'default';
    const data = await request.json();
    const required_fields = ['name', 'category', 'price', 'quantity', 'warehouse_location', 'stock_alert_level'];
    for (const field of required_fields) {
        if (data[field] === undefined || data[field] === null || String(data[field]).trim() === '') {
            return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 });
        }
    }
    const price = Number(data.price);
    const quantity = Number(data.quantity);
    const alertLevel = Number(data.stock_alert_level);
    if (!Number.isFinite(price) || price <= 0) {
        return NextResponse.json({ error: "Price must be a positive number" }, { status: 400 });
    }
    if (!Number.isFinite(quantity) || quantity < 0) {
        return NextResponse.json({ error: "Quantity must be a non-negative number" }, { status: 400 });
    }
    if (!Number.isFinite(alertLevel) || alertLevel < 0) {
        return NextResponse.json({ error: "stock_alert_level must be a non-negative number" }, { status: 400 });
    }
    try {
        await dbConnect();
        const created = await Inventory.create({
            name: String(data.name).trim().slice(0, 120),
            category: String(data.category).trim().slice(0, 80),
            price,
            quantity,
            warehouse_location: String(data.warehouse_location).trim().slice(0, 120),
            stock_alert_level: alertLevel,
            orgId,
        });
        return NextResponse.json(created, { status: 201 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to create inventory item" }, { status: 500 });
    }
}
