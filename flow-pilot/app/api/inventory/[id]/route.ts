import { NextRequest, NextResponse } from "next/server";
import { Inventory } from "@/models/Inventory";

export async function GET(request: Request, { params }: { params: { id: string } }) {
    try {
        const id = await params.id;
        const inventory = await Inventory.findById(id);
        return NextResponse.json(inventory);
    } catch (error) {
        console.error(error);
        return NextResponse.error();
    }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const id = await params.id;

        if(!id){
            return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
        }

        const data = await request.json();
        const inventory = await Inventory.findByIdAndUpdate(id, data);
        return NextResponse.json(inventory);
    } catch (error) {
        console.error(error);
        return NextResponse.error();
    }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const id = await params.id;

        if(!id){
            return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
        }

        const inventory = await Inventory.findByIdAndDelete(id);
        return NextResponse.json(inventory);
    } catch (error) {
        console.error(error);
        return NextResponse.error();
    }
}