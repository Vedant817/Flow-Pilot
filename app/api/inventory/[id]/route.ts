import { NextRequest, NextResponse } from "next/server";
import { Inventory } from "@/models/Inventory";
import dbConnect from "@/lib/mongodb";
import mongoose from "mongoose";

function isValidObjectId(id: string) {
    return mongoose.Types.ObjectId.isValid(id);
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        if (!isValidObjectId(id)) {
            return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
        }
        await dbConnect();
        const inventory = await Inventory.findById(id).lean();
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
    try {
        const { id } = await params;
        if (!id || !isValidObjectId(id)) {
            return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
        }
        const data = await request.json();
        await dbConnect();
        const inventory = await Inventory.findByIdAndUpdate(id, data, { new: true, runValidators: true });
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
    try {
        const { id } = await params;
        if (!id || !isValidObjectId(id)) {
            return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
        }
        await dbConnect();
        const inventory = await Inventory.findByIdAndDelete(id);
        if (!inventory) {
            return NextResponse.json({ error: "Inventory item not found" }, { status: 404 });
        }
        return NextResponse.json({ message: "Inventory item deleted", id });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to delete inventory item" }, { status: 500 });
    }
}
