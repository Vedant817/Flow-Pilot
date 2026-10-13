import { NextRequest, NextResponse } from "next/server";
import { Inventory } from "@/models/Inventory";
import dbConnect from "@/lib/mongodb";
import { AuthorizationError, requirePermission, requireWorkspace } from "@/lib/auth";
import mongoose from 'mongoose';
import { InventoryMovement } from '@/models/InventoryMovement';

const MAX_PAGE_SIZE = 100;
const ESCAPE_RX = /[.*+?^${}()|[\]\\]/g;

export async function GET(request: NextRequest) {
    try {
        const authCtx = await requireWorkspace();
        await dbConnect();
        const page = Math.max(1, Number(request.nextUrl.searchParams.get('page')) || 1);
        const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(request.nextUrl.searchParams.get('limit')) || 25));
        const query = request.nextUrl.searchParams.get('q')?.trim().slice(0, 100);
        const category = request.nextUrl.searchParams.get('category')?.trim().slice(0, 80);
        const filter: Record<string, unknown> = { orgId: authCtx.orgId };
        if (category) filter.category = category;
        if (query) {
            const rx = new RegExp(query.replace(ESCAPE_RX, '\\$&'), 'i');
            filter.$or = [{ name: rx }, { category: rx }, { warehouse_location: rx }];
        }
        const [inventory, total, summaryRows] = await Promise.all([
            Inventory.find(filter)
                .sort({ name: 1, _id: 1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            Inventory.countDocuments(filter),
            Inventory.aggregate([
                { $match: { orgId: authCtx.orgId } },
                {
                    $group: {
                        _id: null,
                        totalProducts: { $sum: 1 },
                        totalValue: { $sum: { $multiply: ['$price', '$quantity'] } },
                        lowStock: {
                            $sum: { $cond: [{ $lte: ['$quantity', '$stock_alert_level'] }, 1, 0] },
                        },
                        categories: { $addToSet: '$category' },
                    },
                },
                {
                    $project: {
                        _id: 0,
                        totalProducts: 1,
                        totalValue: 1,
                        lowStock: 1,
                        categories: { $size: '$categories' },
                    },
                },
            ]),
        ]);
        return NextResponse.json({
            data: inventory,
            pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
            summary: summaryRows[0] ?? { totalProducts: 0, totalValue: 0, lowStock: 0, categories: 0 },
        });
    } catch (error) {
        if (error instanceof AuthorizationError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.error(error);
        return NextResponse.json({ error: "Failed to fetch inventory" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const authCtx = await requirePermission('inventory:write');
        const data = await request.json();
        const requiredFields = ['name', 'category', 'price', 'quantity', 'warehouse_location', 'stock_alert_level'];
        for (const field of requiredFields) {
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
        if (!Number.isSafeInteger(quantity) || quantity < 0) {
            return NextResponse.json({ error: "Quantity must be a non-negative integer" }, { status: 400 });
        }
        if (!Number.isFinite(alertLevel) || alertLevel < 0) {
            return NextResponse.json({ error: "stock_alert_level must be a non-negative number" }, { status: 400 });
        }
        await dbConnect();
        const item = {
            orgId: authCtx.orgId,
            name: String(data.name).trim().slice(0, 120),
            category: String(data.category).trim().slice(0, 80),
            price,
            quantity,
            warehouse_location: String(data.warehouse_location).trim().slice(0, 120),
            stock_alert_level: alertLevel,
        };
        const session = await mongoose.startSession();
        const result: { item?: mongoose.HydratedDocument<import('@/models/Inventory').IInventory> } = {};
        try {
            await session.withTransaction(async () => {
                const [created] = await Inventory.create([item], { session });
                await InventoryMovement.create([{
                    orgId: authCtx.orgId, productId: String(created._id), kind: 'opening',
                    quantityDelta: quantity, reservedDelta: 0,
                    balanceAfter: { quantity, reservedQuantity: 0 },
                    actorId: authCtx.userId, reason: 'Catalog item opening balance',
                    eventKey: `opening:${created._id}`, requestHash: 'opening-v1',
                    provenance: 'catalog_opening',
                }], { session });
                result.item = created;
            });
        } finally { await session.endSession(); }
        const created = result.item;
        if (!created) throw new Error('Inventory creation did not commit');
        return NextResponse.json(created, { status: 201 });
    } catch (error) {
        if (error instanceof AuthorizationError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.error(error);
        return NextResponse.json({ error: "Failed to create inventory item" }, { status: 500 });
    }
}
