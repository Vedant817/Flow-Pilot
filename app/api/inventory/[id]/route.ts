import { NextRequest, NextResponse } from "next/server";
import { Inventory } from "@/models/Inventory";
import dbConnect from "@/lib/mongodb";
import mongoose from "mongoose";
import { AuthorizationError, requirePermission, requireWorkspace } from "@/lib/auth";
import { InventoryMovement } from '@/models/InventoryMovement';

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
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            return NextResponse.json({ error: 'Invalid inventory metadata payload' }, { status: 400 });
        }
        for (const field of ['name', 'category', 'warehouse_location']) {
            if (data[field] !== undefined && (typeof data[field] !== 'string' || !data[field].trim())) {
                return NextResponse.json({ error: `Invalid ${field}` }, { status: 400 });
            }
        }
        for (const field of ['price', 'stock_alert_level']) {
            if (data[field] !== undefined && typeof data[field] !== 'number') {
                return NextResponse.json({ error: `Invalid ${field}` }, { status: 400 });
            }
        }
        if (data.quantity !== undefined || data.reservedQuantity !== undefined || data.quarantinedQuantity !== undefined) {
            return NextResponse.json({ error: 'Use an audited stock movement to change balances' }, { status: 400 });
        }
        if (!Number.isSafeInteger(data.expectedVersion) || data.expectedVersion < 0) {
            return NextResponse.json({ error: 'An expected inventory version is required' }, { status: 400 });
        }
        const allowed = {
            ...(data.name !== undefined ? { name: String(data.name).trim().slice(0, 120) } : {}),
            ...(data.name !== undefined ? { nameKey: String(data.name).toLowerCase().trim().replace(/\s+/g, ' ') } : {}),
            ...(data.category !== undefined ? { category: String(data.category).trim().slice(0, 80) } : {}),
            ...(data.warehouse_location !== undefined ? { warehouse_location: String(data.warehouse_location).trim().slice(0, 120) } : {}),
            ...(data.price !== undefined ? { price: Number(data.price) } : {}),
            ...(data.stock_alert_level !== undefined ? { stock_alert_level: Number(data.stock_alert_level) } : {}),
        };
        if (
            (allowed.price !== undefined && (!Number.isFinite(allowed.price) || allowed.price <= 0)) ||
            (allowed.stock_alert_level !== undefined && (!Number.isFinite(allowed.stock_alert_level) || allowed.stock_alert_level < 0))
        ) {
            return NextResponse.json({ error: "Invalid numeric inventory value" }, { status: 400 });
        }
        await dbConnect();
        const current = await Inventory.findOne({ _id: id, orgId: authCtx.orgId }).lean();
        if (!current) return NextResponse.json({ error: 'Inventory item not found' }, { status: 404 });
        if (((current as { __v?: number }).__v ?? 0) !== data.expectedVersion) {
            return NextResponse.json({ error: 'Inventory changed; reload before editing' }, { status: 409 });
        }
        if (allowed.price !== undefined) {
            if (allowed.price !== current.price) await requirePermission('pricing:write');
            else delete allowed.price;
        }
        const inventory = await Inventory.findOneAndUpdate(
            { _id: id, orgId: authCtx.orgId,
                $expr: { $eq: [{ $ifNull: ['$__v', 0] }, data.expectedVersion] } },
            { $set: allowed, $inc: { __v: 1 } },
            { new: true, runValidators: true }
        );
        if (!inventory) {
            return NextResponse.json({ error: "Inventory changed; reload before retrying" }, { status: 409 });
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
        const item = await Inventory.findOne({ _id: id, orgId: authCtx.orgId }).lean();
        if (!item) return NextResponse.json({ error: 'Inventory item not found' }, { status: 404 });
        if (item.quantity !== 0 || (item.reservedQuantity ?? 0) !== 0 || (item.quarantinedQuantity ?? 0) !== 0 ||
            await InventoryMovement.exists({ orgId: authCtx.orgId, productId: id })) {
            return NextResponse.json({ error: 'Stock or audit history exists; inventory items cannot be destructively deleted' }, { status: 409 });
        }
        const inventory = await Inventory.findOneAndDelete({
            _id: id, orgId: authCtx.orgId, quantity: 0,
            $expr: { $and: [
                { $eq: [{ $ifNull: ['$reservedQuantity', 0] }, 0] },
                { $eq: [{ $ifNull: ['$__v', 0] }, (item as { __v?: number }).__v ?? 0] },
            ] },
        });
        if (!inventory) {
            return NextResponse.json({ error: "Inventory changed during deletion; reload before retrying" }, { status: 409 });
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
