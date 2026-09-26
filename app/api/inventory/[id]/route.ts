import { NextRequest, NextResponse } from "next/server";
import { Inventory } from "@/models/Inventory";
import dbConnect from "@/lib/mongodb";
import mongoose from "mongoose";
import { getAuthContext } from "@/lib/auth";
import { isMutationAllowed } from "@/lib/authorization";

const ALLOWED_UPDATE_FIELDS = ['name', 'category', 'price', 'quantity', 'warehouse_location', 'stock_alert_level'] as const;

function isValidObjectId(id: string) {
    return mongoose.Types.ObjectId.isValid(id);
}

function pickWhitelisted(data: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const field of ALLOWED_UPDATE_FIELDS) {
        if (data[field] === undefined) continue;
        if (field === 'name' || field === 'warehouse_location') {
            out[field] = String(data[field]).trim().slice(0, 120);
        } else if (field === 'category') {
            out[field] = String(data[field]).trim().slice(0, 80);
        } else {
            out[field] = Number(data[field]);
        }
    }
    return out;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const ctx = await getAuthContext();
    if (!ctx.userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const orgId = ctx.orgId ?? 'default';
    try {
        const { id } = await params;
        if (!isValidObjectId(id)) {
            return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
        }
        await dbConnect();
        const inventory = await Inventory.findOne({ _id: id, orgId }).lean();
        if (!inventory) {
            return NextResponse.json({ error: "Inventory item not found" }, { status: 404 });
        }
        return NextResponse.json(inventory);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to fetch inventory item" }, { status: 500 });
    }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const ctx = await getAuthContext();
    if (!ctx.userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isMutationAllowed(ctx.role, 'inventory:write')) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const orgId = ctx.orgId ?? 'default';
    try {
        const { id } = await params;
        if (!id || !isValidObjectId(id)) {
            return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
        }
        const data = await request.json();
        const update = pickWhitelisted(data ?? {});
        await dbConnect();
        const inventory = await Inventory.findOneAndUpdate({ _id: id, orgId }, update, { new: true, runValidators: true });
        if (!inventory) {
            return NextResponse.json({ error: "Inventory item not found" }, { status: 404 });
        }
        return NextResponse.json(inventory);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to update inventory item" }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const ctx = await getAuthContext();
    if (!ctx.userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isMutationAllowed(ctx.role, 'inventory:delete')) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const orgId = ctx.orgId ?? 'default';
    try {
        const { id } = await params;
        if (!id || !isValidObjectId(id)) {
            return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
        }
        await dbConnect();
        const inventory = await Inventory.findOneAndDelete({ _id: id, orgId });
        if (!inventory) {
            return NextResponse.json({ error: "Inventory item not found" }, { status: 404 });
        }
        return NextResponse.json({ message: "Inventory item deleted", id });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to delete inventory item" }, { status: 500 });
    }
}
