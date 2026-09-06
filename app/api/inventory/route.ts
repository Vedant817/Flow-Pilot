import { NextRequest, NextResponse } from "next/server";
import { Inventory } from "@/models/Inventory";
import dbConnect from "@/lib/mongodb";

export async function GET() {
    try {
        await dbConnect();
        const inventory = await Inventory.find({}).lean();
        return NextResponse.json(inventory);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to fetch inventory" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
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
        });
        return NextResponse.json(created, { status: 201 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to create inventory item" }, { status: 500 });
    }
}
