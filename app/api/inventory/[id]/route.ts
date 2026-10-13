import { NextRequest, NextResponse } from "next/server";
import { Inventory } from "@/models/Inventory";
import dbConnect from "@/lib/mongodb";
import mongoose from "mongoose";
import { AuthorizationError, requirePermission, requireWorkspace } from "@/lib/auth";

function isValidObjectId(id: string) {
    return mongoose.Types.ObjectId.isValid(id);
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const authCtx = await requireWorkspace();
        const { id } = await params;
        if (!isValidObjectId(id)) {
            return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
        }
        await dbConnect();
        const inventory = await Inventory.findOne({ _id: id, orgId: authCtx.orgId }).lean();
        if (!inventory) {
            return NextResponse.json({ error: "Inventory item not found" }, { status: 404 });
        }
        return NextResponse.json(inventory);
    } catch (error) {
        if (error instanceof AuthorizationError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.error(error);
        return NextResponse.json({ error: "Failed to fetch inventory item" }, { status: 500 });
    }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const authCtx = await requirePermission('inventory:write');
        const { id } = await params;
        if (!id || !isValidObjectId(id)) {
            return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
        }
        const data = await request.json();
        const allowed = {
            ...(data.name !== undefined ? { name: String(data.name).trim().slice(0, 120) } : {}),
            ...(data.category !== undefined ? { category: String(data.category).trim().slice(0, 80) } : {}),
            ...(data.warehouse_location !== undefined ? { warehouse_location: String(data.warehouse_location).trim().slice(0, 120) } : {}),
            ...(data.price !== undefined ? { price: Number(data.price) } : {}),
            ...(data.quantity !== undefined ? { quantity: Number(data.quantity) } : {}),
            ...(data.stock_alert_level !== undefined ? { stock_alert_level: Number(data.stock_alert_level) } : {}),
        };
        if (
            (allowed.price !== undefined && (!Number.isFinite(allowed.price) || allowed.price <= 0)) ||
            (allowed.quantity !== undefined && (!Number.isFinite(allowed.quantity) || allowed.quantity < 0)) ||
            (allowed.stock_alert_level !== undefined && (!Number.isFinite(allowed.stock_alert_level) || allowed.stock_alert_level < 0))
        ) {
            return NextResponse.json({ error: "Invalid numeric inventory value" }, { status: 400 });
        }
        await dbConnect();
        const inventory = await Inventory.findOneAndUpdate(
            { _id: id, orgId: authCtx.orgId },
            allowed,
            { new: true, runValidators: true }
        );
        if (!inventory) {
            return NextResponse.json({ error: "Inventory item not found" }, { status: 404 });
        }
        return NextResponse.json(inventory);
    } catch (error) {
        if (error instanceof AuthorizationError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.error(error);
        return NextResponse.json({ error: "Failed to update inventory item" }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const authCtx = await requirePermission('inventory:write');
        const { id } = await params;
        if (!id || !isValidObjectId(id)) {
            return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
        }
        await dbConnect();
        const inventory = await Inventory.findOneAndDelete({ _id: id, orgId: authCtx.orgId });
        if (!inventory) {
            return NextResponse.json({ error: "Inventory item not found" }, { status: 404 });
        }
        return NextResponse.json({ message: "Inventory item deleted", id });
    } catch (error) {
        if (error instanceof AuthorizationError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.error(error);
        return NextResponse.json({ error: "Failed to delete inventory item" }, { status: 500 });
    }
}
